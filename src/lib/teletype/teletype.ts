import {IPty} from 'node-pty'
import {writeSync} from 'node:fs'
import {emitKeypressEvents} from 'readline'
import type {Key} from 'readline'
import {
  DEFAULT_DIMENSIONS,
  getDimensions,
  dimensions,
  initScreen,
  clearAttachmentScreen,
  areDimensionEqual,
  resizeBestFit,
} from 'oorja/lib/teletype/auxiliary'
import {HeadlessTerminal} from 'oorja/lib/teletype/headlessTerminal'
import {spawnStreamingShell} from 'oorja/lib/teletype/prompt'
import {Future, setTerminalTitle} from 'oorja/lib/utils'

type TeletypeOptions = {
  username: string
  hostname: string
  shell: string
  multiplex: boolean
  streamingIndicator: boolean
  harnessHost: boolean
  cwd: string
  localAttachmentEnabled: boolean
  process: NodeJS.Process
  onData: (data: string) => void
  onExit: (exitCode: number) => void
}

const SELF = 'self'
const ENTER_KEYS = new Set(['enter', 'return'])

export class Teletype {
  private readonly userDimensions: Record<string, dimensions> = {}

  private term!: IPty
  private attached = false
  private interrupted = false
  private inputPaused = false
  private reconnectTitleTimer?: NodeJS.Timeout
  private headlessTerminal?: HeadlessTerminal
  private readonly ptyFuture: Future<void> = new Future()
  private ptyReadyTimer?: NodeJS.Timeout
  private stopped = false
  private cleanupShell: (options?: {killTerm?: boolean}) => void = () => {}

  constructor(private readonly options: TeletypeOptions) {}

  start = () => {
    const {stdin, stdout} = this.options.process
    const supportsRawMode = typeof stdin.setRawMode === 'function'
    const canAttachLocally = this.options.localAttachmentEnabled && stdin.isTTY && supportsRawMode
    const dimensions = canAttachLocally ? getDimensions() : DEFAULT_DIMENSIONS
    if (canAttachLocally) {
      this.headlessTerminal = new HeadlessTerminal(dimensions)
    }

    this.term = spawnStreamingShell(
      this.options.shell,
      {
        name: 'xterm-256color',
        cols: dimensions.cols,
        rows: dimensions.rows,
        cwd: this.options.cwd,
        env: this.options.process.env,
      },
      this.options.streamingIndicator,
    )

    const dimensionPoll = setInterval(this.reEvaluateOwnDimensions, 1000)

    const ptyDataSubscription = this.term.onData((data: string) => {
      if (canAttachLocally) {
        if (this.attached) {
          stdout.write(data)
        } else {
          this.headlessTerminal!.write(data)
        }
      }

      if (!this.ptyReadyTimer) {
        this.ptyReadyTimer = setTimeout(() => {
          this.ptyFuture.resolve!(undefined)
        }, 100)
      }

      this.options.onData(data)
    })
    const ptyExitSubscription = this.term.onExit(({exitCode}) => {
      if (this.interrupted) {
        this.options.onExit(0)
        return
      }
      this.options.onExit(exitCode)
    })

    this.ready.then(() => {
      if (this.stopped || !canAttachLocally) {
        return
      }
      initScreen({
        username: this.options.username,
        hostname: this.options.hostname,
        shell: this.options.shell,
        multiplexed: this.options.multiplex,
        harnessHostEnabled: this.options.harnessHost,
      })
      emitKeypressEvents(stdin)
      stdin.setEncoding('utf8')
      stdin.setRawMode(true)
      stdin.on('keypress', this.handleAttachmentKey)
    })

    this.cleanupShell = ({killTerm = true}: {killTerm?: boolean} = {}) => {
      clearInterval(dimensionPoll)
      if (this.ptyReadyTimer) {
        clearTimeout(this.ptyReadyTimer)
      }
      ptyDataSubscription.dispose()
      ptyExitSubscription.dispose()
      if (canAttachLocally) {
        stdin.off('keypress', this.handleAttachmentKey)
        stdin.off('data', this.handleShellInput)
        stdin.setRawMode(false)
      }
      if (killTerm) {
        this.term.kill()
      }
    }
  }

  get pid() {
    return this.term.pid
  }

  get isAttached() {
    return this.attached
  }

  get ready() {
    return this.ptyFuture.promise
  }

  private attach = async () => {
    const {stdin, stdout} = this.options.process
    const headlessTerminal = this.headlessTerminal!

    stdin.off('keypress', this.handleAttachmentKey)
    this.userDimensions[SELF] = getDimensions()
    resizeBestFit(this.term, this.userDimensions)
    this.resizeHeadlessTerminal()
    const snapshot = await headlessTerminal.captureSnapshot()
    if (this.stopped) {
      return
    }

    headlessTerminal.dispose()
    this.headlessTerminal = undefined
    this.attached = true
    clearAttachmentScreen(stdout)
    stdout.write(snapshot)
    stdin.on('data', this.handleShellInput)
    if (this.inputPaused) {
      this.pauseInput()
    }
  }

  pauseInput = () => {
    this.inputPaused = true
    const {stdout} = this.options.process
    if (!this.attached || !stdout.isTTY || this.reconnectTitleTimer) {
      return
    }
    stdout.write('\u001B[22;2t') // Save the terminal's current window title.
    let dots = 0
    const updateTitle = () => {
      dots = (dots % 3) + 1
      setTerminalTitle(`(${'.'.repeat(dots)}) TeleType - reconnecting`)
    }
    updateTitle()
    this.reconnectTitleTimer = setInterval(updateTitle, 500)
    this.options.process.once('exit', this.restoreTitle)
  }

  resumeInput = () => {
    this.inputPaused = false
    this.restoreTitle()
  }

  write = (data: string) => {
    this.term.write(data)
  }

  setDimensions = (session: string, dimensions: dimensions & {initial?: boolean}) => {
    this.userDimensions[session] = dimensions
    resizeBestFit(this.term, this.userDimensions, dimensions.initial)
    this.resizeHeadlessTerminal()
  }

  removeSession = (session: string) => {
    delete this.userDimensions[session]
    resizeBestFit(this.term, this.userDimensions)
    this.resizeHeadlessTerminal()
  }

  private reEvaluateOwnDimensions = () => {
    if (!this.attached) {
      return
    }
    const lastKnown = this.userDimensions[SELF]
    const latest = getDimensions()

    if (areDimensionEqual(lastKnown, latest)) {
      return
    }
    this.userDimensions[SELF] = latest
    resizeBestFit(this.term, this.userDimensions)
    this.resizeHeadlessTerminal()
  }

  private resizeHeadlessTerminal = () => {
    this.headlessTerminal?.resize({cols: this.term.cols, rows: this.term.rows})
  }

  private handleAttachmentKey = (_input: string, key: Key) => {
    if (key.name && ENTER_KEYS.has(key.name)) {
      void this.attach()
      return
    }
    if (key.ctrl && key.name === 'c') {
      this.interrupt()
    }
  }

  private handleShellInput = (data: Buffer | string) => {
    const input = data.toString('utf8')
    if (this.inputPaused) {
      if (input.includes('\x03')) {
        this.interrupt()
      }
      return
    }
    this.term.write(input)
  }

  private interrupt = () => {
    this.interrupted = true
    this.term.kill()
  }

  private restoreTitle = () => {
    if (!this.reconnectTitleTimer) {
      return
    }
    clearInterval(this.reconnectTitleTimer)
    this.reconnectTitleTimer = undefined
    this.options.process.removeListener('exit', this.restoreTitle)
    writeSync(this.options.process.stdout.fd, '\u001B[23;2t') // Restore even during process exit.
  }

  stop = ({killTerm = true}: {killTerm?: boolean} = {}) => {
    this.resumeInput()
    this.stopped = true
    this.headlessTerminal?.dispose()
    this.headlessTerminal = undefined
    this.cleanupShell({killTerm})
  }
}

import {spawn, IPty} from 'node-pty'
import chalk from 'chalk'
import {
  DEFAULT_DIMENSIONS,
  getDimensions,
  dimensions,
  initScreen,
  areDimensionEqual,
  resizeBestFit,
} from 'oorja/lib/teletype/auxiliary'
import {Future} from 'oorja/lib/utils'

type TeletypeOptions = {
  username: string
  hostname: string
  shell: string
  multiplex: boolean
  cwd: string
  mirrorToLocalTerminal: boolean
  process: NodeJS.Process
  onData: (data: string) => void
  onExit: () => void
}

const SELF = 'self'

export class Teletype {
  private readonly userDimensions: Record<string, dimensions> = {}

  private term!: IPty
  private ptyReady = false
  private readonly ptyFuture: Future<boolean> = new Future()
  private stopped = false
  private cleanupShell: (options?: {killTerm?: boolean}) => void = () => {}

  constructor(private readonly options: TeletypeOptions) {}

  start = () => {
    const {stdin, stdout} = this.options.process
    const shouldReadLocalStdin =
      this.options.mirrorToLocalTerminal && stdin.isTTY && typeof stdin.setRawMode === 'function'
    const dimensions = shouldReadLocalStdin ? getDimensions() : DEFAULT_DIMENSIONS
    if (shouldReadLocalStdin) {
      this.userDimensions[SELF] = dimensions
    }

    if (this.options.mirrorToLocalTerminal) {
      console.log(
        chalk.blue(
          `${chalk.bold(`${this.options.username}@${this.options.hostname}`)} Spawning streaming shell: ${chalk.bold(
            `${this.options.shell}`,
          )}`,
        ),
      )
    }

    this.term = spawn(this.options.shell, [], {
      name: 'xterm-256color',
      cols: dimensions.cols,
      rows: dimensions.rows,
      cwd: this.options.cwd,
      env: this.options.process.env,
    })

    this.ptyFuture.promise.then(() => {
      if (!this.options.mirrorToLocalTerminal) {
        return
      }
      initScreen(this.options.username, this.options.hostname, this.options.shell, this.options.multiplex)
      if (!shouldReadLocalStdin) {
        return
      }
      if (this.options.shell.endsWith('bash')) {
        stdout.write('Adjusting shell prompt to show streaming indicator\n')
        this.term.write("export PS1='📡 [streaming] '$PS1\n")
      }
      if (this.options.shell.endsWith('zsh')) {
        stdout.write('Adjusting shell prompt to show streaming indicator\n')
        // FIXME: this doesnt work on macos (or its probably due to some conflict with powerlevel10k)
        this.term.write("PROMPT='📡 [streaming] '$PROMPT\n")
      }
      if (this.options.shell.endsWith('fish')) {
        stdout.write('Adjusting shell prompt to show streaming indicator\n')
        this.term.write(
          'functions -c fish_prompt __orig_fish_prompt; ' +
            "function fish_prompt; echo -n '📡 [streaming] '; __orig_fish_prompt; end\n",
        )
      }
    })

    const dimensionPoll = setInterval(this.reEvaluateOwnDimensions, 1000)

    const ptyDataSubscription = this.term.onData((data: string) => {
      if (this.options.mirrorToLocalTerminal) {
        stdout.write(data)
      }

      if (!this.ptyReady) {
        this.ptyReady = true
        setTimeout(() => {
          this.ptyFuture.resolve!(true)
        }, 100)
      }

      this.options.onData(data)
    })
    const ptyExitSubscription = this.term.onExit(this.options.onExit)

    const stdinDataHandler = (data: Buffer | string) => this.term.write(data.toString('utf8'))
    if (shouldReadLocalStdin) {
      stdin.setEncoding('utf8')
      stdin.setRawMode(true)
      stdin.on('data', stdinDataHandler)
    }

    this.cleanupShell = ({killTerm = true}: {killTerm?: boolean} = {}) => {
      clearInterval(dimensionPoll)
      ptyDataSubscription.dispose()
      ptyExitSubscription.dispose()
      if (shouldReadLocalStdin) {
        stdin.off('data', stdinDataHandler)
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

  write = (data: string) => {
    this.term.write(data)
  }

  setDimensions = (session: string, dimensions: dimensions & {initial?: boolean}) => {
    this.userDimensions[session] = dimensions
    resizeBestFit(this.term, this.userDimensions, dimensions.initial)
  }

  removeSession = (session: string) => {
    delete this.userDimensions[session]
    resizeBestFit(this.term, this.userDimensions)
  }

  private reEvaluateOwnDimensions = () => {
    if (!this.userDimensions[SELF]) {
      return
    }
    const lastKnown = this.userDimensions[SELF]
    const latest = getDimensions()

    if (areDimensionEqual(lastKnown, latest)) {
      return
    }
    this.userDimensions[SELF] = latest
    resizeBestFit(this.term, this.userDimensions)
  }

  stop = ({killTerm = true}: {killTerm?: boolean} = {}) => {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.cleanupShell({killTerm})
    this.cleanupShell = () => {}
  }
}

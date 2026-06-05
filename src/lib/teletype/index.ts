import {spawn, IPty} from 'node-pty'
import * as os from 'os'
import {RoomKey} from 'oorja/lib/connect/types'
import {getDimensions, dimensions, initScreen, areDimensionEqual, resizeBestFit} from 'oorja/lib/teletype/auxiliary'
import chalk from 'chalk'
import {Unauthorized} from 'oorja/lib/connect/errors'
import {encrypt, decrypt} from 'oorja/lib/encryption'
import {JoinChannelOptions} from 'oorja/lib/connect/index'
import {Channel} from 'phoenix'
import {Future, printExitMessage} from 'oorja/lib/utils'
import {exit} from 'oorja/lib/exit'

enum MessageType {
  IN = 'i',
  OUT = 'o',
  DIMENSIONS = 'd',
}

export type TeletypeOptions = {
  userId: string
  roomKey: RoomKey
  shell: string
  multiplex: boolean
  process: NodeJS.Process
  joinChannel: (options: JoinChannelOptions<TeletypeChannelParams, unknown>) => Channel
}

type TeletypeChannelParams = {
  username: string
  hostname: string
  multiplexed: boolean
}

const SELF = 'self'

export class TeletypeSession {
  private readonly username = os.userInfo().username
  private readonly hostname = os.hostname()
  private readonly userDimensions: Record<string, dimensions> = {
    [SELF]: getDimensions(),
  }

  private channel!: Channel
  private term!: IPty
  private sessionCount = 0
  private ptyReady = false
  private readonly ptyFuture: Future<boolean> = new Future()
  private stopped = false
  private cleanupShell: (options?: {killTerm?: boolean}) => void = () => {}
  private resolve?: (value: null) => void

  constructor(private readonly options: TeletypeOptions) {}

  run = () =>
    new Promise<null>((resolve) => {
      this.resolve = resolve
      this.channel = this.options.joinChannel({
        channel: `teletype:${this.options.roomKey.roomId}`,
        params: {
          username: this.username,
          hostname: this.hostname,
          multiplexed: this.options.multiplex,
        },
        onJoin: this.startTerm,
        onClose: this.handleClose,
        onError: this.handleError,
        onMessage: this.handleMessage,
        handleSessionJoin: this.handleSessionJoin,
        handleSessionLeave: this.handleSessionLeave,
      })
    })

  private startTerm = () => {
    const {stdin, stdout} = this.options.process
    const dimensions = this.userDimensions[SELF]

    console.log(
      chalk.blue(
        `${chalk.bold(`${this.username}@${this.hostname}`)} Spawning streaming shell: ${chalk.bold(
          `${this.options.shell}`,
        )}`,
      ),
    )

    this.term = spawn(this.options.shell, [], {
      name: 'xterm-256color',
      cols: dimensions.cols,
      rows: dimensions.rows,
      cwd: this.options.process.cwd(),
      env: this.options.process.env,
    })

    this.ptyFuture.promise.then(() => {
      initScreen(this.username, this.hostname, this.options.shell, this.options.multiplex)
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

    // track own dimensions and keep it up to date
    const dimensionPoll = setInterval(this.reEvaluateOwnDimensions, 1000)

    const ptyDataSubscription = this.term.onData((d: string) => {
      stdout.write(d)

      if (!this.ptyReady) {
        this.ptyReady = true
        setTimeout(() => {
          this.ptyFuture.resolve!(true)
        }, 100)
      }

      if (this.sessionCount < 2) {
        // 1 sub for own channel session
        // < 2 means no subscribers. no point pushing data.
        return
      }
      this.channel.push('new_msg', {
        t: MessageType.OUT,
        b: true,
        d: encrypt(d, this.options.roomKey),
      })
    })
    const ptyExitSubscription = this.term.onExit(() => {
      console.log(chalk.blueBright('terminated shell stream to SupaKit. byee!'))
      this.stop({killTerm: false})
      this.resolve?.(null)
    })

    const shouldReadLocalStdin = stdin.isTTY && typeof stdin.setRawMode === 'function'
    const stdinDataHandler = (d: Buffer | string) => this.term.write(d.toString('utf8'))
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

  private reEvaluateOwnDimensions = () => {
    const lastKnown = this.userDimensions[SELF]
    const latest = getDimensions()

    if (areDimensionEqual(lastKnown, latest)) {
      return
    }
    this.userDimensions[SELF] = latest
    resizeBestFit(this.term, this.userDimensions)
  }

  private handleClose = () => {
    if (this.stopped) {
      return
    }
    this.stop({leaveChannel: false})
    printExitMessage(chalk.redBright('connection closed, terminated stream.'))
    exit(3)
  }

  private handleError = (err?: any) => {
    this.stop({leaveChannel: false})
    if (err instanceof Unauthorized) {
      printExitMessage(chalk.redBright(err.message))
    } else {
      printExitMessage(chalk.redBright('connection error, terminated stream.'))
    }
    exit(4)
  }

  private handleMessage = ({from: {session}, t, d}: any) => {
    switch (t) {
      case MessageType.DIMENSIONS:
        this.userDimensions[session] = d
        resizeBestFit(this.term, this.userDimensions, d.initial)
        break
      case MessageType.IN: {
        const data = decrypt(d, this.options.roomKey)
        const userId = session.split(':')[0]
        const userType = session.split(':')[2]
        if (userType === 'task') {
          this.stop()
          printExitMessage(
            chalk.redBright(
              `unexpected input from user: ${userId} with task-token, terminating stream for safety. Please report this issue`,
            ),
          )
          exit(5)
          return
        }
        if (this.options.multiplex) {
          this.term.write(data)
          return
        }
        if (userId === this.options.userId) {
          this.term.write(data)
        } else {
          this.stop()
          printExitMessage(
            chalk.redBright(
              `unexpected input from user: ${userId}, terminating stream for safety. Please report this issue`,
            ),
          )
          exit(5)
        }
        break
      }
    }
  }

  private handleSessionJoin = () => {
    this.sessionCount++
  }

  private handleSessionLeave = (s: string) => {
    this.sessionCount -= 1
    if (s) {
      delete this.userDimensions[s]
    }
    resizeBestFit(this.term, this.userDimensions)
  }

  private stop = ({killTerm = true, leaveChannel = true}: {killTerm?: boolean; leaveChannel?: boolean} = {}) => {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.cleanupShell({killTerm})
    this.cleanupShell = () => {}

    if (leaveChannel) {
      this.channel.leave(1000)
    }
  }
}

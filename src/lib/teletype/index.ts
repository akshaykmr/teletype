import * as os from 'os'
import {RoomKey} from 'oorja/lib/connect/types'
import chalk from 'chalk'
import {Unauthorized} from 'oorja/lib/connect/errors'
import {encrypt, decrypt} from 'oorja/lib/encryption'
import {JoinChannelOptions} from 'oorja/lib/connect/index'
import {Channel} from 'phoenix'
import {printExitMessage} from 'oorja/lib/utils'
import {exit} from 'oorja/lib/exit'
import {Teletype} from 'oorja/lib/teletype/teletype'

enum MessageType {
  IN = 'i',
  OUT = 'o',
  DIMENSIONS = 'd',
  ACTIVE_STREAMS = 'active_streams',
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

export class TeletypeManager {
  private readonly username = os.userInfo().username
  private readonly hostname = os.hostname()
  private readonly terms: Record<string, Teletype> = {}

  private channel!: Channel
  private nextTermId = '1'
  private sessionCount = 0
  private stopped = false
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
    const termId = this.nextTermId
    this.nextTermId = String(parseInt(termId) + 1)

    const teletype = new Teletype({
      username: this.username,
      hostname: this.hostname,
      shell: this.options.shell,
      multiplex: this.options.multiplex,
      process: this.options.process,
      onData: (data) => {
        if (this.sessionCount < 2) {
          // 1 sub for own channel session
          // < 2 means no subscribers. no point pushing data.
          return
        }
        this.channel.push('new_msg', {
          t: MessageType.OUT,
          b: true,
          sid: termId,
          d: encrypt(data, this.options.roomKey),
        })
      },
      onExit: () => {
        this.terms[termId]?.stop({killTerm: false})
        delete this.terms[termId]
        console.log(chalk.blueBright('terminated shell stream to SupaKit. byee!'))
        this.stop({killTerms: false})
        this.resolve?.(null)
      },
    })

    this.terms[termId] = teletype
    try {
      teletype.start()
    } catch (error) {
      this.handleTermStartError(error)
      return
    }
    this.broadcastActiveStreams()
  }

  private handleTermStartError = (error: unknown) => {
    this.stop({killTerms: false})

    const reason = error instanceof Error ? error.message : String(error)
    if (this.options.process.platform === 'darwin' && reason.includes('posix_spawnp failed')) {
      const workaround = 'chmod +x "$(npm root -g)"/oorja/node_modules/node-pty/prebuilds/darwin-*/spawn-helper'
      printExitMessage(
        `${chalk.redBright(`Failed to start ${this.options.shell}.`)}\n` +
          'node-pty may have installed its macOS spawn helper without execute permissions.\n' +
          `Try running:\n${chalk.yellowBright(workaround)}\n`,
      )
    } else {
      printExitMessage(chalk.redBright(`Failed to start ${this.options.shell}: ${reason}\n`))
    }
    exit(6)
  }

  private broadcastActiveStreams = () => {
    this.channel.push('new_msg', {
      t: MessageType.ACTIVE_STREAMS,
      b: true,
      d: {sids: Object.keys(this.terms)},
    })
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

  private handleMessage = ({from: {session}, sid, t, d}: any) => {
    const term = this.terms[sid]
    if (!term) {
      return
    }

    switch (t) {
      case MessageType.DIMENSIONS:
        term.setDimensions(session, d)
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
          term.write(data)
          return
        }
        if (userId === this.options.userId) {
          term.write(data)
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
    this.broadcastActiveStreams()
  }

  private handleSessionLeave = (session: string) => {
    this.sessionCount -= 1
    Object.values(this.terms).forEach((term) => term.removeSession(session))
  }

  private stop = ({killTerms = true, leaveChannel = true}: {killTerms?: boolean; leaveChannel?: boolean} = {}) => {
    if (this.stopped) {
      return
    }
    this.stopped = true
    Object.values(this.terms).forEach((term) => term.stop({killTerm: killTerms}))

    if (leaveChannel) {
      this.channel.leave(1000)
    }
  }
}

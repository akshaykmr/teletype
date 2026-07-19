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
import {MultishellUI} from 'oorja/lib/teletype/ui'
import {readlinkSync} from 'fs'

enum MessageType {
  IN = 'i',
  OUT = 'o',
  DIMENSIONS = 'd',
  NEW_STREAM = 'new_stream',
  STREAM_EXITED = 'stream_exited',
  ACTIVE_STREAMS = 'active_streams',
}

export type TeletypeOptions = {
  userId: string
  roomKey: RoomKey
  shell: string
  multiplex: boolean
  multishell: boolean
  process: NodeJS.Process
  joinChannel: (options: JoinChannelOptions<TeletypeChannelParams, unknown>) => Channel
}

type TeletypeChannelParams = {
  username: string
  hostname: string
  tty: string
  multiplexed: boolean
  multishell: boolean
}

type TeletypeChannelMetas = {
  metas: [{tty?: string}]
}

export class TeletypeManager {
  private readonly username = os.userInfo().username
  private readonly hostname = os.hostname()
  private readonly terms: Record<string, Teletype> = {}

  private channel!: Channel
  private nextTermId = '1'
  private readonly viewers = new Set<string>()
  private readonly ui: MultishellUI
  private stopped = false
  private resolve?: (value: null) => void

  constructor(private readonly options: TeletypeOptions) {
    this.ui = new MultishellUI(options.process, options.multishell)
  }

  run = () =>
    new Promise<null>((resolve) => {
      this.resolve = resolve
      this.channel = this.options.joinChannel({
        channel: `teletype:${this.options.roomKey.roomId}`,
        params: {
          username: this.username,
          hostname: this.hostname,
          tty: `${this.username}@${this.hostname}`,
          multiplexed: this.options.multiplex,
          multishell: this.options.multishell,
        },
        onJoin: this.startTerm,
        onClose: this.handleClose,
        onError: this.handleError,
        onMessage: this.handleMessage,
        handleSessionJoin: this.handleSessionJoin,
        handleSessionLeave: this.handleSessionLeave,
      })
      this.ui.start(this.handleInterrupt)
    })

  private startTerm = () => {
    this.start(this.options.process.cwd())
  }

  private start = (cwd: string) => {
    const termId = this.nextTermId
    this.nextTermId = String(parseInt(termId) + 1)

    const teletype = new Teletype({
      username: this.username,
      hostname: this.hostname,
      shell: this.options.shell,
      multiplex: this.options.multiplex,
      cwd,
      mirrorToLocalTerminal: !this.options.multishell,
      process: this.options.process,
      onData: (data) => {
        if (this.viewers.size === 0) {
          return
        }
        this.channel.push('new_msg', {
          t: MessageType.OUT,
          b: true,
          sid: termId,
          d: encrypt(data, this.options.roomKey),
        })
      },
      onExit: () => this.handleTermExit(termId),
    })

    this.terms[termId] = teletype
    try {
      teletype.start()
    } catch (error) {
      this.handleTermStartError(error)
      return
    }
    this.broadcastActiveStreams()
    this.ui.update(Object.keys(this.terms).length, this.viewers.size)
  }

  private handleTermExit = (termId: string) => {
    this.terms[termId].stop({killTerm: false})
    delete this.terms[termId]
    this.channel.push('new_msg', {
      t: MessageType.STREAM_EXITED,
      b: true,
      sid: termId,
    })
    this.broadcastActiveStreams()

    if (Object.keys(this.terms).length > 0 || this.options.multishell) {
      this.ui.update(Object.keys(this.terms).length, this.viewers.size)
      return
    }

    this.stop({killTerms: false})
    console.log(chalk.blueBright('terminated shell stream to SupaKit. byee!'))
    this.resolve?.(null)
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
    if (t === MessageType.NEW_STREAM) {
      if (!this.options.multishell) {
        console.log(
          chalk.yellowBright('This session is running in single-shell mode. Restart with --multishell to add shells.'),
        )
        return
      }
      const sourceTerm = this.terms[d.sid]
      const cwd = sourceTerm ? getCwd(sourceTerm.pid) : null
      this.start(cwd || this.options.process.cwd())
      return
    }

    const term = this.terms[sid]
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

  private handleSessionJoin = (session: string, _current: unknown, newMetas: unknown) => {
    const {metas} = newMetas as TeletypeChannelMetas
    if (!metas[0].tty) {
      this.viewers.add(session)
    }
    this.broadcastActiveStreams()
    this.ui.update(Object.keys(this.terms).length, this.viewers.size)
  }

  private handleSessionLeave = (session: string) => {
    this.viewers.delete(session)
    Object.values(this.terms).forEach((term) => term.removeSession(session))
    this.ui.update(Object.keys(this.terms).length, this.viewers.size)
  }

  private handleInterrupt = () => {
    this.stop()
    this.ui.confirmStopped()
    this.resolve?.(null)
  }

  private stop = ({killTerms = true, leaveChannel = true}: {killTerms?: boolean; leaveChannel?: boolean} = {}) => {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.ui.stop()
    Object.values(this.terms).forEach((term) => term.stop({killTerm: killTerms}))

    if (leaveChannel) {
      this.channel.leave(1000)
    }
  }
}

const getCwd = (pid: number): string | null => {
  try {
    return readlinkSync(`/proc/${pid}/cwd`)
  } catch {
    return null
  }
}

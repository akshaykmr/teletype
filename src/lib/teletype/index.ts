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
import {downloadTransferredFile, FileTransfer} from 'oorja/lib/teletype/fileTransfer'
import {getShellCwd} from 'oorja/lib/teletype/cwd'

enum MessageType {
  IN = 'i',
  OUT = 'o',
  DIMENSIONS = 'd',
  NEW_STREAM = 'new_stream',
  STREAM_EXITED = 'stream_exited',
  ACTIVE_STREAMS = 'active_streams',
  FILE_TRANSFER_INIT = 'file_transfer_init',
  FILE_TRANSFER = 'file_transfer',
  FILE_TRANSFER_DONE = 'file_transfer_done',
}

export type TeletypeOptions = {
  userId: string
  roomKey: RoomKey
  shell: string
  multiplex: boolean
  multishell: boolean
  streamingIndicator: boolean
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
  private readonly fileTransferDirs: Record<string, string> = {}

  private channel!: Channel
  private nextTermId = '1'
  private readonly viewers = new Set<string>()
  private readonly ui?: MultishellUI
  private stopped = false
  private resolve?: (value: null) => void

  constructor(private readonly options: TeletypeOptions) {
    if (options.multishell) {
      this.ui = new MultishellUI(options.process)
    }
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
      this.ui?.start(this.handleInterrupt)
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
      streamingIndicator: this.options.streamingIndicator,
      cwd,
      localAttachmentEnabled: !this.options.multishell,
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
    this.updateUI()
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
      this.updateUI()
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
      if (!this.ensureCanWrite(session)) {
        return
      }
      if (!this.options.multishell) {
        console.log(
          chalk.yellowBright('This session is running in single-shell mode. Restart with --multishell to add shells.'),
        )
        return
      }
      const cwd = this.getTermCwd(d.sid) || this.options.process.cwd()
      this.start(cwd)
      return
    }

    if (t === MessageType.FILE_TRANSFER_INIT || t === MessageType.FILE_TRANSFER) {
      const {userId, userType} = getSessionIdentity(session)
      if (userId !== this.options.userId || userType === 'task') {
        return
      }

      if (t === MessageType.FILE_TRANSFER_INIT) {
        const cwd = this.getTermCwd(sid)
        if (!cwd) {
          return
        }
        this.fileTransferDirs[d.batch_id] = cwd
        return
      }

      const transfer = decrypt(d, this.options.roomKey) as FileTransfer
      this.receiveFile(sid, transfer, session).catch(console.error)
      return
    }

    const term = this.terms[sid]
    switch (t) {
      case MessageType.DIMENSIONS:
        term.setDimensions(session, d)
        break
      case MessageType.IN: {
        if (!this.ensureCanWrite(session)) {
          return
        }
        term.write(decrypt(d, this.options.roomKey))
        break
      }
    }
  }

  private receiveFile = async (sid: string, transfer: FileTransfer, session: string) => {
    const pushStatus = (status: 'ok' | 'err') =>
      this.channel.push('new_msg', {
        to: [{session}],
        t: MessageType.FILE_TRANSFER_DONE,
        sid,
        d: {id: transfer.id, status},
      })

    const cwd = this.fileTransferDirs[transfer.batch_id]
    if (!cwd) {
      pushStatus('err')
      return
    }

    try {
      await downloadTransferredFile(transfer, cwd, this.options.roomKey)
      pushStatus('ok')
    } catch (error) {
      pushStatus('err')
      throw error
    }
  }

  private getTermCwd = (termId: string): string | null => {
    const term = this.terms[termId]
    if (!term) {
      return null
    }

    try {
      return getShellCwd(term.pid)
    } catch {
      return null
    }
  }

  private handleSessionJoin = (session: string, _current: unknown, newMetas: unknown) => {
    const {metas} = newMetas as TeletypeChannelMetas
    if (!metas[0].tty) {
      this.viewers.add(session)
    }
    this.broadcastActiveStreams()
    this.updateUI()
  }

  private handleSessionLeave = (session: string) => {
    this.viewers.delete(session)
    Object.values(this.terms).forEach((term) => term.removeSession(session))
    this.updateUI()
  }

  private handleInterrupt = () => {
    this.stop()
    this.ui?.confirmStopped()
    this.resolve?.(null)
  }

  private ensureCanWrite = (session: string) => {
    const {userId, userType} = getSessionIdentity(session)
    if (userId === this.options.userId) {
      return true
    }
    if (this.options.multiplex && userType !== 'task') {
      return true
    }

    this.stop()
    printExitMessage(
      chalk.redBright(
        userType === 'task'
          ? `unexpected input from user: ${userId} with task-token, terminating stream for safety. Please report this issue`
          : `unexpected input from user: ${userId}, terminating stream for safety. Please report this issue`,
      ),
    )
    exit(5)
    return false
  }

  private updateUI = () => {
    this.ui?.update(Object.keys(this.terms).length, this.viewers.size)
  }

  private stop = ({killTerms = true, leaveChannel = true}: {killTerms?: boolean; leaveChannel?: boolean} = {}) => {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.ui?.stop()
    Object.values(this.terms).forEach((term) => term.stop({killTerm: killTerms}))

    if (leaveChannel) {
      this.channel.leave(1000)
    }
  }
}

const getSessionIdentity = (session: string) => {
  const [userId, , userType] = session.split(':')
  return {userId, userType}
}

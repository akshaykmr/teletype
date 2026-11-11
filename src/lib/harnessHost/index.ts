import * as os from 'node:os'

import chalk from 'chalk'
import {HarnessId, type HarnessCommand, type HarnessEvent} from 'oorja-harness-host/messages'
import type {Channel} from 'phoenix'
import ora from 'ora'

import type {JoinChannel} from 'oorja/lib/connect/index'
import type {RoomKey} from 'oorja/lib/connect/types'
import {decrypt, encrypt} from 'oorja/lib/encryption'
import type {EncryptedPayload} from 'oorja/lib/encryption'
import {logger} from 'oorja/lib/log'
import {exit} from 'oorja/lib/exit'
import {SharedHarnessHost} from 'oorja/lib/harnessHost/sharedHost/index'
import {Future, printErrorMessage} from 'oorja/lib/utils'

import {loadHarnessHost} from 'oorja/lib/harnessHost/setup'

export type HarnessHostConnectionOptions = {
  userId: string
  machineId: string
  roomKey: RoomKey
  process: NodeJS.Process
  multiplayer: boolean
  stateFile: string
  joinChannel: JoinChannel
}

export class HarnessHostConnection {
  private channel!: Channel
  private sharedHost!: SharedHarnessHost
  private readonly finished = new Future<null>()
  private stopped = false
  private standalone = false

  constructor(private readonly options: HarnessHostConnectionOptions) {}

  start = async () => {
    const spinner = ora('Starting Harness Host').start()
    try {
      this.sharedHost = await SharedHarnessHost.open({
        socketPath: localSocketPath(this.options.stateFile, this.options.machineId),
        roomId: this.options.roomKey.roomId,
        workdir: this.options.process.cwd(),
        createHost: async (emit) => {
          const {startHarnessHost} = await loadHarnessHost()
          return startHarnessHost({
            hostId: this.options.machineId,
            hostname: `${os.userInfo().username}@${os.hostname()}`,
            workdir: this.options.process.cwd(),
            stateFile: this.options.stateFile,
            harnesses: Object.values(HarnessId),
            onError: (error) => {
              logger.error('harness.error', error)
            },
            onStdout: (text) => {
              this.logHarnessOutput('harness.stdout', text)
            },
            onStderr: (text) => {
              this.logHarnessOutput('harness.stderr', text)
            },
            emit,
          })
        },
      })
      spinner.stop()
    } catch (error) {
      spinner.fail('Could not start Harness Host. For setup checks, run: oorja harness-host:doctor')
      throw error
    }
    this.channel = this.options.joinChannel<HarnessChannelParams, HarnessChannelMetas>({
      channel: `harness:${this.options.roomKey.roomId}`,
      params: {
        client_type: 'teletype',
        machine_id: this.options.machineId,
      },
      onJoin: this.handleJoin,
      onClose: this.stop,
      onError: this.stop,
      onMessage: this.handleMessage,
      handleSessionJoin: this.sendCurrentState,
      handleSessionLeave: this.sendCurrentState,
    })
    this.sharedHost.listen(this.broadcastEvent)
  }

  run = async () => {
    this.standalone = true
    await this.start()
    this.options.process.once('SIGINT', this.stop)
    this.options.process.once('SIGTERM', this.stop)
    return this.finished.promise
  }

  stop = async () => {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.options.process.removeListener('SIGINT', this.stop)
    this.options.process.removeListener('SIGTERM', this.stop)
    this.channel.leave(1000)
    await this.sharedHost.stop()
    this.finished.resolve?.(null)
  }

  private handleMessage = ({from: {session}, d, e}: HarnessChannelMessage) => {
    const {userId, clientType} = getSessionIdentity(session)
    if (!e || clientType !== 'user' || !this.ensureCanWrite(userId)) {
      return
    }
    const command = decrypt(d, this.options.roomKey) as HarnessCommand
    this.sharedHost.handleCommand(command)
  }

  private handleJoin = () => {
    if (this.standalone) {
      console.log(`\n${chalk.greenBright('✔')} ${chalk.bold('Harness Host is online')}`)
      console.log(`  ${os.userInfo().username}@${os.hostname()} ${chalk.dim('·')} ${this.options.process.cwd()}`)
      console.log('\nOpen SparkChat in this space to run agents on this computer.')
      console.log(chalk.dim('Press Ctrl+C to stop hosting.\n'))
    }
    this.sendCurrentState()
  }

  private sendCurrentState = () => {
    this.sharedHost.emitState()
  }

  private logHarnessOutput = (event: string, text: string) => {
    const message = text.trim()
    if (message) {
      logger.info(event, {message})
    }
  }

  private broadcastEvent = (event: HarnessEvent) => {
    this.channel.push('new_msg', {
      b: true,
      t: 'harness',
      e: true,
      d: encrypt(event, this.options.roomKey),
    })
  }

  private ensureCanWrite = (userId: string) => {
    if (userId === this.options.userId || this.options.multiplayer) {
      return true
    }

    printErrorMessage(
      chalk.redBright(`unexpected input from user: ${userId}, terminating host for safety. Please report this issue`),
      {event: 'harness.channel.input'},
    )
    void this.stop().then(() => exit(1))
    return false
  }
}

type HarnessChannelMessage = {
  from: {session: string}
  d: EncryptedPayload
  e: boolean
}

type HarnessChannelParams = {
  client_type: 'teletype'
  machine_id: string
}

type HarnessChannelMetas = {
  metas: [{client_type: string; machine_id: string | null}]
}

const localSocketPath = (stateFile: string, machineId: string) => {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\oorja-harness-host-${machineId}`
  }
  return `${stateFile}.socket`
}

const getSessionIdentity = (session: string) => {
  const [userId, , clientType] = session.split(':')
  return {userId, clientType}
}

import * as os from 'node:os'

import chalk from 'chalk'
import type {
  createHarnessRuntimes,
  doctorHarnessHost,
  prepareHarnessHost,
  HarnessSelection,
} from 'oorja-harness-host/harnesses'
import type {HarnessHost, HarnessHostOptions} from 'oorja-harness-host/host'
import type {HarnessCommand, HarnessEvent} from 'oorja-harness-host/messages'
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

export type HarnessHostConnectionOptions = {
  userId: string
  machineId: string
  roomKey: RoomKey
  process: NodeJS.Process
  multiplayer: boolean
  stateFile: string
  joinChannel: JoinChannel
}

type HarnessHostPackage = {
  HarnessHost: {start: (options: HarnessHostOptions) => Promise<HarnessHost>}
  createHarnessRuntimes: typeof createHarnessRuntimes
  doctorHarnessHost: typeof doctorHarnessHost
  prepareHarnessHost: typeof prepareHarnessHost
}

export const loadHarnessHost = async () => {
  const packageName = 'oorja-harness-host'
  try {
    import.meta.resolve(packageName)
  } catch (error) {
    throw new Error('Harness hosting is not installed. Install it with: npm install --global oorja-harness-host', {
      cause: error,
    })
  }
  return import(packageName) as Promise<HarnessHostPackage>
}

export const checkHarnessPrerequisites = async (cwd: string, selections: HarnessSelection[] = ['all']) => {
  const {doctorHarnessHost} = await loadHarnessHost()
  const results = await doctorHarnessHost(cwd)
  const failures = new Map<string, string>()
  for (const {harnessId, checks} of results) {
    if (!selections.includes('all') && !selections.includes(harnessId)) {
      continue
    }
    for (const check of checks) {
      if (!check.ok) {
        failures.set(
          check.name,
          check.name === 'pnpm'
            ? 'pnpm is required to prepare agent runtimes. Install it with: npm install --global pnpm'
            : check.detail,
        )
      }
    }
  }
  if (failures.size) {
    throw new Error([...failures.values()].join('\n'))
  }
}

export class HarnessHostConnection {
  private channel!: Channel
  private sharedHost!: SharedHarnessHost
  private readonly finished = new Future<null>()
  private stopped = false
  private standalone = false

  constructor(private readonly options: HarnessHostConnectionOptions) {}

  start = async () => {
    const spinner = ora('Preparing Harness Host').start()
    try {
      this.sharedHost = await SharedHarnessHost.open({
        socketPath: localSocketPath(this.options.stateFile, this.options.machineId),
        roomId: this.options.roomKey.roomId,
        workdir: this.options.process.cwd(),
        createHost: async (emit) => {
          const {HarnessHost, createHarnessRuntimes, prepareHarnessHost} = await loadHarnessHost()
          await checkHarnessPrerequisites(this.options.process.cwd())
          await prepareHarnessHost(this.options.process.cwd())
          return HarnessHost.start({
            hostId: this.options.machineId,
            hostname: `${os.userInfo().username}@${os.hostname()}`,
            workdir: this.options.process.cwd(),
            stateFile: this.options.stateFile,
            runtimes: createHarnessRuntimes(),
            onError: (error) => {
              logger.error('harness.error', error)
            },
            emit,
          })
        },
      })
      spinner.stop()
    } catch (error) {
      spinner.fail('Could not start Harness Host')
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

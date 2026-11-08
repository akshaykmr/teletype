import * as os from 'node:os'

import chalk from 'chalk'
import type {createHarnessRuntimes, doctorHarnessHost, prepareHarnessHost} from 'oorja-harness-host/harnesses'
import type {HarnessHost, HarnessHostOptions} from 'oorja-harness-host/host'
import type {HarnessCommand, HarnessEvent} from 'oorja-harness-host/messages'
import type {Channel} from 'phoenix'

import type {JoinChannel} from 'oorja/lib/connect/index'
import type {RoomKey} from 'oorja/lib/connect/types'
import {decrypt, encrypt} from 'oorja/lib/encryption'
import type {EncryptedPayload} from 'oorja/lib/encryption'
import {exit} from 'oorja/lib/exit'
import {SharedHarnessHost} from 'oorja/lib/harnessHost/sharedHost/index'
import {Future, printExitMessage} from 'oorja/lib/utils'

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

export class HarnessHostConnection {
  private channel!: Channel
  private sharedHost!: SharedHarnessHost
  private readonly finished = new Future<null>()
  private stopped = false

  constructor(private readonly options: HarnessHostConnectionOptions) {}

  start = async () => {
    this.sharedHost = await SharedHarnessHost.open({
      socketPath: localSocketPath(this.options.stateFile, this.options.machineId),
      workdir: this.options.process.cwd(),
      createHost: async (emit) => {
        const {HarnessHost, createHarnessRuntimes} = await loadHarnessHost()
        return HarnessHost.start({
          hostId: this.options.machineId,
          hostname: `${os.userInfo().username}@${os.hostname()}`,
          workdir: this.options.process.cwd(),
          stateFile: this.options.stateFile,
          runtimes: createHarnessRuntimes(),
          onError: (error) => console.error('Harness host error:', error),
          emit,
        })
      },
    })
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
      handleSessionJoin: this.handleSessionJoin,
      handleSessionLeave: this.handleSessionLeave,
    })
    this.sharedHost.listen(this.broadcastEvent)
  }

  run = async () => {
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
    console.log(`Harness command received from ${session}: ${command.type}.`)
    this.sharedHost.handleCommand(command)
  }

  private handleJoin = () => {
    console.log('Harness host ready.')
    this.sendCurrentState()
  }

  private handleSessionJoin = (session: string) => {
    console.log(`Channel peer joined: ${session}.`)
    this.sendCurrentState()
  }

  private handleSessionLeave = (session: string) => {
    console.log(`Channel peer left: ${session}.`)
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

    printExitMessage(
      chalk.redBright(`unexpected input from user: ${userId}, terminating host for safety. Please report this issue`),
    )
    void this.stop().then(() => exit(5))
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

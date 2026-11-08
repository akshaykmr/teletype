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

export type HarnessHostRunnerOptions = {
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

export class HarnessHostRunner {
  static open = async (options: HarnessHostRunnerOptions) => {
    const sharedHost = await SharedHarnessHost.open({
      socketPath: localSocketPath(options.stateFile, options.machineId),
      workdir: options.process.cwd(),
      createHost: async (emit) => {
        const {HarnessHost, createHarnessRuntimes} = await loadHarnessHost()
        return HarnessHost.start({
          hostId: options.machineId,
          hostname: `${os.userInfo().username}@${os.hostname()}`,
          workdir: options.process.cwd(),
          stateFile: options.stateFile,
          runtimes: createHarnessRuntimes(),
          onError: (error) => console.error('Harness host error:', error),
          emit,
        })
      },
    })
    const runner = new HarnessHostRunner(options, sharedHost)
    sharedHost.listen(runner.broadcastEvent)
    return runner
  }

  private readonly channel: Channel
  private readonly finished = new Future<null>()
  private stopped = false

  private constructor(
    private readonly options: HarnessHostRunnerOptions,
    private readonly sharedHost: SharedHarnessHost,
  ) {
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
  }

  run = async () => {
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

  private handleMessage = ({from: {session}, t, d, e}: HarnessChannelMessage) => {
    if (t !== 'harness' || !e || !this.ensureCanWrite(session)) {
      return
    }
    const command = decrypt(d, this.options.roomKey) as HarnessCommand
    console.log(`Harness command received from ${session}: ${command.type}.`)
    this.sharedHost.handleCommand(command)
  }

  private handleJoin = () => {
    console.log('Harness host ready.')
    this.broadcastState()
  }

  private handleSessionJoin = (session: string) => {
    console.log(`Channel peer joined: ${session}.`)
    this.broadcastState()
  }

  private handleSessionLeave = (session: string) => {
    console.log(`Channel peer left: ${session}.`)
    this.broadcastState()
  }

  private broadcastState = () => {
    this.sharedHost.emitState()
  }

  private broadcastEvent = (event: HarnessEvent) => {
    this.channel.push('new_msg', {
      b: true,
      t: 'harness',
      e: true,
      d: encrypt(event, this.options.roomKey),
    })
    if (event.type === 'host.state') {
      console.log(`Harness state sent to the room: ${event.sessions.length} session(s).`)
    }
  }

  private ensureCanWrite = (session: string) => {
    const {userId, clientType} = getSessionIdentity(session)
    if (clientType === 'user' && (userId === this.options.userId || this.options.multiplayer)) {
      return true
    }

    printExitMessage(
      chalk.redBright(
        clientType === 'task'
          ? `unexpected input from user: ${userId} with task-token, terminating host for safety. Please report this issue`
          : `unexpected input from user: ${userId}, terminating host for safety. Please report this issue`,
      ),
    )
    void this.stop().then(() => exit(5))
    return false
  }
}

type HarnessChannelMessage = {
  from: {session: string}
  t: string
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

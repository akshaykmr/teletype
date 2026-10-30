import * as os from 'node:os'

import chalk from 'chalk'
import type {HarnessCommand, HarnessHost} from 'oorja-harness-host'
import type {Channel} from 'phoenix'

import type {JoinChannel} from 'oorja/lib/connect/index'
import type {RoomKey} from 'oorja/lib/connect/types'
import {decrypt, encrypt} from 'oorja/lib/encryption'
import type {EncryptedPayload} from 'oorja/lib/encryption'
import {exit} from 'oorja/lib/exit'
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

export const loadHarnessHost = async () => {
  try {
    import.meta.resolve('oorja-harness-host')
  } catch (error) {
    throw new Error('Harness hosting is not installed. Install it with: npm install --global oorja-harness-host', {
      cause: error,
    })
  }
  return import('oorja-harness-host')
}

export class HarnessHostRunner {
  private channel!: Channel
  private host!: HarnessHost
  private readonly finished = new Future<null>()
  private stopped = false

  constructor(private readonly options: HarnessHostRunnerOptions) {}

  start = async () => {
    const {HarnessHost, createHarnessRuntimes} = await loadHarnessHost()
    this.host = await HarnessHost.start({
      hostId: this.options.machineId,
      hostname: `${os.userInfo().username}@${os.hostname()}`,
      stateFile: this.options.stateFile,
      runtimes: createHarnessRuntimes(this.options.process.cwd()),
      onError: (error) => console.error('Harness host error:', error),
      emit: (event) => {
        if (event.type === 'host.state') {
          console.log(`Harness state sent to the room: ${event.sessions.length} session(s).`)
        }
        this.channel.push('new_msg', {
          b: true,
          t: 'harness',
          e: true,
          d: encrypt(event, this.options.roomKey),
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
  }

  run = async () => {
    await this.start()
    this.options.process.once('SIGINT', this.stop)
    this.options.process.once('SIGTERM', this.stop)
    return this.finished.promise
  }

  private handleMessage = ({from: {session}, t, d, e}: HarnessChannelMessage) => {
    if (t !== 'harness' || !e || !this.ensureCanWrite(session)) {
      return
    }
    const command = decrypt(d, this.options.roomKey) as HarnessCommand
    console.log(`Harness command received from ${session}: ${command.type}.`)
    void this.host.handleCommand(command)
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
    const state = this.host.getState()
    this.channel.push('new_msg', {
      b: true,
      t: 'harness',
      e: true,
      d: encrypt(state, this.options.roomKey),
    })
    console.log(`Harness state sent to the room: ${state.sessions.length} session(s).`)
  }

  private ensureCanWrite = (session: string) => {
    const {userId, userType} = getSessionIdentity(session)
    if (userId === this.options.userId || (this.options.multiplayer && userType !== 'task')) {
      return true
    }

    printExitMessage(
      chalk.redBright(
        userType === 'task'
          ? `unexpected input from user: ${userId} with task-token, terminating host for safety. Please report this issue`
          : `unexpected input from user: ${userId}, terminating host for safety. Please report this issue`,
      ),
    )
    void this.stop().then(() => exit(5))
    return false
  }

  stop = async () => {
    if (this.stopped) {
      return
    }
    this.stopped = true
    this.options.process.removeListener('SIGINT', this.stop)
    this.options.process.removeListener('SIGTERM', this.stop)
    await this.host.stop()
    this.channel.leave(1000)
    this.finished.resolve?.(null)
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

const getSessionIdentity = (session: string) => {
  const [userId, , userType] = session.split(':')
  return {userId, userType}
}

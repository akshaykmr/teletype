import * as os from 'node:os'

import type {HarnessCommand, HarnessHost, HarnessRuntime} from 'oorja-harness-host'
import type {Channel} from 'phoenix'

import type {JoinChannelOptions} from 'oorja/lib/connect/index'
import type {RoomKey} from 'oorja/lib/connect/types'
import {decrypt, encrypt} from 'oorja/lib/encryption'
import type {EncryptedPayload} from 'oorja/lib/encryption'
import {loadHarnessHost} from 'oorja/lib/harnessHostPackage'

export type HarnessHostRunnerOptions = {
  userId: string
  machineId: string
  roomKey: RoomKey
  process: NodeJS.Process
  runtimes: HarnessRuntime[]
  resumeStateDirectory: string
  joinChannel: (options: JoinChannelOptions<Record<string, unknown>, unknown>) => Channel
}

export class HarnessHostRunner {
  private channel!: Channel
  private host!: HarnessHost
  private resolve?: (value: null) => void
  private stopped = false

  constructor(private readonly options: HarnessHostRunnerOptions) {}

  run = async () => {
    const {HarnessHost, createFileResumeStateStore} = await loadHarnessHost()
    this.host = new HarnessHost({
      hostId: this.options.machineId,
      hostname: `${os.userInfo().username}@${os.hostname()}`,
      runtimes: this.options.runtimes,
      resumeStates: createFileResumeStateStore(this.options.resumeStateDirectory),
      onError: (error) => console.error('Harness host error:', error),
      emit: (event) => {
        if (event.type === 'host.state') {
          console.log(`Harness state sent to the room: ${event.sessions.length} session(s).`)
        }
        this.channel.push('new_msg', {
          b: true,
          t: 'harness',
          d: encrypt(event, this.options.roomKey),
        })
      },
    })

    return new Promise<null>((resolve) => {
      this.resolve = resolve
      this.channel = this.options.joinChannel({
        channel: `teletype:${this.options.roomKey.roomId}`,
        params: {
          username: os.userInfo().username,
          hostname: os.hostname(),
          harness_host: true,
        },
        onJoin: this.handleJoin,
        onClose: this.stop,
        onError: this.stop,
        onMessage: this.handleMessage,
        handleSessionJoin: this.handleSessionJoin,
        handleSessionLeave: this.handleSessionLeave,
      })
      this.options.process.once('SIGINT', this.stop)
      this.options.process.once('SIGTERM', this.stop)
    })
  }

  private handleMessage = ({from: {session}, t, d}: HarnessChannelMessage) => {
    if (t !== 'harness' || getUserId(session) !== this.options.userId) return
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
      d: encrypt(state, this.options.roomKey),
    })
    console.log(`Harness state sent to the room: ${state.sessions.length} session(s).`)
  }

  private stop = () => {
    if (this.stopped) return
    this.stopped = true
    this.options.process.removeListener('SIGINT', this.stop)
    this.options.process.removeListener('SIGTERM', this.stop)
    void this.host.stop().finally(() => {
      this.channel.leave(1000)
      this.resolve?.(null)
    })
  }
}

type HarnessChannelMessage = {
  from: {session: string}
  t: string
  d: EncryptedPayload
}

const getUserId = (session: string) => session.split(':')[0]

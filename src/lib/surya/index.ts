// backend api client
import https from 'https'
import axios, {AxiosError, AxiosInstance} from 'axios'
import {encode, decode} from '@msgpack/msgpack'

import {defaultParser} from './resources.js'
import {User, RoomApps, Room, CliManifest} from './types.js'
import {SuryaConfig, env, getSuryaConfig} from '../config.js'
import {Unauthorized, BadRequest} from './errors.js'
import {Socket, Channel, Presence} from './vendor/phoenix/index.js'

import camelcaseKeys from 'camelcase-keys'

export class SuryaError extends Error {}

export class SuryaClient {
  private config: SuryaConfig
  private client: AxiosInstance
  private socket?: Socket

  constructor(env: env) {
    const config = getSuryaConfig(env)
    this.client = axios.create({
      httpsAgent: new https.Agent({
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.2',
      }),
      baseURL: suryaBaseURL(config.host, config.enableTLS),
      timeout: 5000,
      responseType: 'json',
      headers: {
        'x-access-token': config.token || '',
      },
    })
    this.config = config
  }

  fetchCliManifest = async (): Promise<CliManifest> => {
    try {
      const response = await this.client.get('/cli')
      return camelcaseKeys(response.data) as CliManifest
    } catch (error) {
      return handleError(error)
    }
  }

  fetchSessionUser = async (): Promise<User> => {
    try {
      const response = await this.client.get('/session/user')
      return defaultParser(response.data.data) as User
    } catch (error) {
      return handleError(error)
    }
  }

  createRoom = async ({roomName, apps}: CreateRoomOptions): Promise<Room> => {
    const body = {
      room: {
        apps,
        locked: false,
        name: roomName || '-',
      },
    }
    try {
      const response = await this.client.post('/rooms', body)
      return defaultParser(response.data.data) as Room
    } catch (error) {
      return handleError(error)
    }
  }

  createAnonymousUser = async (): Promise<string> => {
    try {
      const response = await this.client.post('/session/anon')
      return response.data.access_token
    } catch (error) {
      return handleError(error)
    }
  }

  accessTokenFromRoomParticipantOTP = async (roomId: string, otp: string): Promise<string> => {
    try {
      const response = await this.client.post('/access_tokens/from_room_participant_otp', {
        room_id: roomId,
        otp: otp,
      })
      return response.data.data.token
    } catch (error) {
      return handleError(error)
    }
  }

  fetchRoom = async (roomId: string): Promise<Room> => {
    try {
      const response = await this.client.get(`/rooms/${roomId}`)
      return defaultParser(response.data.data) as Room
    } catch (error) {
      return handleError(error)
    }
  }

  establishSocket = async (): Promise<void> => {
    const protocolPrefix = this.config.enableTLS ? `wss://` : `ws://`
    const host = this.config.host
    let encodeMessage = (rawdata: any, callback: any) => {
      if (!rawdata) return
      return callback(encode(rawdata))
    }

    let decodeMessage = (rawdata: any, callback: any) => {
      if (!rawdata) return
      const data = new Uint8Array(rawdata)
      return callback(decode(data.buffer))
    }
    return new Promise((resolve, reject) => {
      let initialConnection = false
      this.socket = new Socket(`${protocolPrefix}${host}/socket`, {
        params: {
          access_token: this.config.token,
        },
        heartbeatIntervalMs: 10000,
        binaryType: 'arraybuffer',
        encode: encodeMessage,
        decode: decodeMessage,
      })
      this.socket.onOpen(() => {
        initialConnection = true
        resolve()
      })
      this.socket.onError(() => {
        if (!initialConnection) {
          reject()
          return
        }
        console.error('connection error')
        process.exit(2)
      })
      // @ts-ignore
      this.socket.connect()
    })
  }

  joinChannel = ({
    channel,
    params,
    onJoin,
    onClose,
    onError,
    onMessage,
    handleSessionJoin,
    handleSessionLeave,
  }: JoinChannelOptions<any>): Channel => {
    if (!this.socket) throw Error('no socket connection')
    const chan = this.socket.channel(channel, params)
    if (onError) chan.onError(onError)
    if (onClose) chan.onClose(onClose)

    let presences: any = []

    chan.on('new_msg', (msg: any) => {
      onMessage(msg)
    })

    chan.on('presence_state', (response: any) => {
      Presence.syncState(presences, response, handleSessionJoin, undefined)
      presences = response
    })
    chan.on('presence_diff', (newPresence: any) => {
      presences = Presence.syncDiff(presences, newPresence, handleSessionJoin, handleSessionLeave)
    })

    chan
      .join()
      .receive('ok', () => {
        if (onJoin) onJoin()
      })
      .receive('error', (resp: any) => {
        if (resp && resp.reason === 'unauthorized') {
          if (onError)
            onError(new Unauthorized('unauthorized: user needs to join the room before a stream can be started.'))
          return
        }
        process.exit(3)
      })
    return chan
  }

  destroy = async () => {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.disconnect(resolve, 1000, 'disconnecting surya client')
      } else {
        resolve(undefined)
      }
    })
  }
}

const suryaBaseURL = (host: string, tlsEnabled: boolean) => `${tlsEnabled ? 'https' : 'http'}://${host}/api/v1`

const handleError = (error: unknown) => {
  if (error instanceof AxiosError) {
    const {response} = error
    if (response) {
      switch (response.status) {
        case 401:
          throw new Unauthorized()
        case 400:
          throw new BadRequest()
      }
    }
  }
  throw error
}

export type CreateRoomOptions = {
  roomName: string
  apps: RoomApps
}

// leaving specific types for later,
// when there are more channel users
export type JoinChannelOptions<T> = {
  channel: string
  params: T
  onJoin?: () => void
  onError?: (reason: any) => void
  onClose?: (payload: any, ref: any, joinRef: any) => void
  onMessage: (payload: any) => void
  handleSessionJoin: (session: string) => void
  handleSessionLeave: (session: string) => void
}

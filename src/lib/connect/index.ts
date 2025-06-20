// backend api client
import {Encoder, Decoder} from '@msgpack/msgpack'

const encoder = new Encoder()
const decoder = new Decoder()

import {defaultParser} from './resources.js'
import {User, RoomApps, Room, CliManifest} from './types.js'
import {ConnectConfig, env, getConnectConfig} from '../config.js'
import {Unauthorized, BadRequest} from './errors.js'
import {Socket, Channel, Presence} from 'phoenix'

import camelcaseKeys from 'camelcase-keys'

export class ApiClientError extends Error {}

export class ConnectClient {
  private config: ConnectConfig
  private baseURL: string
  private headers: HeadersInit
  private timeout: number
  private socket?: Socket

  constructor(env: env, region: string) {
    const config = getConnectConfig(env, region)
    this.baseURL = connectBaseURL(config.host)
    this.headers = {
      'x-access-token': config.token || '',
      'Content-Type': 'application/json',
    }
    this.timeout = 5000
    this.config = config
  }

  // Private helper to encapsulate fetch with timeout and consistent error handling.
  private async _fetch(path: string, options: RequestInit = {}) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.baseURL}${path}`, {
        ...options,
        headers: this.headers,
        signal: controller.signal,
      })

      if (!response.ok) {
        // Throw an object that mimics the AxiosError structure for the handleError function.
        throw {response}
      }

      return response
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out')
      }
      throw error // Re-throw other errors (like the custom {response} or network errors)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  fetchCliManifest = async (): Promise<CliManifest> => {
    try {
      const response = await this._fetch('/cli')
      const data = await response.json()
      return camelcaseKeys(data) as CliManifest
    } catch (error) {
      return handleError(error)
    }
  }

  fetchSessionUser = async (): Promise<User> => {
    try {
      const response = await this._fetch('/session/user')
      const data = await response.json()
      return defaultParser(data.data) as User
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
      const response = await this._fetch('/rooms', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await response.json()
      return defaultParser(data.data) as Room
    } catch (error) {
      return handleError(error)
    }
  }

  createAnonymousUser = async (): Promise<string> => {
    try {
      const response = await this._fetch('/session/anon', {method: 'POST'})
      const data = await response.json()
      return data.access_token
    } catch (error) {
      return handleError(error)
    }
  }

  accessTokenFromRoomParticipantOTP = async (roomId: string, otp: string): Promise<string> => {
    try {
      const response = await this._fetch('/access_tokens/from_room_participant_otp', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          otp: otp,
        }),
      })
      const data = await response.json()
      return data.data.token
    } catch (error) {
      return handleError(error)
    }
  }

  fetchRoom = async (roomId: string): Promise<Room> => {
    try {
      const response = await this._fetch(`/rooms/${roomId}`)
      const data = await response.json()
      return defaultParser(data.data) as Room
    } catch (error) {
      return handleError(error)
    }
  }

  establishSocket = async (): Promise<void> => {
    const protocolPrefix = `wss://`
    const host = this.config.host
    const encodeMessage = function (rawdata: any, callback: any) {
      return callback(encoder.encode(rawdata))
    }

    const decodeMessage = function (rawdata: any, callback: any) {
      return callback(decoder.decode(rawdata))
    }
    return new Promise((resolve, reject) => {
      let initialConnection = false
      this.socket = new Socket(`${protocolPrefix}${host}/socket`, {
        params: {
          access_token: this.config.token,
        },
        transport: WebSocket,
        heartbeatIntervalMs: 20_000,
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
        this.socket.disconnect(
          () => {
            resolve(undefined)
          },
          1000,
          'disconnecting connect client',
        )
      } else {
        resolve(undefined)
      }
    })
  }
}

const connectBaseURL = (host: string) => `https://${host}/api/v1`

const handleError = (error: any) => {
  // This function was originally designed for AxiosError.
  // The custom _fetch method now throws an object with a `response` key
  // for HTTP errors (`{ response }`), allowing this logic to remain unchanged.
  if (error?.response) {
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
  handleSessionJoin: (session: string | undefined, _ignore: any, metas: any) => void
  handleSessionLeave: (session: string | undefined) => void
}

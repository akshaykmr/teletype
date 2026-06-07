// backend api client
import {Encoder, Decoder} from '@msgpack/msgpack'

const encoder = new Encoder()
const decoder = new Decoder()

import {defaultParser} from 'oorja/lib/connect/resources'
import {User, RoomApps, Room, CliManifest, NewRoomInviteResponse} from 'oorja/lib/connect/types'
import {ConnectConfig, env, getConnectConfig} from 'oorja/lib/config'
import {Unauthorized, BadRequest} from 'oorja/lib/connect/errors'
import {Socket, Channel, Presence} from 'phoenix'

import camelcaseKeys from 'camelcase-keys'
import {printExitMessage} from 'oorja/lib/utils'
import {exit} from 'oorja/lib/exit'

export class ApiClientError extends Error {}

export class ConnectClient {
  private config: ConnectConfig
  private baseURL: string
  private headers: Record<string, string>
  private timeout: number
  private socket?: Socket
  private accessToken: string

  constructor(env: env, region: string, token: string) {
    const config = getConnectConfig(env, region)
    this.baseURL = connectBaseURL(config.host, config.useHttps)
    this.headers = {
      'x-access-token': token || '',
      'Content-Type': 'application/json',
    }
    this.accessToken = token || ''
    this.timeout = 5000
    this.config = config
  }

  setAccessToken = (token: string) => {
    this.accessToken = token
    this.headers['x-access-token'] = token
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
      const response = await this._fetch('/v1/cli')
      const data = await response.json()
      return camelcaseKeys(data) as CliManifest
    } catch (error) {
      return handleError(error)
    }
  }

  fetchSessionUser = async (v2 = false): Promise<User> => {
    const path = v2 ? '/v2/session/user_profile' : '/v1/session/user'
    try {
      const response = await this._fetch(path)
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
      const response = await this._fetch('/v1/rooms', {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await response.json()
      return defaultParser(data.data) as Room
    } catch (error) {
      return handleError(error)
    }
  }

  createInviteCode = async ({roomId}: {roomId: string}): Promise<NewRoomInviteResponse> => {
    const body = {
      participant_access: 'can_edit',
    }
    try {
      const response = await this._fetch(`/v1/rooms/${roomId}/invites`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await response.json()
      return defaultParser(data) as NewRoomInviteResponse
    } catch (error) {
      return handleError(error)
    }
  }

  createAnonymousUser = async (): Promise<string> => {
    try {
      const response = await this._fetch('/v1/session/anon', {method: 'POST'})
      const data = await response.json()
      return data.access_token
    } catch (error) {
      return handleError(error)
    }
  }

  fetchRoom = async (roomId: string): Promise<Room> => {
    try {
      const response = await this._fetch(`/v1/rooms/${roomId}`)
      const data = await response.json()
      return defaultParser(data.data) as Room
    } catch (error) {
      return handleError(error)
    }
  }

  establishSocket = async (): Promise<void> => {
    const protocolPrefix = this.config.useHttps ? 'wss://' : 'ws://'
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
          access_token: this.accessToken,
        },
        transport: WebSocket,
        heartbeatIntervalMs: 7500,
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
        printExitMessage('connection error')
        exit(2)
      })
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
  }: JoinChannelOptions<unknown, unknown>): Channel => {
    if (!this.socket) throw Error('no socket connection')
    const chan = this.socket.channel(channel, params!)
    if (onError) chan.onError(onError)
    if (onClose) chan.onClose(onClose)

    chan.on('new_msg', (msg: any) => {
      onMessage(msg)
    })

    const presence = new Presence(chan)

    // https://hexdocs.pm/phoenix/js/index.html#handling-individual-presence-join-and-leave-events
    presence.onJoin((key, current, newPres) => {
      if (!current) {
        handleSessionJoin(key!, current, newPres)
      }
    })
    presence.onLeave((key, current, leftPres) => {
      if (current.metas.length === 0) {
        handleSessionLeave(key!, current, leftPres)
      }
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
        printExitMessage('error on channel')
        exit(3)
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

const connectBaseURL = (host: string, useHttps: boolean) => `http${useHttps ? 's' : ''}://${host}/api`

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
export type JoinChannelOptions<Params, Metas> = {
  channel: string
  params: Params
  onJoin?: () => void
  onError?: (reason: any) => void
  onClose?: (payload: any, ref: any, joinRef: any) => void
  onMessage: (payload: any) => void
  handleSessionJoin: (session: string, currentMetas: undefined | Metas, newMetas: Metas) => void
  handleSessionLeave: (session: string, currentMetas: undefined | Metas, leftMetas: Metas) => void
}

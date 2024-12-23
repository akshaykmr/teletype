import {
  env,
  determineENV,
  getoorjaConfig,
  oorjaConfig,
  INVALID_ROOM_LINK_MESSAGE,
  setENVAccessToken,
} from '../config.js'
import {User, RoomKey} from '../connect/types.js'
import {teletypeApp, TeletypeOptions} from '../teletype/index.js'
import {CreateRoomOptions, ConnectClient} from '../connect/index.js'
import {URL, URLSearchParams} from 'url'
import {importKey, createRoomKey, exportKey} from '../encryption.js'
import {loginByRoomOTP, preflight, promptAuth, resumeSession, validateCliVersion} from './preflight.js'

export class InvalidRoomLink extends Error {}

class OORJA {
  // should capture domain related commands and queries
  constructor(
    private config: oorjaConfig,
    private connectClient: ConnectClient,
    public user: User,
  ) {}

  createRoom = async (options: CreateRoomOptions) => {
    const room = await this.connectClient.createRoom(options)
    const roomKey = createRoomKey(room.id)
    return {
      room,
      roomKey,
    }
  }

  linkForRoom = (roomKey: RoomKey): string => {
    return `${oorjaURL(this.config)}/rooms?id=${roomKey.roomId}#${exportKey(roomKey.key)}`
  }

  getRoomKey(roomLink: string): RoomKey {
    const url = parseRoomURL(roomLink)
    return {
      key: importKey(url.hash),
      roomId: getRoomId(url) as string,
    }
  }

  teletype = (options: Omit<TeletypeOptions, 'userId' | 'joinChannel'>) => {
    return teletypeApp({
      userId: this.user!.id,
      joinChannel: this.connectClient.joinChannel,
      ...options,
    })
  }
}

const parseRoomURL = (roomLink: string): URL => {
  const url = new URL(roomLink)
  if (!url.hash || !getRoomId(url)) {
    console.log(INVALID_ROOM_LINK_MESSAGE)
    process.exit(3)
  }
  return url
}

const getRoomId = (roomURL: URL) => {
  const params = new URLSearchParams(roomURL.search)
  return params.get('id') || undefined
}

const oorjaURL = (config: oorjaConfig) => {
  const {host} = config!
  return `https://${host}`
}

const linkForTokenGen = (config: oorjaConfig) => `${oorjaURL(config)}/access_token`

const init = async (env: env, options: {roomId?: string} = {}) => {
  const config = getoorjaConfig(env)
  let connectClient = new ConnectClient(env)

  await validateCliVersion(connectClient)
  let user = await resumeSession(env, connectClient, options.roomId)

  if (!user) {
    let token: string = ''
    if (options.roomId) {
      token = await loginByRoomOTP(connectClient, options.roomId)
    } else {
      token = await promptAuth(connectClient, linkForTokenGen(config))
      if (!token) {
        console.log('Token not provided :(')
        process.exit(12)
      }
    }
    setENVAccessToken(env, token)
  }
  await connectClient.destroy()
  connectClient = new ConnectClient(env)
  user = await preflight(env, connectClient)
  return new OORJA(config, connectClient, user)
}

let currentEnv: env
let oorja: OORJA | null = null

export const getApp = async (options: {roomLink?: string} = {}): Promise<OORJA> => {
  const {roomLink} = options
  const roomURL = roomLink ? parseRoomURL(roomLink) : undefined
  const env = determineENV(undefined)
  if (oorja) {
    if (env !== currentEnv) {
      return Promise.reject('Attempt to run different env in same session')
    }
    return Promise.resolve(oorja)
  }
  const app = await init(env, {roomId: roomURL ? getRoomId(roomURL) : undefined})
  currentEnv = env
  oorja = app
  return app
}

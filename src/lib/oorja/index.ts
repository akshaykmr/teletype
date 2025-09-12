import {getoorjaConfig, oorjaConfig, INVALID_STREAM_KEY_MESSAGE, Config} from '../config.js'
import {RoomKey, UserProfile} from '../connect/types.js'
import {teletypeApp, TeletypeOptions} from '../teletype/index.js'
import {CreateRoomOptions, ConnectClient} from '../connect/index.js'
import {importKey, createRoomKey, exportKey} from '../encryption.js'
import {preflight, promptAuth, validateCliVersion} from './preflight.js'
import {getRegion} from './client.js'
import ora from 'ora'
import {Future, printExitMessage} from '../utils.js'
import {Unauthorized} from '../connect/errors.js'

export class InvalidRoomLink extends Error {}

export class OORJA {
  // should capture domain related commands and queries
  constructor(
    private config: oorjaConfig,
    private connectClient: ConnectClient,
    public user: UserProfile,
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

  getRoomKey(streamKey: StreamKey): RoomKey {
    return {
      key: importKey(streamKey.encryptionSecret),
      roomId: streamKey.roomId,
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

type StreamKey = {
  roomId: string
  token: string
  encryptionSecret: string
}

export const parseStreamKey = (streamKey: string): StreamKey => {
  if (!streamKey.startsWith('sk-')) {
    printExitMessage(INVALID_STREAM_KEY_MESSAGE)
    process.exit(3)
  }

  const parts = streamKey.split(':')
  if (parts.length !== 2) {
    printExitMessage(INVALID_STREAM_KEY_MESSAGE)
    process.exit(3)
  }

  const [token, rest] = parts
  const [roomId, encryptionSecret] = rest.split('#')

  if (!roomId || !encryptionSecret) {
    printExitMessage(INVALID_STREAM_KEY_MESSAGE)
    process.exit(3)
  }

  return {
    roomId,
    token,
    encryptionSecret,
  }
}

const oorjaURL = (config: oorjaConfig) => {
  const {host} = config!
  return `https://${host}`
}

const linkForTokenGen = (config: oorjaConfig) => `${oorjaURL(config)}/access_token`

export class App {
  connectionCheckFuture: Future<UserProfile | null> = new Future()

  private connectClient: ConnectClient | null = null

  constructor(private config: Config) {
    this.establishConnection()
  }

  init = async (streamKey?: StreamKey): Promise<OORJA> => {
    const spinner = ora({
      text: 'Connecting...',
      discardStdin: true,
    }).start()
    await this.connectionCheckFuture.promise
    spinner.succeed('Online')

    const oorjaConfig = getoorjaConfig(this.config.getEnv())

    let user: UserProfile | null = null
    if (!streamKey) {
      user = await this.tryResumeSession()
      if (!user) {
        const token = await promptAuth(this.connectClient!, linkForTokenGen(oorjaConfig))
        if (!token) {
          printExitMessage('Token not provided :(')
          process.exit(12)
        }
        this.config.setAccessToken(token)
        this.connectClient!.setAccessToken(token)
      }
    } else {
      this.connectClient!.setAccessToken(streamKey.token)
    }

    user = await preflight(user, this.config, this.connectClient!)
    return new OORJA(oorjaConfig, this.connectClient!, user)
  }

  private establishConnection = async () => {
    try {
      const region = await getRegion()
      const connectClient = new ConnectClient(this.config.getEnv(), region)
      await validateCliVersion(connectClient)
      this.connectClient = connectClient
    } catch (e) {
      this.connectionCheckFuture.reject!(e)
    }
  }

  private tryResumeSession = async (): Promise<UserProfile | null> => {
    const personalAccessToken = this.config.getAccessToken()
    if (!personalAccessToken) return null
    try {
      return await this.connectClient!.fetchSessionUser()
    } catch (e) {
      if (e instanceof Unauthorized) {
        this.config.setAccessToken('') // reset
      }
      throw e
    }
  }
}

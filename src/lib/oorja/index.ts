import {getoorjaConfig, oorjaConfig, INVALID_STREAM_KEY_MESSAGE, Config} from 'oorja/lib/config'
import {RoomKey, UserProfile} from 'oorja/lib/connect/types'
import {TeletypeSession, TeletypeOptions} from 'oorja/lib/teletype/index'
import {CreateRoomOptions, ConnectClient} from 'oorja/lib/connect/index'
import {importKey, createRoomKey, exportKey} from 'oorja/lib/encryption'
import {createAnonymousSession, promptAuth, validateCliVersion} from 'oorja/lib/oorja/preflight'
import {getRegion} from 'oorja/lib/oorja/client'
import ora from 'ora'
import {Future, printExitMessage} from 'oorja/lib/utils'
import {Unauthorized} from 'oorja/lib/connect/errors'
import {exit} from 'oorja/lib/exit'
import chalk from 'chalk'

export class InvalidRoomLink extends Error {}

export type AuthMode = 'prompt' | 'anonymous'

type AppInitOptions = {
  streamKey?: StreamKey
  authMode?: AuthMode
}

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
    const {
      data: {inviteCode},
    } = await this.connectClient.createInviteCode({roomId: room.id})
    return {
      room,
      roomKey,
      inviteCode,
    }
  }

  linkForRoom = (roomKey: RoomKey, inviteCode: string): string => {
    return `${oorjaURL(this.config)}/rooms?id=${roomKey.roomId}&inviteCode=${inviteCode}#${exportKey(roomKey.key)}`
  }

  getRoomKey(streamKey: StreamKey): RoomKey {
    return {
      key: importKey(streamKey.encryptionSecret),
      roomId: streamKey.roomId,
    }
  }

  teletype = (options: Omit<TeletypeOptions, 'userId' | 'joinChannel'>) => {
    return new TeletypeSession({
      userId: this.user!.id,
      joinChannel: this.connectClient.joinChannel,
      ...options,
    }).run();
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
    exit(3)
  }

  const parts = streamKey.split(':')
  if (parts.length !== 2) {
    printExitMessage(INVALID_STREAM_KEY_MESSAGE)
    exit(3)
  }

  const [token, rest] = parts
  const [roomId, encryptionSecret] = rest.split('#')

  if (!roomId || !encryptionSecret) {
    printExitMessage(INVALID_STREAM_KEY_MESSAGE)
    exit(3)
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
  connectionCheckFailed: boolean = false
  connectionCheckFuture: Future<void>

  private connectClient: ConnectClient | null = null

  constructor(private config: Config) {
    this.establishConnection()
    this.connectionCheckFuture = new Future()
  }

  init = async (options: AppInitOptions = {}): Promise<OORJA> => {
    const {streamKey} = options
    let spinner = ora({
      text: 'Checking connectivity..',
      discardStdin: true,
    }).start()
    await this.connectionCheckFuture.promise
    if (this.connectionCheckFailed) {
      spinner.fail(
        'There seems to be a connection issue. Check your connection or try again later. Does https://connect.oorja.io  load for you?',
      )
      exit(56)
      return Promise.reject()
    }
    spinner.succeed('Online')

    const oorjaConfig = getoorjaConfig(this.config.getEnv())
    const authMode = options.authMode || 'prompt'
    const isControlledMode = authMode !== 'anonymous' && this.config.hasInjectedAccessToken()

    let user: UserProfile | undefined = undefined

    try {
      if (!streamKey) {
        user = authMode === 'anonymous' ? undefined : await this.tryResumeSession(isControlledMode)
        if (!user) {
          const token =
            authMode === 'anonymous'
              ? await createAnonymousSession(this.connectClient!)
              : await promptAuth(this.connectClient!, linkForTokenGen(oorjaConfig))
          if (!token) {
            printExitMessage('Token not provided :(')
            exit(12)
          }
          this.config.setAccessToken(token)
          this.connectClient!.setAccessToken(token)
          spinner = ora({
            text: 'Authenticating',
            discardStdin: false,
          }).start()
          user = await this.connectClient?.fetchSessionUser()
        }
      } else {
        spinner = ora({
          text: 'Authenticating',
          discardStdin: false,
        }).start()
        this.connectClient!.setAccessToken(streamKey.token)
        user = await this.connectClient?.fetchSessionUser(true)
      }
    } catch (e) {
      if (!isControlledMode) {
        this.config.setAccessToken('')
      }
      if (e instanceof Unauthorized) {
        spinner.fail()
        printExitMessage(
          isControlledMode
            ? 'The provided access token failed authentication.'
            : 'Your access token failed authentication, resetting...',
        )
        exit(33)
        return Promise.reject()
      } else {
        spinner.fail()
        printExitMessage('Something went wrong :(')
      }
      throw e
    }
    spinner.succeed(`Authenticated ✅: Welcome ${user!.name}`)
    if (user!.profileType === 'anon') {
      // don't persist tokens for anonymous users
      this.config.setAccessToken('')
      console.log(chalk.yellowBright("You're an anonymous user. CLI will not remember the auth-token"))
    }
    await this.socketConnect()
    return new OORJA(oorjaConfig, this.connectClient!, user!)
  }

  private establishConnection = async () => {
    try {
      const region = await getRegion()
      const connectClient = new ConnectClient(this.config.getEnv(), region, this.config.getAccessToken())
      await validateCliVersion(connectClient)
      this.connectClient = connectClient
    } catch {
      this.connectionCheckFailed = true
    } finally {
      this.connectionCheckFuture.resolve!()
    }
  }

  private tryResumeSession = async (isControlledMode: boolean): Promise<UserProfile | undefined> => {
    const personalAccessToken = this.config.getAccessToken()
    if (!personalAccessToken) return
    try {
      return await this.connectClient!.fetchSessionUser()
    } catch (e) {
      if (e instanceof Unauthorized) {
        if (isControlledMode) {
          throw e
        }
        this.config.setAccessToken('') // reset
        return
      }
      throw e
    }
  }

  private socketConnect = async () => {
    const spinner = ora({
      text: 'Connecting..',
      discardStdin: false,
    }).start()
    return this.connectClient!.establishSocket()
      .then(() => {
        spinner.succeed('Connected').clear()
        return
      })
      .catch((e) => {
        spinner.fail('Socket connection failure..')
        exit(61)
        return Promise.reject(e)
      })
  }
}

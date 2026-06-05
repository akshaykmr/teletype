import chalk from 'chalk'
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'fs'
import path from 'path'

export const CLI_VERSION = 2.9

export type env = 'local' | 'prod'

export const SUPAKIT_ACCESS_TOKEN_ENV = 'SUPAKIT_ACCESS_TOKEN'
export const SUPAKIT_ENV_ENV = 'SUPAKIT_ENV'

const envFromValue = (value: string | undefined): env | undefined => {
  if (value === 'local' || value === 'prod') {
    return value
  }
  return undefined
}

export class Config {
  streamKeyAuth: boolean = false

  private configPath: string
  private config: Record<string, any> = {}

  constructor(configDir: string) {
    this.configPath = path.join(configDir, 'config.json')
    this.loadConfig()
  }

  private loadConfig() {
    try {
      const data = readFileSync(this.configPath, 'utf8')
      this.config = JSON.parse(data)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Config file doesn't exist, create it with default values
        const dir = path.dirname(this.configPath)
        if (!existsSync(dir)) {
          mkdirSync(dir, {recursive: true})
        }
        this.saveConfig()
      } else {
        console.error(chalk.redBright('Error loading config:'), error.message, this.configPath)
      }
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8')
    } catch (error: any) {
      console.error(chalk.redBright('Error saving config:'), error.message)
    }
  }

  getEnv = (): env => {
    return envFromValue(process.env[SUPAKIT_ENV_ENV]) || envFromValue(this.config['env']) || 'prod'
  }

  getAccessToken = () => {
    if (process.env[SUPAKIT_ACCESS_TOKEN_ENV]) {
      return process.env[SUPAKIT_ACCESS_TOKEN_ENV]
    }
    return (this.config[`${this.getEnv()}-access-token`] as string) || ''
  }

  hasInjectedAccessToken = () => {
    return Boolean(process.env[SUPAKIT_ACCESS_TOKEN_ENV])
  }

  setAccessToken = (token: string) => {
    this.config[`${this.getEnv()}-access-token`] = token
    this.saveConfig()
  }
}

export type ConnectConfig = {
  useHttps: boolean
  host: string
}

export const getConnectConfig = (env: env, region: string): ConnectConfig => {
  const getHost = (env: env) => {
    switch (env) {
      case 'local':
        return 'localhost:4000'
      case 'prod':
      default:
        return region ? `${region}.connect.oorja.io` : 'connect.oorja.io'
    }
  }
  const host = getHost(env)
  return {
    useHttps: host.includes('oorja.io'),
    host,
  }
}

export const STREAM_KEY_SAMPLE = 'sk-xxxx:space-id#encryption-secret'

export const INVALID_STREAM_KEY_MESSAGE = `${chalk.redBright(
  'invalid stream-key ',
)}🤔. It should look like: ${chalk.blue(STREAM_KEY_SAMPLE)}`

export type oorjaConfig = {
  host: string
}

export const getoorjaConfig = (env: env): oorjaConfig => {
  let host: string
  switch (env) {
    case 'local':
      host = 'localhost:3000'
      break
    case 'prod':
      host = 'supakit.app'
      break
  }
  return {
    host,
  }
}

import chalk from 'chalk'
import {URL} from 'url'

export const CLI_VERSION = 2.1

import Conf from 'conf'

export const config = new Conf<string>({
  projectName: 'oorja',
  schema: {
    env: {
      type: 'string',
    },
    'staging-access-token': {
      type: 'string',
    },
    'prod-access-token': {
      type: 'string',
    },
  },
})

export type env = 'local' | 'prod'

export type ConnectConfig = {
  host: string
  token: string
}

export const getConnectConfig = (env: env, region: string): ConnectConfig => {
  const getHost = (env: env) => {
    switch (env) {
      case 'local':
        return 'connect-staging.oorja.io'
      case 'prod':
        return region ? `${region}.connect.oorja.io` : 'connect.oorja.io'
    }
  }
  return {
    host: getHost(env),
    token: getENVAccessToken(env),
  }
}

export const ROOM_LINK_SAMPLE = 'https://oorja.io/spaces?id=foo#key'

export const INVALID_ROOM_LINK_MESSAGE = `${chalk.redBright(
  'invalid url ',
)}🤔. It should look like: ${chalk.blue(ROOM_LINK_SAMPLE)}`

export const determineENV = (roomURL?: URL): env => {
  if (!roomURL) return (config.get('env') as env) || 'prod'
  switch (roomURL.host) {
    case 'oorja.io':
    case 'teletype.oorja.io':
      return 'prod'
    case 'localhost:3000':
      return 'local'
    default:
      console.error(INVALID_ROOM_LINK_MESSAGE)
      process.exit(1)
  }
}

export const getENVAccessToken = (env: env) => {
  return (config.get(`${env}-access-token`) as string) || ''
}

export const setENVAccessToken = (env: env, token: string) => {
  config.set(`${env}-access-token`, token)
}

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
      host = 'oorja.io'
      break
  }
  return {
    host,
  }
}

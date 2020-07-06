import chalk = require('chalk');

const Conf = require('conf');
export const config = new Conf();

let SURYA_URL: string = '';
let ACCESS_TOKEN: string = '';

export type SuryaConfig = {
  url: string;
  token: string;
}

export const getSuryaConfig = (): SuryaConfig => {
  return {
    url: SURYA_URL,
    token: ACCESS_TOKEN
  }
}

export type env = "staging" | "prod" | "local"

export const ROOM_LINK_SAMPLE = "https://oorja.io/rooms?id=foo";

export const INVALID_ROOM_LINK_MESSAGE = `${chalk.redBright(
  "invalid url "
)}🤔. It should look like: ${chalk.blue(ROOM_LINK_SAMPLE)}`;

export const determineENV = (roomURL?: URL): env => {
  if (!roomURL) return config.get("env") || "prod"
  switch(roomURL.host) {
    case "oorja.io": return "prod"
    case "staging.oorja.io": return "staging"
    case "localhost:3000": return "local"
    default:
      console.error(INVALID_ROOM_LINK_MESSAGE)
      process.exit(1)
  }
}

export const setupENV = (env: env) => {
  ACCESS_TOKEN = getENVAccessToken(env)
  switch(env) {
    case "staging":
      SURYA_URL = 'https://surya-staging.oorja.io'
      break;
    case "local":
      SURYA_URL = 'http://localhost:4000'
      break;
    case "prod":
      SURYA_URL = 'https://surya.oorja.io'
      break;
  }
}

export const getENVAccessToken = (env: env): string => {
  return config.get(`${env}-access-token`)
}

export const setENVAccessToken = (env: env, token: string) => {
  config.set(`${env}-access-token`, token)
}

import chalk = require('chalk');

const Conf = require('conf');
export const config = new Conf();

export let SURYA_URL = 'https://surya.oorja.io';
export let ACCESS_TOKEN = '';

export type env = "staging" | "prod" | "local"

export const ROOM_LINK_SAMPLE = "https://oorja.io/rooms?id=foo";

export const INVALID_ROOM_LINK_MESSAGE = `${chalk.redBright(
  "invalid url "
)}🤔. It should look like: ${chalk.blue(ROOM_LINK_SAMPLE)}`;

export const determineENV = (roomURL?: URL): env => {
  if (!roomURL) return config.get("env") || "prod"

  switch(roomURL.hostname) {
    case "oorja.io": return "prod"
    case "staging.oorja.io": return "staging"
    case "localhost:3000": return "local"
    default:
      console.error(INVALID_ROOM_LINK_MESSAGE)
      process.exit(1)
  }
}

export const setupENV = (env: env) => {
  switch(env) {
    case "staging":
      SURYA_URL = 'https://surya-staging.oorja.io'
      ACCESS_TOKEN = config.get("staging-access-token")
      break;
    case "local":
      SURYA_URL = 'http://localhost:4000'
      ACCESS_TOKEN = config.get("local-access-token")
      break;
    case "prod":
      SURYA_URL = 'https://surya.oorja.io'
      ACCESS_TOKEN = config.get("access-token")
      break;
  }
}

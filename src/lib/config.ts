import chalk = require("chalk");
import { URL } from "url";

export const CLI_VERSION = 1.6;

const Conf = require("conf");

export const config = new Conf({
  projectName: "oorja",
  projectVersion: CLI_VERSION,
});

export type env = "staging" | "local" | "prod" | "prod-teletype";

export type SuryaConfig = {
  host: string;
  enableTLS: boolean;
  token: string;
};

export const getSuryaConfig = (env: env): SuryaConfig => {
  const getHost = (env: env) => {
    switch (env) {
      case "local":
        return "localhost:4000";
      case "staging":
      case "prod":
      case "prod-teletype":
        return "surya.oorja.io";
    }
  };
  return {
    host: getHost(env),
    token: getENVAccessToken(env),
    enableTLS: env !== "local",
  };
};

export const ROOM_LINK_SAMPLE = "https://oorja.io/rooms?id=foo#key";

export const INVALID_ROOM_LINK_MESSAGE = `${chalk.redBright(
  "invalid url "
)}🤔. It should look like: ${chalk.blue(ROOM_LINK_SAMPLE)}`;

export const determineENV = (roomURL?: URL): env => {
  if (!roomURL) return config.get("env") || "prod-teletype";
  switch (roomURL.host) {
    case "oorja.io":
      return "prod";
    case "teletype.oorja.io":
      return "prod-teletype";
    case "staging.oorja.io":
      return "staging";
    case "localhost:3000":
      return "local";
    default:
      console.error(INVALID_ROOM_LINK_MESSAGE);
      process.exit(1);
  }
};

export const getENVAccessToken = (env: env): string => {
  return config.get(`${env}-access-token`);
};

export const setENVAccessToken = (env: env, token: string) => {
  config.set(`${env}-access-token`, token);
};

export type oorjaConfig = {
  host: string;
  enableTLS: boolean;
};

export const getoorjaConfig = (env: env): oorjaConfig => {
  let host: string;
  switch (env) {
    case "local":
      host = "localhost:3000";
      break;
    case "staging":
      host = "staging.oorja.io";
      break;
    case "prod":
      host = "oorja.io";
      break;
    case "prod-teletype":
      host = "teletype.oorja.io";
      break;
  }
  return {
    host,
    enableTLS: env !== "local",
  };
};

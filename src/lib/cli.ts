import chalk = require("chalk");
const { Input } = require("enquirer");
const ora = require("ora");

import {
  env,
  getSuryaConfig,
  getENVAccessToken,
  setENVAccessToken,
} from "./config";
import {
  fetchCliManifest,
  initializeSurya,
  fetchSessionUser,
  establishSocket,
} from "./surya";
import { Unauthorized } from "./surya/errors";

const cliVersion = 0;

const promptForToken = (): Promise<string> => {
  return new Input({
    name: "Access Token",
    message:
      "Running oorja-cli (https://oorja.io) for the first time, Please enter your access token for authentication:",
  }).run();
};

export const preflightChecks = async (env: env) => {
  const token = getENVAccessToken(env) || (await promptForToken()).trim();
  setENVAccessToken(env, token);
  const spinner = ora({
    text: "authenticating",
    discardStdin: false,
  }).start();
  const suryaConfig = getSuryaConfig(env);
  initializeSurya(suryaConfig);

  try {
    const manifest = await fetchCliManifest();
    if (manifest.cliVersion > cliVersion) {
      spinner.fail(
        chalk.yellowBright(
          "your oorja cli is outdated. please run: npm update -g oorja"
        )
      );
      process.exit(1);
    }
    const user = await fetchSessionUser();
    spinner.succeed(`authenticated: Welcome ${user.name}`);
    spinner.start("establishing comms");
    return establishSocket(suryaConfig)
      .then(() => spinner.succeed().clear())
      .catch((e) => {
        spinner.fail("socket connection failure..");
        throw e;
      });
  } catch (e) {
    if (e instanceof Unauthorized) {
      spinner.fail("Your access token failed authentication, resetting...");
      setENVAccessToken(env, "");
    } else {
      spinner.fail("something went wrong :(");
    }
    throw e;
  }
};

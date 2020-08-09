import chalk = require("chalk");
const { Input } = require("enquirer");
const ora = require("ora");

import {
  env,
  getSuryaConfig,
  getENVAccessToken,
  setENVAccessToken,
  CLI_VERSION,
} from "../config";
import {
  fetchCliManifest,
  initializeSurya,
  fetchSessionUser,
  establishSocket,
} from "../surya";
import { Unauthorized } from "../surya/errors";

const promptForToken = (generateTokenLink: string): Promise<string> => {
  console.log(
    "Running oorja-cli for the first time? You'll need an access token for authentication."
  );
  console.log(
    `You can generate your token here: ${chalk.blue(generateTokenLink)}`
  );
  return new Input({
    name: "Access Token",
    message: "Please enter your access token for authentication:",
  }).run();
};

export const preflightChecks = async (env: env, generateTokenLink: string) => {
  const token =
    getENVAccessToken(env) || (await promptForToken(generateTokenLink)).trim();
  if (!token) {
    console.log("token not provided :(");
    process.exit(12);
  }
  setENVAccessToken(env, token);
  const spinner = ora({
    text: "authenticating",
    discardStdin: false,
  }).start();
  const suryaConfig = getSuryaConfig(env);
  initializeSurya(suryaConfig);

  try {
    const manifest = await fetchCliManifest();
    if (manifest.cliVersion > CLI_VERSION) {
      spinner.fail(
        chalk.yellowBright(
          "your oorja cli is outdated. please run: npm update -g oorja"
        )
      );
      process.exit(1);
    }
    const user = await fetchSessionUser();
    spinner.succeed(`authenticated: Welcome ${user.name}`);
    if (user.profileType === "anon") {
      // don't persist tokens for anonymous users
      setENVAccessToken(env, "");
      console.log(
        chalk.yellowBright(
          "You're an anonymous user. CLI will not remember the token"
        )
      );
    }
    spinner.start("establishing comms");
    return establishSocket(suryaConfig, manifest.suryaHosts)
      .then(() => {
        spinner.succeed().clear();
        return user;
      })
      .catch((e) => {
        spinner.fail("socket connection failure..");
        throw e;
      });
  } catch (e) {
    if (e instanceof Unauthorized) {
      spinner.fail("Your access token failed authentication, resetting...");
      setENVAccessToken(env, "");
      process.exit(33);
    } else {
      spinner.fail("something went wrong :(");
    }
    throw e;
  }
};

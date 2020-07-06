import chalk = require("chalk");
const { Input } = require("enquirer");
const ora = require("ora");

// it was all going so great :(
import './hackish-workaround';

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
      "Running for the first time? Please enter your access token for authentication",
  }).run();
};

export const preflightChecks = async (env: env) => {
  const token = getENVAccessToken(env) || (await promptForToken());
  setENVAccessToken(env, token);
  const spinner = ora("authenticating").start();
  const suryaConfig = getSuryaConfig(env);
  initializeSurya(suryaConfig);

  return fetchCliManifest()
    .then((manifest) => {
      if (manifest.cliVersion > cliVersion) {
        spinner.fail(
          chalk.yellowBright(
            "your oorja cli is outdated. please run: npm update -g oorja"
          )
        );
        process.exit(1);
      }
    })
    .then(async () => {
      const user = await fetchSessionUser();
      spinner.succeed(`authenticated: Welcome ${user.name}`);
      spinner.start("establishing comms")
      return establishSocket(suryaConfig)
      .then(() => spinner.succeed())
      .catch((e) => {spinner.fail("socket connection failure.."); throw e;})
    })
    .catch((e) => {
      if (e instanceof Unauthorized) {
        spinner.fail("Your access token failed authentication, resetting...");
        setENVAccessToken(env, "");
      } else {
        spinner.fail("something went wrong :(");
      }
      throw e;
      // process.exit(1);
    });
};

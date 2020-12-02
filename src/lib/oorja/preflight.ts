import chalk = require("chalk");
const { Input, Select } = require("enquirer");
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
  createAnonymousUser,
} from "../surya";
import { Unauthorized } from "../surya/errors";

const promptToken = (): Promise<string> =>
  new Input({
    name: "Access Token",
    message: "Please enter your access token for authentication:",
  }).run();

const promptAuth = async (
  env: env,
  generateTokenLink: string
): Promise<string> => {
  const HAS_TOKEN = "I have a token with me";
  const ANON = "Proceed as an anonymous user";
  const SIGN_IN = "sign-in with oorja";
  console.log(
    `\n${chalk.bold(
      "PRO-TIP:"
    )} if you sign-in, you can control your shell from the web-ui as well, without enabling collaboration mode for all participants\n`
  );
  const answer = await new Select({
    message: "You need an access-token for authentication.\n ",
    choices: [HAS_TOKEN, ANON, SIGN_IN],
  }).run();
  switch (answer) {
    case HAS_TOKEN:
      return promptToken();
    case ANON:
      console.log("creating anonymous user...");
      return createAnonymousUser(env);
    case SIGN_IN:
      console.log(
        `You can sign-in and generate your token here: ${chalk.blue(
          generateTokenLink
        )}`
      );
      return promptToken();
  }
  throw Error("unexpected input");
};

export const preflightChecks = async (env: env, generateTokenLink: string) => {
  const token =
    getENVAccessToken(env) || (await promptAuth(env, generateTokenLink)).trim();
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
          "You're an anonymous user. CLI will not remember the auth-token"
        )
      );
    }
    spinner.start("connecting..");
    return establishSocket(suryaConfig)
      .then(() => {
        spinner.succeed("connected").clear();
        return user;
      })
      .catch((e) => {
        spinner.fail("socket connection failure..");
        throw e;
      });
  } catch (e) {
    setENVAccessToken(env, "");
    if (e instanceof Unauthorized) {
      spinner.fail("Your access token failed authentication, resetting...");
      process.exit(33);
    } else {
      spinner.fail("something went wrong :(");
    }
    throw e;
  }
};

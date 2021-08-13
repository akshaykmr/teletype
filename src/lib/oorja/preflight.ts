import chalk = require("chalk");
const { Input, Select } = require("enquirer");
const ora = require("ora");

import {
  env,
  setENVAccessToken,
  CLI_VERSION,
  getENVAccessToken,
} from "../config";
import { SuryaClient } from "../surya";
import { BadRequest, Unauthorized } from "../surya/errors";
import { User } from "../surya/types";

const promptToken = (): Promise<string> =>
  new Input({
    name: "Access Token",
    message: "Please enter your access token for authentication:",
  }).run();

export const promptRoomParticipantOTP = (): Promise<string> =>
  new Input({
    name: "OTP prompt",
    message: "Please enter your OTP for authentication:",
  }).run();

const OTP_HELP_MESSAGE =
  "You can generate OTP from the room, it's in the instruction steps";

export const promptAuth = async (
  suryaClient: SuryaClient,
  generateTokenLink: string
): Promise<string> => {
  const ANON = "Proceed as an anonymous user";
  const SIGN_IN = "Sign-in with oorja";
  console.log(
    `\n${chalk.bold(
      "PRO-TIP:"
    )} If you sign-in, you can control your shell from the web-ui as well, without enabling collaboration mode for the other participants\n`
  );
  const answer = await new Select({
    message: "You need an access-token for authentication.\n ",
    choices: [ANON, SIGN_IN],
  }).run();
  switch (answer) {
    case ANON:
      console.log("Creating anonymous user...");
      return suryaClient.createAnonymousUser();
    case SIGN_IN:
      console.log(
        `You can sign-in and generate your token here: ${chalk.blue(
          generateTokenLink
        )}`
      );
      return promptToken();
  }
  throw Error("Unexpected input");
};

export const loginByRoomOTP = async (
  suryaClient: SuryaClient,
  roomId: string
) => {
  const otp = await promptRoomParticipantOTP();
  if (!otp) {
    console.log("OTP not provided :(");
    console.log(OTP_HELP_MESSAGE);
    process.exit(213);
  }
  try {
    return await suryaClient.accessTokenFromRoomParticipantOTP(roomId, otp);
  } catch (e) {
    if (e instanceof BadRequest) {
      console.log(chalk.redBright("Invalid otp. It may have expired."));
      console.log(OTP_HELP_MESSAGE);
      process.exit();
    }
    throw e;
  }
};

export const validateCliVersion = async (suryaClient: SuryaClient) => {
  const manifest = await suryaClient.fetchCliManifest();
  if (manifest.cliVersion > CLI_VERSION) {
    console.log(
      chalk.redBright(
        "Your oorja cli is outdated. Please run: npm update -g oorja"
      )
    );
    process.exit(1);
  }
};

export const resumeSession = async (
  env: env,
  suryaClient: SuryaClient,
  roomId?: string
): Promise<User | null> => {
  const token = getENVAccessToken(env);
  if (!token) return null;
  // try to validate authorization with existing token
  try {
    const user = await suryaClient.fetchSessionUser();
    if (roomId) {
      await suryaClient.fetchRoom(roomId);
    }
    return user;
  } catch (e) {
    if (e instanceof Unauthorized) {
      setENVAccessToken(env, "");
      return null;
    }
    throw e;
  }
};

export const preflight = async (env: env, suryaClient: SuryaClient) => {
  const spinner = ora({
    text: "Authenticating",
    discardStdin: false,
  }).start();
  try {
    const user = await suryaClient.fetchSessionUser();
    spinner.succeed(`Authenticated: Welcome ${user.name}`);
    if (user.profileType === "anon") {
      // don't persist tokens for anonymous users
      setENVAccessToken(env, "");
      console.log(
        chalk.yellowBright(
          "You're an anonymous user. CLI will not remember the auth-token"
        )
      );
    }
    spinner.start("Connecting..");
    return suryaClient
      .establishSocket()
      .then(() => {
        spinner.succeed("Connected").clear();
        return user;
      })
      .catch((e) => {
        spinner.fail("Socket connection failure..");
        throw e;
      });
  } catch (e) {
    setENVAccessToken(env, "");
    if (e instanceof Unauthorized) {
      spinner.fail("Your access token failed authentication, resetting...");
      process.exit(33);
    } else {
      spinner.fail("Something went wrong :(");
    }
    throw e;
  }
};


import chalk = require('chalk');
const { Input } = require("enquirer");
const ora = require('ora');

import { env, setupENV, getSuryaConfig, getENVAccessToken, setENVAccessToken } from './config';
import { fetchCliManifest, initializeSurya, fetchSessionUser } from './surya';
import { Unauthorized } from './surya/errors';

const cliVersion = 0;


const promptForToken = (): Promise<string> => {
  return new Input({
    name: "Access Token",
    message:"Running for the first time? Please enter your access token for authentication",
  })
  .run()
}

export const preflightChecks = async (env: env) => {
  const token = getENVAccessToken(env) || await promptForToken()
  const spinner = ora('running preflight checks').start();
  setENVAccessToken(env, token)
  setupENV(env)
  const suryaConfig = getSuryaConfig();
  initializeSurya(suryaConfig)

  fetchCliManifest()
    .then((manifest) => {
      if (manifest.cliVersion > cliVersion) {
        spinner.stop(chalk.yellowBright("your oorja cli is outdated. please run: npm update -g oorja"))
        process.exit(1)
      }
    })
    .then(async () => {
      const user = await fetchSessionUser()
      console.log(user)
    })
    .catch((e) => {
      if (e instanceof Unauthorized) {
        spinner.fail("Your access token failed authentication, resetting...")
        setENVAccessToken(env, '')
      } else {
        spinner.fail("something went wrong :(")
        console.error(e)
      }
      process.exit(1)
    })
}

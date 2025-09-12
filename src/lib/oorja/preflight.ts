import chalk from 'chalk'
import inquirer from 'inquirer'
import ora from 'ora'

import {env, CLI_VERSION, Config} from '../config.js'
import {ConnectClient} from '../connect/index.js'
import {Unauthorized} from '../connect/errors.js'
import {printExitMessage} from '../utils.js'
import {UserProfile} from '../connect/types.js'

const promptToken = (): Promise<string> =>
  inquirer
    .prompt([
      {
        type: 'input',
        name: 'accessToken',
        message: 'Please enter your access token for authentication:',
      },
    ])
    .then((answers) => answers.accessToken)

export const promptAuth = async (connectClient: ConnectClient, generateTokenLink: string): Promise<string> => {
  const ANON = 'Proceed as an anonymous user'
  const SIGN_IN = 'Sign-in with oorja'
  console.log(
    `\n${chalk.bold(
      'PRO-TIP:',
    )} If you sign-in, you can control your shell from the web-ui as well, without enabling collaboration mode for the other participants\n`,
  )
  const {answer} = await inquirer.prompt([
    {
      type: 'list',
      name: 'answer',
      message: 'You need an access-token for authentication.\n ',
      choices: [ANON, SIGN_IN],
    },
  ])
  switch (answer) {
    case ANON:
      console.log('Creating anonymous user...')
      return connectClient.createAnonymousUser()
    case SIGN_IN:
      console.log(`You can sign-in and generate your token here: ${chalk.blue(generateTokenLink)}`)
      return promptToken()
  }
  throw Error('Unexpected input')
}

export const validateCliVersion = async (connectClient: ConnectClient) => {
  const manifest = await connectClient.fetchCliManifest()
  if (manifest.cliVersion > CLI_VERSION) {
    printExitMessage(chalk.redBright('Your oorja cli is outdated. Please run: npm update -g oorja'))
    process.exit(1)
  }
}

export const preflight = async (
  user: UserProfile | null,
  config: Config,
  connectClient: ConnectClient,
): Promise<UserProfile> => {
  const spinner = ora({
    text: 'Authenticating',
    discardStdin: false,
  }).start()
  try {
    const userProfile = user || (await connectClient.fetchSessionUser())
    spinner.succeed(`Authenticated ✅: Welcome ${userProfile.name}`)
    if (userProfile.profileType === 'anon') {
      // don't persist tokens for anonymous users
      config.setAccessToken('')
      console.log(chalk.yellowBright("You're an anonymous user. CLI will not remember the auth-token"))
    }
    spinner.start('Connecting..')
    return connectClient
      .establishSocket()
      .then(() => {
        spinner.succeed('Connected').clear()
        return userProfile
      })
      .catch((e) => {
        spinner.fail('Socket connection failure..')
        throw e
      })
  } catch (e) {
    config.setAccessToken('')
    if (e instanceof Unauthorized) {
      spinner.fail()
      printExitMessage('Your access token failed authentication, resetting...')
      process.exit(33)
    } else {
      spinner.fail()
      printExitMessage('Something went wrong :(')
    }
    throw e
  }
}

import chalk from 'chalk'
import inquirer from 'inquirer'

import {CLI_VERSION} from '../config.js'
import {ConnectClient} from '../connect/index.js'
import {printExitMessage} from '../utils.js'
import {exit} from '../exit.js'

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
    exit(1)
  }
}

import inquirer from 'inquirer'
import {Command, Flags, Args} from '@oclif/core'
import ora from 'ora'

import {hostname, platform} from 'os'
import chalk from 'chalk'
import {Config, STREAM_KEY_SAMPLE} from 'oorja/lib/config'
import {App, parseStreamKey} from 'oorja/lib/oorja/index'
import {printExitMessage, promptStreamKey} from 'oorja/lib/utils'
import {Unauthorized} from 'oorja/lib/connect/errors'
import {exit} from 'oorja/lib/exit'

const DEFAULT_SHELL = platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'

export default class TeleTypeCommand extends Command {
  static order = 1
  static aliases = ['tty']
  static description = `Launch a terminal streaming session in oorja.`

  static examples = [
    `${chalk.blueBright('$ teletype')}
Will prompt to choose streaming destination - either enter a stream key for an existing space or create a new space.

`,
    `${chalk.blueBright(`$ teletype '${STREAM_KEY_SAMPLE}'`)}
Will stream to the space using the secret stream-key. NOTE: stream-keys are personal (generated for you in the teletype app at oorja.io), do not accept them from other people, nor should
you share your stream-keys with others.

`,
    `${chalk.blueBright('$ teletype -m')}
Will also allow participants to write to your terminal! Collaboration mode must be explicitly enabled.

`,
  ]

  static flags = {
    help: Flags.help({char: 'h'}),
    shell: Flags.string({
      char: 's',
      description: 'shell to use. e.g. bash, fish',
      default: DEFAULT_SHELL,
    }),
    multiplex: Flags.boolean({
      char: 'm',
      description:
        'Allows users to WRITE TO YOUR SHELL i.e enables collaboration mode. Make sure you trust space participants. Off by default',
      default: false,
    }),
    new_space: Flags.boolean({
      char: 'n',
      description: 'Create new space',
      default: false,
    }),
  }

  static args = {
    streamKey: Args.string({}),
  }

  async run() {
    const {
      args,
      flags: {shell, multiplex, new_space},
    } = await this.parse(TeleTypeCommand)

    const config = new Config(this.config.configDir)
    const app = new App(config)

    if (args.streamKey) {
      await this.streamUsingStreamKey(app, {shell, multiplex, streamKey: args.streamKey})
      exit(0)
    }
    if (new_space) {
      await this.createRoomAndStream(app, {shell, multiplex})
      exit(0)
    }

    console.log('(use -h for description and options) \n')

    // room not known, prompt
    const STREAM_USING_STREAM_KEY =
      'Stream using stream-key (You can acquire your stream key from teletype app within the space)'
    const STREAM_TO_NEW_SPACE = 'New space'
    const {answer} = await inquirer.prompt([
      {
        type: 'list',
        name: 'answer',
        message: 'Choose streaming destination',
        choices: [STREAM_TO_NEW_SPACE, STREAM_USING_STREAM_KEY],
      },
    ])
    switch (answer) {
      case STREAM_USING_STREAM_KEY:
        await this.streamUsingStreamKey(app, {shell, multiplex})
        break
      case STREAM_TO_NEW_SPACE:
        await this.createRoomAndStream(app, {shell, multiplex})
        break
    }
    exit(0)
  }

  private async streamUsingStreamKey(app: App, options: {shell: string; multiplex: boolean; streamKey?: string}) {
    const streamKey: string = options.streamKey || (await promptStreamKey())
    if (!streamKey) {
      printExitMessage(chalk.redBright('stream-key not provided :('))
      exit()
    }
    const streamKeyStruct = parseStreamKey(streamKey)
    const oorja = await app.init(streamKeyStruct)
    const roomKey = oorja.getRoomKey(streamKeyStruct)
    this.clearstdin()
    await oorja.teletype({roomKey, ...options, process})
  }

  private async createRoomAndStream(app: App, {shell, multiplex}: {shell: string; multiplex: boolean}) {
    const oorja = await app.init()
    const spinner = ora({
      text: chalk.bold('Creating space with TeleType app'),
      discardStdin: false,
    }).start()
    const now = new Date()
    const {roomKey, inviteCode} = await oorja
      .createRoom({
        roomName: `Teletype session - ${hostname()} @ ${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
        apps: {
          defaultFocus: '39',
          appList: [
            {appId: '100', config: {}},
            {appId: '90', config: {}},
            {appId: '39', config: {}},
            {appId: '102', config: {}},
            {appId: '103', config: {}},
          ],
        },
      })
      .catch((e) => {
        if (e instanceof Unauthorized) {
          printExitMessage('Failed to create space. Are you sure your access-token is valid?')
        } else {
          printExitMessage('Failed to create space. Try again later or try updating your oorja-cli')
        }
        exit(9)
        return Promise.reject()
      })
    spinner.succeed(chalk.bold('Space created')).clear()

    const link = oorja.linkForRoom(roomKey, inviteCode)
    console.log(`\n${chalk.bold(chalk.blueBright(link))}\n`)
    console.log(chalk.bold("^^ You'll be streaming here ^^"))
    this.clearstdin()
    return await oorja.teletype({roomKey, shell, multiplex, process})
  }

  private clearstdin() {
    process.stdin.read()
    process.stdin.resume() // FIXME: investigate weird quirk. stdin hangs if this is not present
  }
}

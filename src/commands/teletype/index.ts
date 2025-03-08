import inquirer from 'inquirer'
import {Command, Flags, Args} from '@oclif/core'
import ora from 'ora'

import * as os from 'os'
import chalk from 'chalk'
import {ROOM_LINK_SAMPLE} from '../../lib/config.js'
import {getApp} from '../../lib/oorja/index.js'
import {promptRoomLink} from '../../lib/utils.js'

const DEFAULT_SHELL = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash'

export default class TeleTypeCommand extends Command {
  static order = 1
  static aliases = ['tty']
  static description = `Launch a terminal streaming session in oorja.`

  static examples = [
    `${chalk.blueBright('$ teletype')}
Will prompt to choose streaming destination - existing space or create a new one.

`,
    `${chalk.blueBright(`$ teletype '${ROOM_LINK_SAMPLE}'`)}
Will stream to the space specified by secret link, you must have joined the space before streaming.

`,
    `${chalk.blueBright('$ teletype -m')}
Will also allow participants to write to your terminal!

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
    space: Args.string({}),
  }

  async run() {
    const {
      args,
      flags: {shell, multiplex, new_space},
    } = await this.parse(TeleTypeCommand)

    if (args.space) {
      await this.streamToLink({shell, multiplex, roomLink: args.space})
      process.exit(0)
    }
    if (new_space) {
      await this.createRoomAndStream({shell, multiplex})
      process.exit(0)
    }

    console.log('(use -h for description and options) \n')

    // room not known, prompt
    const SPACE = 'To an existing space (you have the link)'
    const NEW = 'New space'
    const {answer} = await inquirer.prompt([
      {
        type: 'list',
        name: 'answer',
        message: 'Choose streaming destination',
        choices: [NEW, SPACE],
      },
    ])
    switch (answer) {
      case SPACE:
        await this.streamToLink({shell, multiplex})
        break
      case NEW:
        await this.createRoomAndStream({shell, multiplex})
        break
    }
    process.exit(0)
  }

  private async streamToLink(options: {shell: string; multiplex: boolean; roomLink?: string}) {
    const roomLink = options.roomLink || (await promptRoomLink())
    if (!roomLink) {
      console.log(chalk.redBright('Space link not provided :('))
      process.exit()
    }
    const app = await getApp({roomLink})
    const roomKey = app.getRoomKey(roomLink)
    this.clearstdin()
    await app.teletype({roomKey, ...options, process})
  }

  private async createRoomAndStream({shell, multiplex}: {shell: string; multiplex: boolean}) {
    const app = await getApp()

    const spinner = ora({
      text: chalk.bold('Creating space with TeleType app'),
      discardStdin: false,
    }).start()
    const {roomKey} = await app
      .createRoom({
        roomName: 'Untitled Space',
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
        console.log('Failed to create space.')
        process.exit(9)
      })
    spinner.succeed(chalk.bold('Space created')).clear()

    const link = app.linkForRoom(roomKey)
    console.log(`\n${chalk.bold(chalk.blueBright(link))}\n`)
    console.log(chalk.bold("^^ You'll be streaming here ^^"))
    this.clearstdin()
    return await app.teletype({roomKey, shell, multiplex, process})
  }

  private clearstdin() {
    process.stdin.read()
    process.stdin.resume() // FIXME: investigate weird quirk. stdin hangs if this is not present
  }
}

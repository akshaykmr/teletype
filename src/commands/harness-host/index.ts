import {Args, Flags} from '@oclif/core'

import {BaseCommand} from 'oorja/lib/command'
import {Config} from 'oorja/lib/config'
import {App, parseStreamKey} from 'oorja/lib/oorja/index'
import {promptStreamKey} from 'oorja/lib/utils'
import {checkHarnessSetup} from 'oorja/lib/harnessHost/setup'

export default class HarnessHostCommand extends BaseCommand {
  static description = 'Run agents on this computer from SparkChat in a SupaKit space.'

  static flags = {
    multiplayer: Flags.boolean({
      char: 'm',
      description: 'Allow space participants to run agents on this computer.',
      default: false,
    }),
  }

  static args = {
    streamKey: Args.string({description: 'Secret stream key for the target space'}),
  }

  async run() {
    const {args, flags} = await this.parse(HarnessHostCommand)
    await checkHarnessSetup(process.cwd())
    const streamKey = args.streamKey || (await promptStreamKey())
    const parsed = parseStreamKey(streamKey)
    const oorja = await new App(new Config(this.config.configDir)).init({streamKey: parsed})
    const roomKey = oorja.getRoomKey(parsed)
    await oorja.harnessHost({
      roomKey,
      process,
      multiplayer: flags.multiplayer,
    })
  }
}

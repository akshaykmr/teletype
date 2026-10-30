import {Args, Command} from '@oclif/core'

import {Config} from 'oorja/lib/config'
import {App, parseStreamKey} from 'oorja/lib/oorja/index'
import {promptStreamKey} from 'oorja/lib/utils'

export default class HarnessHostRun extends Command {
  static description = 'Serve harness sessions in a SupaKit space.'

  static args = {
    streamKey: Args.string({description: 'Secret stream key for the target space'}),
  }

  async run() {
    const {args} = await this.parse(HarnessHostRun)
    const streamKey = args.streamKey || (await promptStreamKey())
    const parsed = parseStreamKey(streamKey)
    const oorja = await new App(new Config(this.config.configDir)).init({streamKey: parsed})
    const roomKey = oorja.getRoomKey(parsed)
    await oorja.harnessHost({
      roomKey,
      process,
    })
  }
}

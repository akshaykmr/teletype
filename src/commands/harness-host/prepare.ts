import {Args, Command} from '@oclif/core'
import chalk from 'chalk'
import type {HarnessSelection} from 'oorja-harness-host'
import ora from 'ora'

import {loadHarnessHost} from 'oorja/lib/harnessHost/index'

const HARNESS_OPTIONS = ['all', 'codex', 'claude-code', 'opencode']

export default class HarnessHostPrepare extends Command {
  static description = 'Set up agent runtimes on this machine.'

  static args = {
    runtimes: Args.string({
      description: 'Agent runtimes to set up; use all to set up every supported runtime',
      options: HARNESS_OPTIONS,
      multiple: true,
      default: ['all'],
    }),
  }

  async run() {
    const {args} = await this.parse(HarnessHostPrepare)
    const runtimes = args.runtimes as HarnessSelection[]
    const {prepareHarnessHost} = await loadHarnessHost()
    const spinner = ora('Setting up agent runtimes').start()
    try {
      const results = await prepareHarnessHost(process.cwd(), runtimes)
      spinner.succeed(chalk.bold('Agent runtimes ready'))
      results.forEach(({harnessId, detail}) => {
        this.log(`  ${chalk.blueBright(harnessId)}  ${chalk.dim(detail)}`)
      })
    } catch (error) {
      spinner.fail(chalk.bold('Could not set up agent runtimes'))
      throw error
    }
  }
}

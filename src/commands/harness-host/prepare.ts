import {Args} from '@oclif/core'
import chalk from 'chalk'
import type {HarnessSelection} from 'oorja-harness-host/harnesses'
import ora from 'ora'

import {BaseCommand} from 'oorja/lib/command'
import {checkHarnessPrerequisites, loadHarnessHost} from 'oorja/lib/harnessHost/index'

const HARNESS_OPTIONS = ['all', 'codex', 'claude-code', 'opencode', 'pi']

export default class HarnessHostPrepare extends BaseCommand {
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
    const spinner = ora('Setting up agent runtimes').start()
    try {
      const {prepareHarnessHost} = await loadHarnessHost()
      await checkHarnessPrerequisites(process.cwd(), runtimes)
      const results = await prepareHarnessHost(process.cwd(), runtimes)
      spinner.succeed(chalk.bold('Agent runtimes ready'))
      results.forEach(({harnessId, detail}) => {
        this.log(`  ${chalk.blueBright(harnessId)}  ${chalk.dim(detail)}`)
      })
    } catch (error) {
      spinner.fail(chalk.bold('Could not set up agent runtimes. For setup checks, run: oorja harness-host:doctor'))
      throw error
    }
  }
}

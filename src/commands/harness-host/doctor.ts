import {Command, Flags} from '@oclif/core'
import chalk from 'chalk'

import {loadHarnessHost} from 'oorja/lib/harnessHostPackage'

export default class HarnessHostDoctor extends Command {
  static description = 'Check whether this machine can run agent sessions.'

  static flags = {
    json: Flags.boolean({description: 'Print machine-readable JSON.', default: false}),
  }

  async run() {
    const {flags} = await this.parse(HarnessHostDoctor)
    const {doctorHarnessHost} = await loadHarnessHost()
    const harnesses = await doctorHarnessHost(process.cwd())
    const ok = harnesses.every(({checks}) => checks.every((check) => check.ok))
    if (flags.json) {
      this.log(JSON.stringify({ok, harnesses}, null, 2))
    } else {
      harnesses.forEach(({harnessId, checks}) => {
        this.log(chalk.bold.blueBright(harnessId))
        checks.forEach((check) => {
          const mark = check.ok ? chalk.greenBright('✔') : chalk.redBright('✖')
          this.log(`  ${mark} ${chalk.bold(check.name)}  ${chalk.dim(check.detail)}`)
        })
      })
      this.log('')
      this.log(
        ok
          ? `${chalk.greenBright('✔')} ${chalk.bold('This machine is ready to run agent sessions.')}`
          : `${chalk.redBright('✖')} ${chalk.bold('This machine is not ready. Fix the failed checks above.')}`,
      )
    }
    if (!ok) this.exit(1)
  }
}

import {Flags} from '@oclif/core'
import chalk from 'chalk'
import ora from 'ora'

import {BaseCommand} from 'oorja/lib/command'
import {loadHarnessHost} from 'oorja/lib/harnessHost/setup'

export default class HarnessHostDoctor extends BaseCommand {
  static description = 'Check prerequisites and discover available agent models.'

  static flags = {
    json: Flags.boolean({description: 'Print machine-readable JSON.', default: false}),
    timeout: Flags.integer({description: 'Maximum seconds for model discovery per agent.', default: 30, min: 1}),
  }

  async run() {
    const {flags} = await this.parse(HarnessHostDoctor)
    const {doctorHarnessHost, HarnessReadiness} = await loadHarnessHost()
    const spinner =
      !flags.json && process.stderr.isTTY ? ora('Checking prerequisites and agent models').start() : undefined
    const abort = new AbortController()
    let interrupted: number | undefined
    const onInterrupt = () => {
      interrupted = 130
      abort.abort()
    }
    const onTerminate = () => {
      interrupted = 143
      abort.abort()
    }
    const onHangup = () => {
      interrupted = 129
      abort.abort()
    }
    process.on('SIGHUP', onHangup)
    process.on('SIGINT', onInterrupt)
    process.on('SIGTERM', onTerminate)
    try {
      const report = await doctorHarnessHost(process.cwd(), {timeout: flags.timeout * 1000, signal: abort.signal})
      if (interrupted) {
        this.exit(interrupted)
      }
      spinner?.stop()
      if (flags.json) {
        this.log(JSON.stringify(report, null, 2))
      } else {
        this.log(chalk.bold('Prerequisites'))
        for (const {name, ok, detail, requiredBy} of report.prerequisites) {
          const mark = ok ? chalk.greenBright('✔') : chalk.redBright('✖')
          const appliesTo = requiredBy.length === report.harnesses.length ? '' : ` (${requiredBy.join(', ')})`
          this.log(`  ${mark} ${chalk.bold(name)}  ${chalk.dim(detail + appliesTo)}`)
        }
        this.log(`\n${chalk.bold('Agents')}`)
        for (const {harnessId, status, models, error} of report.harnesses) {
          if (status === HarnessReadiness.READY) {
            this.log(
              `  ${chalk.greenBright('✔')} ${chalk.bold(harnessId)}  ${models.models.length} ${models.models.length === 1 ? 'model' : 'models'} · default: ${models.defaultModel}`,
            )
            const preview = models.models.slice(0, 5).join(', ')
            const remaining = models.models.length - 5
            this.log(`    ${chalk.dim(preview + (remaining > 0 ? `, +${remaining} more (use --json)` : ''))}`)
          } else {
            const detail = status === HarnessReadiness.BLOCKED ? 'Prerequisites not met (see above).' : error
            this.log(`  ${chalk.yellowBright('–')} ${chalk.bold(harnessId)}  ${chalk.dim(detail)}`)
          }
        }
        this.log('')
        this.log(
          report.ok
            ? chalk.greenBright('✔ At least one agent can discover models. Run a session to verify execution.')
            : report.prerequisites.some(({ok}) => !ok)
              ? chalk.redBright('✖ Fix the failed prerequisites before starting Harness Host.')
              : chalk.redBright('✖ No agents reported models. Prepare an agent and configure its sign-in/API keys.'),
        )
      }
      if (!report.ok) {
        this.exit(1)
      }
    } finally {
      spinner?.stop()
      process.removeListener('SIGHUP', onHangup)
      process.removeListener('SIGINT', onInterrupt)
      process.removeListener('SIGTERM', onTerminate)
    }
  }
}

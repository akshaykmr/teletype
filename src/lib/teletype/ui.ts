import chalk from 'chalk'
import {clearLine, cursorTo} from 'readline'

export class MultishellUI {
  private stopHosting?: () => void

  constructor(private readonly options: {process: NodeJS.Process; harnessHostEnabled: boolean}) {}

  start(stopHosting: () => void) {
    this.stopHosting = stopHosting
    this.options.process.once('SIGINT', stopHosting)
  }

  update(shells: number, viewers: number) {
    const {stdout} = this.options.process
    if (!stdout.isTTY) {
      return
    }

    const status = [
      chalk.bold.blueBright('TeleType host online'),
      ...(this.options.harnessHostEnabled ? [chalk.green('Harness Host on')] : []),
      chalk.green(`${shells} shell${shells === 1 ? '' : 's'} active`),
      chalk.cyan(`${viewers} viewer${viewers === 1 ? '' : 's'} connected`),
      chalk.dim('Ctrl-C to stop hosting'),
    ]
    clearLine(stdout, 0)
    cursorTo(stdout, 0)
    stdout.write(status.join(chalk.dim('  •  ')))
  }

  stop() {
    if (this.stopHosting) {
      this.options.process.off('SIGINT', this.stopHosting)
      this.stopHosting = undefined
    }

    if (this.options.process.stdout.isTTY) {
      clearLine(this.options.process.stdout, 0)
      cursorTo(this.options.process.stdout, 0)
    }
  }

  confirmStopped() {
    this.options.process.stdout.write(chalk.blueBright('TeleType hosting stopped. All terminal streams have ended.\n'))
  }
}

import chalk from 'chalk'
import {clearLine, cursorTo} from 'readline'

export class MultishellUI {
  private stopHosting?: () => void

  constructor(
    private readonly process: NodeJS.Process,
    private readonly enabled: boolean,
  ) {}

  start(stopHosting: () => void) {
    if (!this.enabled) {
      return
    }
    this.stopHosting = stopHosting
    this.process.once('SIGINT', stopHosting)
  }

  update(shells: number, viewers: number) {
    const {stdout} = this.process
    if (!this.enabled || !stdout.isTTY) {
      return
    }

    const status = [
      chalk.bold.blueBright('TeleType host online'),
      chalk.green(`${shells} shell${shells === 1 ? '' : 's'} active`),
      chalk.cyan(`${viewers} viewer${viewers === 1 ? '' : 's'} connected`),
      chalk.dim('Ctrl-C to stop hosting'),
    ]
    clearLine(stdout, 0)
    cursorTo(stdout, 0)
    stdout.write(status.join(chalk.dim('  •  ')))
  }

  stop() {
    if (!this.enabled) {
      return
    }

    if (this.stopHosting) {
      this.process.off('SIGINT', this.stopHosting)
      this.stopHosting = undefined
    }

    if (this.process.stdout.isTTY) {
      clearLine(this.process.stdout, 0)
      cursorTo(this.process.stdout, 0)
    }
  }

  confirmStopped() {
    if (this.enabled) {
      this.process.stdout.write(chalk.blueBright('TeleType hosting stopped. All terminal streams have ended.\n'))
    }
  }
}

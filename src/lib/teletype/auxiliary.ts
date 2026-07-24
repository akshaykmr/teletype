import chalk from 'chalk'
import termSize from 'terminal-size'
import {IPty} from 'node-pty'
import {clearScreenDown, cursorTo} from 'readline'

export const DEFAULT_DIMENSIONS: dimensions = {rows: 24, cols: 80}

export const initScreen = (username: string, hostname: string, shell: string, multiplexed: boolean) => {
  console.log(
    `${chalk.greenBright('✔')} ${chalk.bold(chalk.blueBright('TeleType'))} ${chalk.greenBright('is streaming')}`,
  )
  console.log(`  ${chalk.bold(`${username}@${hostname}`)} ${chalk.dim(' • ')} ${chalk.bold(shell)}\n`)

  if (multiplexed) {
    console.log(chalk.yellowBright('You have allowed room participants to write to your shell'))
  }

  console.log(
    `Note: Your shell size may adjust for optimum viewing experience for all participants.\n
This session is end-to-end encrypted.

${chalk.blueBright('┌─ Control your shell')}
${chalk.blueBright('│')} Everyone in the space can view this shell on the web.
${chalk.blueBright('│')} Anyone with write access can also control it there.
${chalk.blueBright('│')} If you prefer this terminal, press ${chalk.yellowBright('Enter')} to attach here.
${chalk.blueBright('│')} Once attached, run ${chalk.yellowBright('exit')} or press ${chalk.yellowBright(
      'Ctrl-D',
    )} to stop streaming.
${chalk.blueBright('└─')}

Press ${chalk.yellowBright('Ctrl-C')} now to stop streaming.\n`,
  )
}

export const clearAttachmentScreen = (stdout: NodeJS.WriteStream) => {
  cursorTo(stdout, 0, 0)
  clearScreenDown(stdout)
}

export type dimensions = {
  rows: number
  cols: number
}

export const getDimensions = (): dimensions => {
  const {rows, columns} = termSize()
  if (!Number.isFinite(rows) || !Number.isFinite(columns) || rows < 1 || columns < 1) {
    return DEFAULT_DIMENSIONS
  }
  return {rows, cols: columns}
}

export const areDimensionEqual = (a: dimensions, b: dimensions): boolean => {
  return a.rows === b.rows && a.cols === b.cols
}

export const resizeBestFit = (
  term: IPty,
  userDimensions: Record<string, dimensions>,
  shouldClearScreen: boolean = false,
) => {
  const allViewports = Object.values(userDimensions)
  if (allViewports.length === 0) {
    return
  }
  const minrows = Math.min(...allViewports.map((d) => d.rows))
  const mincols = Math.min(...allViewports.map((d) => d.cols))
  term.resize(mincols, minrows)
  if (shouldClearScreen) {
    term.write('\x0c') // clear screen
  }
}

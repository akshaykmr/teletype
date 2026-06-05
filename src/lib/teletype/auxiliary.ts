import chalk from 'chalk'
import termSize from 'terminal-size'
import {IPty} from 'node-pty'

export const DEFAULT_DIMENSIONS: dimensions = {rows: 24, cols: 80}

export const initScreen = (username: string, hostname: string, shell: string, multiplexed: boolean) => {
  console.log(chalk.bold(chalk.blueBright('TeleType')))

  if (multiplexed) {
    console.log(chalk.yellowBright('You have allowed room participants to write to your shell'))
  }
  console.log(
    `Note: Your shell size may adjust for optimum viewing experience for all participants.\n
This session is end-to-end encrypted.
To terminate stream run ${chalk.yellowBright('exit')} or press ${chalk.yellowBright('ctrl-d')} \n`,
  )
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

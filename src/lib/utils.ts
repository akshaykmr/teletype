import inquirer from 'inquirer'
import {writeSync} from 'fs'

export const printExitMessage = (printMessage: string) => {
  writeSync(process.stdout.fd, printMessage)
}

export const setTerminalTitle = (title: string) => {
  if (!process.stdout.isTTY) {
    return
  }

  const sanitizedTitle = [...title]
    .filter((character) => {
      const codePoint = character.codePointAt(0)!
      return codePoint >= 0x20 && codePoint !== 0x7f && !(codePoint >= 0x80 && codePoint <= 0x9f)
    })
    .join('')
    .slice(0, 254)

  process.stdout.write(`\u001B]2;${sanitizedTitle}\u001B\\`)
}

export const promptStreamKey = async (): Promise<string> => {
  const {streamKey} = await inquirer.prompt([
    {
      type: 'input',
      name: 'streamKey',
      message: 'Enter the stream-key (copy from teletype app within the space):',
    },
  ])
  return streamKey
}

export class Future<T> {
  promise: Promise<T>

  resolve?: (arg: T) => void

  reject?: (e: any) => void

  onFinally?: () => void

  constructor(futureBase?: (resolve: (arg: T) => void, reject: (e: any) => void) => void, onFinally?: () => void) {
    this.onFinally = onFinally
    // eslint-disable-next-line no-async-promise-executor
    this.promise = new Promise<T>(async (resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
      if (futureBase) {
        await futureBase(resolve, reject)
      }
    }).finally(() => this.onFinally?.())
  }
}

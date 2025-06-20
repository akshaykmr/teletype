import inquirer from 'inquirer'

export const promptRoomLink = async () => {
  const {spaceLink} = await inquirer.prompt([
    {
      type: 'input',
      name: 'spaceLink',
      message: 'Enter the space secret link (copy URL from address bar in your browser):',
    },
  ])
  return spaceLink
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

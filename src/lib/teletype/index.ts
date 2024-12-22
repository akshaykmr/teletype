import {spawn, IPty} from 'node-pty'
import * as os from 'os'
import {Hash, RoomKey} from '../connect/types.js'
import {getDimensions, dimensions, initScreen, areDimensionEqual, resizeBestFit} from './auxiliary.js'
import chalk from 'chalk'
import {Unauthorized} from '../connect/errors.js'
import {encrypt, decrypt} from '../encryption.js'
import {JoinChannelOptions} from '../connect/index.js'
import {Channel} from 'phoenix'

enum MessageType {
  IN = 'i',
  OUT = 'o',
  DIMENSIONS = 'd',
}

export type TeletypeOptions = {
  userId: string
  roomKey: RoomKey
  shell: string
  multiplex: boolean
  process: NodeJS.Process
  joinChannel: (options: JoinChannelOptions<any>) => Channel
}

const SELF = 'self'

export const teletypeApp = (options: TeletypeOptions) => {
  const username = os.userInfo().username
  const hostname = os.hostname()

  const userDimensions: Hash<dimensions> = {}
  userDimensions[SELF] = getDimensions()

  let term: IPty

  const reEvaluateOwnDimensions = () => {
    const lastKnown = userDimensions[SELF]
    const latest = getDimensions()

    if (areDimensionEqual(lastKnown, latest)) {
      return
    }
    userDimensions[SELF] = latest
    resizeBestFit(term, userDimensions)
  }

  return new Promise((resolve, reject) => {
    const channel = options.joinChannel({
      channel: `teletype:${options.roomKey.roomId}`,
      params: {
        username,
        hostname,
        multiplexed: options.multiplex,
      },
      onJoin: () => {
        initScreen(username, hostname, options.shell, options.multiplex)

        const stdin = options.process.stdin
        const stdout = options.process.stdout
        const dimensions = userDimensions[SELF]

        term = spawn(options.shell, [], {
          name: 'xterm-256color',
          cols: dimensions.cols,
          rows: dimensions.rows,
          cwd: options.process.cwd(),
          // @ts-ignore
          env: options.process.env,
        })

        // track own dimensions and keep it up to date
        setInterval(reEvaluateOwnDimensions, 1000)

        term.onData((d: string) => {
          stdout.write(d)
          // revisit: is it worth having one letter names, instead of something descriptive
          // does it really save bytes?
          channel.push('new_msg', {
            t: MessageType.OUT,
            b: true,
            d: encrypt(d, options.roomKey),
          })
        })
        term.onExit(() => {
          console.log(chalk.blueBright('terminated shell stream to oorja. byee!'))
          resolve(null)
        })

        stdin.setEncoding('utf8')
        stdin.setRawMode!(true)

        stdin.on('data', (d) => term.write(d.toString('utf8')))
      },
      onClose: () => {
        console.log(chalk.redBright('connection closed, terminated stream.'))
        process.exit(3)
      },
      onError: (err?: any) => {
        if (err instanceof Unauthorized) {
          console.log(chalk.redBright(err.message))
        } else {
          console.log(chalk.redBright('connection error, terminated stream.'))
        }
        process.exit(4)
      },
      onMessage: ({from: {session}, t, d}) => {
        switch (t) {
          case MessageType.DIMENSIONS:
            userDimensions[session] = d
            resizeBestFit(term, userDimensions)
            break
          case MessageType.IN:
            const data = decrypt(d, options.roomKey)
            const userId = session.split(':')[0]
            if (options.multiplex) {
              term.write(data)
              return
            }
            if (userId === options.userId) {
              term.write(data)
            } else {
              console.log(
                chalk.redBright(
                  `unexpected input from user: ${userId}, terminating stream for safety. Please report this issue`,
                ),
              )
              process.exit(5)
            }
        }
      },
      handleSessionJoin: (s) => {},
      handleSessionLeave: (s) => {
        s && delete userDimensions[s]
        resizeBestFit(term, userDimensions)
      },
    })
  })
}

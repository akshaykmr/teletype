import {spawn, IPty} from 'node-pty'
import * as os from 'os'
import {Hash, RoomKey} from '../connect/types.js'
import {getDimensions, dimensions, initScreen, areDimensionEqual, resizeBestFit} from './auxiliary.js'
import chalk from 'chalk'
import {Unauthorized} from '../connect/errors.js'
import {encrypt, decrypt} from '../encryption.js'
import {JoinChannelOptions} from '../connect/index.js'
import {Channel} from 'phoenix'
import {Future, printExitMessage} from '../utils.js'

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
    let sessionCount = 0
    let ptyReady = false
    const ptyFuture: Future<boolean> = new Future()

    const channel = options.joinChannel({
      channel: `teletype:${options.roomKey.roomId}`,
      params: {
        username,
        hostname,
        multiplexed: options.multiplex,
      },
      onJoin: () => {
        const stdin = options.process.stdin
        const stdout = options.process.stdout
        const dimensions = userDimensions[SELF]

        console.log(
          chalk.blue(
            `${chalk.bold(`${username}@${hostname}`)} Spawning streaming shell: ${chalk.bold(`${options.shell}`)}`,
          ),
        )

        term = spawn(options.shell, [], {
          name: 'xterm-256color',
          cols: dimensions.cols,
          rows: dimensions.rows,
          cwd: options.process.cwd(),
          env: options.process.env,
        })

        ptyFuture.promise.then(() => {
          initScreen(username, hostname, options.shell, options.multiplex)
          if (options.shell.endsWith('bash')) {
            stdout.write('Adjusting shell prompt to show streaming indicator\n')
            term.write("export PS1='📡 [streaming] '$PS1\n")
          }
          if (options.shell.endsWith('zsh')) {
            stdout.write('Adjusting shell prompt to show streaming indicator\n')
            // FIXME: this doesnt work on macos (or its probably due to some conflict with powerlevel10k)
            term.write("PROMPT='📡 [streaming] '$PROMPT\n")
          }
          if (options.shell.endsWith('fish')) {
            stdout.write('Adjusting shell prompt to show streaming indicator\n')
            term.write(
              'functions -c fish_prompt __orig_fish_prompt; ' +
                "function fish_prompt; echo -n '📡 [streaming] '; __orig_fish_prompt; end\n",
            )
          }
        })

        // track own dimensions and keep it up to date
        setInterval(reEvaluateOwnDimensions, 1000)

        term.onData((d: string) => {
          stdout.write(d)

          if (!ptyReady) {
            ptyReady = true
            setTimeout(() => {
              ptyFuture.resolve!(true)
            }, 100)
          }

          if (sessionCount < 2) {
            // 1 sub for own channel session
            // < 2 means no subscribers. no point pushing data.
            return
          }
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
        printExitMessage(chalk.redBright('connection closed, terminated stream.'))
        process.exit(3)
      },
      onError: (err?: any) => {
        if (err instanceof Unauthorized) {
          printExitMessage(chalk.redBright(err.message))
        } else {
          printExitMessage(chalk.redBright('connection error, terminated stream.'))
        }
        process.exit(4)
      },
      onMessage: ({from: {session}, t, d}) => {
        switch (t) {
          case MessageType.DIMENSIONS:
            userDimensions[session] = d
            resizeBestFit(term, userDimensions, d.initial)
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
              printExitMessage(
                chalk.redBright(
                  `unexpected input from user: ${userId}, terminating stream for safety. Please report this issue`,
                ),
              )
              process.exit(5)
            }
        }
      },
      handleSessionJoin: (s) => {
        sessionCount++
      },
      handleSessionLeave: (s) => {
        sessionCount -= 1
        s && delete userDimensions[s]
        resizeBestFit(term, userDimensions)
      },
    })
  })
}

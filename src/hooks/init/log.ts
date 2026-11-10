import type {Hook} from '@oclif/core'

import {logger} from 'oorja/lib/log'

const configureLogging: Hook.Init = async ({config, id}) => {
  logger.configure(config.configDir, config.version)
  logger.info('cli.start', {command: id, pid: process.pid, nodeVersion: process.version})
}

export default configureLogging

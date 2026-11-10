import type {Hook} from '@oclif/core'

import {logger} from 'oorja/lib/log'

const configureLogging: Hook.Init = async ({config}) => {
  logger.configure(config.configDir, config.version)
}

export default configureLogging

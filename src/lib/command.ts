import {Command, Errors, Interfaces} from '@oclif/core'

import {logger} from 'oorja/lib/log'

export abstract class BaseCommand extends Command {
  protected async catch(error: Interfaces.CommandError) {
    if (error instanceof Errors.CLIError || error instanceof Errors.ExitError) {
      return super.catch(error)
    }

    logger.reportError(`command.${this.id || 'unknown'}`, error)
    return super.catch(error)
  }
}

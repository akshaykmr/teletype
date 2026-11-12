import {Command, Errors, Interfaces} from '@oclif/core'

import {logger} from 'oorja/lib/log'
import {isPromptCancelled} from 'oorja/lib/utils'

export abstract class BaseCommand extends Command {
  protected async catch(error: Interfaces.CommandError) {
    if (isPromptCancelled(error)) {
      this.exit(0)
    }
    if (error instanceof Errors.CLIError || error instanceof Errors.ExitError) {
      return super.catch(error)
    }

    logger.reportError(`command.${this.id || 'unknown'}`, error)
    return super.catch(error)
  }
}

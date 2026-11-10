import {closeSync, fchmodSync, mkdirSync, openSync, writeSync} from 'node:fs'
import path from 'node:path'

type LoggerConfig = {
  path: string
  version: string
}

export class Logger {
  private config?: LoggerConfig

  configure = (directory: string, version: string) => {
    this.config = {
      path: path.join(directory, 'oorja.log'),
      version,
    }
    try {
      mkdirSync(directory, {recursive: true, mode: 0o700})
    } catch {
      // Logging remains best-effort.
    }
  }

  error = (event: string, error: unknown, context: Record<string, unknown> = {}) => {
    return this.append(() => ({
      ...context,
      level: 'error',
      event,
      ...this.errorDetails(error),
    }))
  }

  info = (event: string, context: Record<string, unknown> = {}) =>
    this.append(() => ({...context, level: 'info', event}))

  reportError = (event: string, error: unknown) => {
    const result = this.error(event, error)
    if (result.written) {
      writeSync(process.stderr.fd, `\nDetails logged to: ${result.path}\n`)
    }
  }

  private append = (entry: () => Record<string, unknown>) => {
    const config = this.config
    if (!config) {
      return {path: '', written: false}
    }
    const logPath = config.path
    try {
      const line = `${JSON.stringify({...entry(), version: config.version, timestamp: new Date().toISOString()})}\n`
      const file = openSync(logPath, 'a', 0o600)
      try {
        if (process.platform !== 'win32') {
          fchmodSync(file, 0o600)
        }
        writeSync(file, line)
      } finally {
        closeSync(file)
      }
      return {path: logPath, written: true}
    } catch {
      return {path: logPath, written: false}
    }
  }

  private errorDetails = (error: unknown, depth = 0): Record<string, unknown> => {
    if (!(error instanceof Error)) {
      return {message: String(error)}
    }

    return {
      name: error.constructor.name,
      message: error.message,
      stack: error.stack,
      cause: depth < 2 && error.cause !== undefined ? this.errorDetails(error.cause, depth + 1) : undefined,
    }
  }
}

export const logger = new Logger()

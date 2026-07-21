import {execFileSync} from 'child_process'
import {readlinkSync} from 'fs'

export const getShellCwd = (pid: number, platform: NodeJS.Platform = process.platform): string => {
  try {
    return readlinkSync(`/proc/${pid}/cwd`)
  } catch {
    // Fall through to a platform-specific implementation.
  }

  if (platform === 'darwin') {
    try {
      const output = execFileSync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], {encoding: 'utf8'})
      const cwd = output
        .split('\n')
        .find((line) => line.startsWith('n'))
        ?.slice(1)
      if (cwd) {
        return cwd
      }
    } catch {
      // Report the common error below.
    }
  }

  if (platform === 'win32') {
    throw new Error('Current shell directory lookup is not supported on Windows.')
  }
  throw new Error('Unable to determine the current shell directory.')
}

import {constants} from 'node:fs'
import {access} from 'node:fs/promises'
import {homedir} from 'node:os'
import {join} from 'node:path'

import type {createHarnessRuntimes, doctorHarnessHost, prepareHarnessHost} from 'oorja-harness-host/harnesses'
import type {HarnessHost, HarnessHostOptions} from 'oorja-harness-host/host'
import ora from 'ora'

type HarnessHostPackage = {
  HarnessHost: {start: (options: HarnessHostOptions) => Promise<HarnessHost>}
  createHarnessRuntimes: typeof createHarnessRuntimes
  doctorHarnessHost: typeof doctorHarnessHost
  prepareHarnessHost: typeof prepareHarnessHost
}

export const loadHarnessHost = async () => {
  const packageName = 'oorja-harness-host'
  try {
    import.meta.resolve(packageName)
  } catch (error) {
    throw new Error('Harness hosting is not installed. Install it with: npm install --global oorja-harness-host', {
      cause: error,
    })
  }
  return import(packageName) as Promise<HarnessHostPackage>
}

export const checkHarnessSetup = async (cwd: string) => {
  const spinner = ora('Checking Harness Host setup').start()
  try {
    const {createHarnessRuntimes} = await loadHarnessHost()
    await checkHarnessPrerequisites(cwd)
    await getPreparedRuntimes(createHarnessRuntimes())
    spinner.stop()
  } catch (error) {
    spinner.fail('Harness Host setup is incomplete. For setup checks, run: oorja harness-host:doctor')
    throw error
  }
}

export const checkHarnessPrerequisites = async (cwd: string) => {
  const {doctorHarnessHost} = await loadHarnessHost()
  const results = await doctorHarnessHost(cwd)
  const failures = new Map<string, string>()
  for (const {checks} of results) {
    for (const check of checks) {
      if (!check.ok) {
        failures.set(
          check.name,
          check.name === 'pnpm' ? 'pnpm is required. Install it with: npm install --global pnpm' : check.detail,
        )
      }
    }
  }
  if (failures.size) {
    throw new Error([...failures.values()].join('\n'))
  }
}

export const getPreparedRuntimes = async (
  runtimes: HarnessHostOptions['runtimes'],
): Promise<HarnessHostOptions['runtimes']> => {
  const commands = {codex: 'codex', 'claude-code': 'claude', opencode: 'opencode', pi: 'pi'}
  const prepared: HarnessHostOptions['runtimes'] = []
  for (const runtime of runtimes) {
    const harness = runtime.harnessId
    const command = commands[harness]
    const executable = process.platform === 'win32' && harness !== 'pi' ? `${command}.cmd` : command
    const path = join(homedir(), '.ai-sdk-harness', '.harness-bootstrap', harness, 'node_modules', '.bin', executable)
    try {
      await access(path, constants.X_OK)
      prepared.push(runtime)
    } catch {
      continue
    }
  }
  if (!prepared.length) {
    throw new Error(
      'No agent runtimes are set up.\nSet up one: oorja harness-host:prepare codex\nOr set up all: oorja harness-host:prepare all',
    )
  }
  return prepared
}

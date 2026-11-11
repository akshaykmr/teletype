import {Errors} from '@oclif/core'
import type {
  doctorHarnessHost,
  getAvailableHarnesses,
  prepareHarnessHost,
} from 'oorja-harness-host/harnesses'
import type {startHarnessHost} from 'oorja-harness-host/host'
import type {HarnessId} from 'oorja-harness-host/messages'
import ora from 'ora'

type HarnessHostPackage = {
  HarnessId: Record<string, HarnessId>
  doctorHarnessHost: typeof doctorHarnessHost
  getAvailableHarnesses: typeof getAvailableHarnesses
  prepareHarnessHost: typeof prepareHarnessHost
  startHarnessHost: typeof startHarnessHost
}

export const loadHarnessHost = async () => {
  const packageName = 'oorja-harness-host'
  try {
    import.meta.resolve(packageName)
  } catch {
    throw new Errors.CLIError(
      'Harness hosting is not installed.\nInstall it with: npm install --global oorja-harness-host',
      {exit: 1},
    )
  }
  return import(packageName) as Promise<HarnessHostPackage>
}

export const checkHarnessSetup = async (cwd: string) => {
  const {getAvailableHarnesses} = await loadHarnessHost()
  const spinner = ora('Checking Harness Host setup').start()
  try {
    await checkHarnessPrerequisites(cwd)
    const harnesses = await getAvailableHarnesses()
    if (harnesses.length === 0) {
      throw new Errors.CLIError(
        'No agents are available.\nSet up one: oorja harness-host:prepare codex\nOr set up all: oorja harness-host:prepare all\nIf already set up, check your agent sign-in or API keys.',
        {exit: 1},
      )
    }
    spinner.stop()
  } catch (error) {
    if (error instanceof Errors.CLIError) {
      spinner.stop()
    } else {
      spinner.fail('Could not check Harness Host setup. Run: oorja harness-host:doctor')
    }
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
    throw new Errors.CLIError([...failures.values()].join('\n'), {exit: 1})
  }
}

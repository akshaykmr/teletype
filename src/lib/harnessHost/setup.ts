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
    const {getAvailableHarnesses} = await loadHarnessHost()
    await checkHarnessPrerequisites(cwd)
    const harnesses = await getAvailableHarnesses()
    if (harnesses.length === 0) {
      throw new Error(
        'No agent runtimes are set up.\nSet up one: oorja harness-host:prepare codex\nOr set up all: oorja harness-host:prepare all',
      )
    }
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

import type {HarnessId} from 'oorja-harness-host/messages'
import type {ModelDiscovery} from './doctor.js'

try {
  const {createHarnessRuntimes} = await import('oorja-harness-host/harnesses')
  const [runtime] = createHarnessRuntimes([process.argv[2] as HarnessId])
  const result: ModelDiscovery = {ok: true, models: await runtime.getModels()}
  process.send!(result)
} catch (error) {
  const result: ModelDiscovery = {ok: false, error: error instanceof Error ? error.message : String(error)}
  process.send!(result)
}

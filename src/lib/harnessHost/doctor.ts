import {fork, spawnSync} from 'node:child_process'
import type {HarnessId, HarnessModels} from 'oorja-harness-host/messages'

import {loadHarnessHost} from 'oorja/lib/harnessHost/setup'

export enum HarnessReadiness {
  READY = 'ready',
  UNAVAILABLE = 'unavailable',
  BLOCKED = 'blocked',
}

export type ModelDiscovery = {ok: true; models: HarnessModels} | {ok: false; error: string}

type Prerequisite = {name: string; ok: boolean; detail: string; requiredBy: HarnessId[]}
type AgentDiagnosis = {harnessId: HarnessId} & (
  | {status: HarnessReadiness.READY; models: HarnessModels; error?: never}
  | {status: HarnessReadiness.UNAVAILABLE | HarnessReadiness.BLOCKED; error: string; models?: never}
)

export type HarnessDiagnosis = {ok: boolean; prerequisites: Prerequisite[]; harnesses: AgentDiagnosis[]}

export const diagnoseHarnessHost = async (
  cwd: string,
  {timeout, signal}: {timeout: number; signal: AbortSignal},
): Promise<HarnessDiagnosis> => {
  const {doctorHarnessHost} = await loadHarnessHost()
  const results = await doctorHarnessHost(cwd)
  const prerequisites = new Map<string, Prerequisite>()
  for (const {harnessId, checks} of results) {
    for (const check of checks) {
      const detail =
        check.name === 'pnpm' && !check.ok
          ? 'pnpm is required. Install it with: npm install --global pnpm'
          : check.detail
      const key = JSON.stringify([check.name, check.ok, detail])
      const existing = prerequisites.get(key)
      if (existing) {
        existing.requiredBy.push(harnessId)
      } else {
        prerequisites.set(key, {...check, detail, requiredBy: [harnessId]})
      }
    }
  }
  const harnesses = await Promise.all(
    results.map(async ({harnessId, checks}): Promise<AgentDiagnosis> => {
      const failed = checks.filter((check) => !check.ok)
      if (failed.length) {
        return {
          harnessId,
          status: HarnessReadiness.BLOCKED,
          error: `Requires: ${failed.map(({name}) => name).join(', ')}`,
        }
      }
      const discovery = await discoverModels(harnessId, timeout, signal)
      if (!discovery.ok) {
        return {harnessId, status: HarnessReadiness.UNAVAILABLE, error: discovery.error}
      }
      if (discovery.models.models.length === 0) {
        return {harnessId, status: HarnessReadiness.UNAVAILABLE, error: 'No models were reported.'}
      }
      return {harnessId, status: HarnessReadiness.READY, models: discovery.models}
    }),
  )
  return {
    ok:
      results.every(({checks}) => checks.every(({ok}) => ok)) &&
      harnesses.some(({status}) => status === HarnessReadiness.READY),
    prerequisites: [...prerequisites.values()],
    harnesses,
  }
}

const discoverModels = (harnessId: HarnessId, timeout: number, signal: AbortSignal): Promise<ModelDiscovery> => {
  if (signal.aborted) {
    return Promise.resolve({ok: false, error: 'Model discovery interrupted.'})
  }
  // An SDK can start processes and stall. Isolate discovery so the deadline can
  // terminate the whole probe, including its agent subprocesses.
  const child = fork(new URL('./doctorModels.js', import.meta.url), [harnessId], {
    detached: process.platform !== 'win32',
    execArgv: [],
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  return new Promise((resolve) => {
    let result: ModelDiscovery | undefined
    let stderr = ''
    child.stderr!.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-8192)
    })
    const stop = () => {
      if (!child.pid) {
        return
      }
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {stdio: 'ignore', timeout: 5000})
      } else {
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
            throw error
          }
        }
      }
    }
    const finish = (value: ModelDiscovery) => {
      if (result) {
        return
      }
      result = value
      clearTimeout(timer)
      stop()
    }
    const timer = setTimeout(
      () => finish({ok: false, error: `Model discovery timed out after ${timeout / 1000}s.`}),
      timeout,
    )
    const interrupted = () => finish({ok: false, error: 'Model discovery interrupted.'})
    signal.addEventListener('abort', interrupted, {once: true})
    process.once('exit', stop)
    child.once('message', (value: ModelDiscovery) => finish(value))
    child.once('error', (error) => finish({ok: false, error: error.message}))
    child.once('close', (code) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', interrupted)
      process.removeListener('exit', stop)
      // A probe may crash before it can send an IPC result.
      stop()
      resolve(result ?? {ok: false, error: stderr.trim() || `Model discovery exited with code ${code}.`})
    })
    if (signal.aborted) {
      interrupted()
    }
  })
}

import assert from 'node:assert/strict'
import {spawn, spawnSync} from 'node:child_process'
import {once} from 'node:events'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {setTimeout as delay} from 'node:timers/promises'

const fixture = (missingPnpm = false) => {
  const home = mkdtempSync(path.join(tmpdir(), 'oorja-doctor-'))
  const bin = path.join(home, 'bin')
  mkdirSync(bin)
  if (!missingPnpm) {
    writeFileSync(path.join(bin, 'pnpm'), '#!/bin/sh\nprintf "11.5.2\\n"\n', {mode: 0o700})
  }
  const env = {HOME: home, XDG_CONFIG_HOME: home, PATH: bin, NO_COLOR: '1'}
  const args = ['bin/run.js', 'harness-host:doctor']
  const run = (...flags: string[]) => {
    const result = spawnSync(process.execPath, [...args, ...flags], {encoding: 'utf8', timeout: 90000, env})
    assert.ifError(result.error)
    return result
  }
  const codex = (hang = false) => {
    const command = path.join(home, '.ai-sdk-harness', '.harness-bootstrap', 'codex', 'node_modules', '.bin', 'codex')
    mkdirSync(path.dirname(command), {recursive: true})
    writeFileSync(
      command,
      `#!${process.execPath}
const {createInterface} = require('node:readline');
${
  hang
    ? `
const {spawn} = require('node:child_process');
const {writeFileSync} = require('node:fs');
const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'ignore'});
writeFileSync(${JSON.stringify(path.join(home, 'probe-pids.json'))}, JSON.stringify({worker: process.ppid, agent: process.pid, child: child.pid}));
setInterval(() => {}, 1000);
`
    : `
createInterface({input: process.stdin}).on('line', (line) => {
  const request = JSON.parse(line);
  if (request.id === undefined) return;
  const result = request.method === 'model/list'
    ? {data: [{id: 'example-fast', isDefault: true}, {id: 'example-reasoning', isDefault: false}]}
    : {};
  console.log(JSON.stringify({id: request.id, result}));
});
`
}
`,
      {mode: 0o700},
    )
  }
  const clean = () => {
    const pids = path.join(home, 'probe-pids.json')
    if (existsSync(pids)) {
      const {worker} = JSON.parse(readFileSync(pids, 'utf8'))
      try {
        process.kill(-worker, 'SIGKILL')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
          throw error
        }
      }
    }
    rmSync(home, {recursive: true, force: true})
  }
  return {home, env, args, run, codex, clean}
}

test(
  'doctor reports shared prerequisites once and fails with no available agents',
  {skip: process.platform === 'win32'},
  (t) => {
    const f = fixture()
    t.after(f.clean)
    const result = f.run('--json')
    assert.equal(result.status, 1, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.ok, false)
    assert.equal(report.prerequisites.filter(({name}: {name: string}) => name === 'pnpm').length, 1)
    assert.equal(report.prerequisites.filter(({name}: {name: string}) => name === 'node').length, 1)
    assert.equal(report.prerequisites.filter(({name}: {name: string}) => name === 'home').length, 1)
    assert.equal(report.harnesses.length, 4)
    assert.ok(report.harnesses.every(({status}: {status: string}) => status === 'unavailable'))
  },
)

test(
  'one agent with models is enough; other missing agents remain visible',
  {skip: process.platform === 'win32'},
  (t) => {
    const f = fixture()
    t.after(f.clean)
    f.codex()
    const result = f.run('--json')
    assert.equal(result.status, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.ok, true)
    const codex = report.harnesses.find(({harnessId}: {harnessId: string}) => harnessId === 'codex')
    assert.equal(codex.status, 'ready')
    assert.deepEqual(codex.models, {models: ['example-fast', 'example-reasoning'], defaultModel: 'example-fast'})
    assert.ok(
      report.harnesses
        .filter(({harnessId}: {harnessId: string}) => harnessId !== 'codex')
        .every(({status}: {status: string}) => status !== 'ready'),
    )
    const text = f.run()
    assert.equal(text.status, 0, text.stderr)
    assert.match(text.stdout, /Prerequisites/)
    assert.equal((text.stdout.match(/^\s*[✔✖] pnpm\s/gm) ?? []).length, 1)
    assert.match(text.stdout, /example-fast/)
  },
)

test('reports available models without hiding failed host prerequisites', {skip: process.platform === 'win32'}, (t) => {
  const f = fixture(true)
  t.after(f.clean)
  const agentDir = path.join(f.home, '.pi', 'agent')
  mkdirSync(agentDir, {recursive: true})
  writeFileSync(path.join(agentDir, 'auth.json'), JSON.stringify({deepseek: {type: 'api_key', key: 'test'}}))
  const result = f.run('--json')
  assert.equal(result.status, 1, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.ok, false)
  assert.equal(report.harnesses.find(({harnessId}: {harnessId: string}) => harnessId === 'pi').status, 'ready')
  assert.equal(report.harnesses.find(({harnessId}: {harnessId: string}) => harnessId === 'codex').status, 'blocked')
  const pnpm = report.prerequisites.filter(({name}: {name: string}) => name === 'pnpm')
  assert.equal(pnpm.length, 1)
  assert.equal(pnpm[0].ok, false)
  assert.ok(!pnpm[0].requiredBy.includes('pi'))
})

const assertProbeStopped = (home: string) => {
  const pids = JSON.parse(readFileSync(path.join(home, 'probe-pids.json'), 'utf8'))
  for (const pid of Object.values(pids) as number[]) {
    try {
      if (process.platform === 'linux') {
        assert.equal(
          readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].startsWith('Z'),
          true,
          `probe process ${pid} still running`,
        )
      } else {
        process.kill(pid, 0)
        assert.fail(`probe process ${pid} still running`)
      }
    } catch (error) {
      if (!['ENOENT', 'ESRCH'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        throw error
      }
    }
  }
}

test('model discovery has a deadline and removes agent subprocesses', {skip: process.platform === 'win32'}, (t) => {
  const f = fixture()
  t.after(f.clean)
  f.codex(true)
  const result = f.run('--json', '--timeout', '30')
  assert.equal(result.status, 1, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.match(report.harnesses.find(({harnessId}: {harnessId: string}) => harnessId === 'codex').error, /timed out/)
  assertProbeStopped(f.home)
})

test(
  'interrupting doctor cleans up model discovery and its subprocesses',
  {skip: process.platform === 'win32'},
  async (t) => {
    const f = fixture()
    t.after(f.clean)
    f.codex(true)
    const child = spawn(process.execPath, [...f.args, '--json'], {env: f.env, stdio: 'ignore'})
    t.after(() => {
      if (child.exitCode === null) {
        child.kill()
      }
    })
    const exited = once(child, 'close')
    const deadline = Date.now() + 60000
    while (!existsSync(path.join(f.home, 'probe-pids.json')) && Date.now() < deadline) {
      await delay(25)
    }
    assert.ok(existsSync(path.join(f.home, 'probe-pids.json')))
    child.kill('SIGTERM')
    const [code] = await exited
    assert.equal(code, 143)
    assertProbeStopped(f.home)
  },
)

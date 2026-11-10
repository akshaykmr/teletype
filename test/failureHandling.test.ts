import assert from 'node:assert/strict'
import {existsSync, mkdtempSync, readFileSync, statSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {spawnSync} from 'node:child_process'
import test from 'node:test'

import {Logger} from 'oorja/lib/log'
import {ConnectClient} from 'oorja/lib/connect/index'
import {Unauthorized} from 'oorja/lib/connect/errors'

test('writes private structured error logs synchronously', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oorja-log-'))
  const logger = new Logger()
  logger.configure(directory, '3.0.0')

  const result = logger.error('space.create', new Error('request failed', {cause: new Error('connection reset')}))

  assert.equal(result.written, true)
  if (process.platform !== 'win32') {
    assert.equal(statSync(result.path).mode & 0o777, 0o600)
  }
  const entry = JSON.parse(readFileSync(result.path, 'utf8'))
  assert.equal(entry.version, '3.0.0')
  assert.equal(entry.event, 'space.create')
  assert.equal(entry.message, 'request failed')
  assert.equal(entry.cause.message, 'connection reset')
})

test('does not replace the original failure when the log cannot be written', () => {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'oorja-log-')), 'file')
  writeFileSync(file, '')
  const logger = new Logger()
  logger.configure(file, '3.0.0')

  assert.deepEqual(logger.error('space.create', new Error('request failed')), {
    path: path.join(file, 'oorja.log'),
    written: false,
  })
})

test('the CLI prints the error and persists its log before exiting', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oorja-log-'))
  const result = spawnSync(process.execPath, ['bin/run.js', 'teletype', 'invalid-stream-key'], {
    encoding: 'utf8',
    env: {...process.env, XDG_CONFIG_HOME: directory},
  })
  const logPath = path.join(directory, 'oorja', 'oorja.log')

  assert.equal(result.status, 1)
  assert.ok(result.stderr.includes(`Details logged to: ${logPath}`))
  assert.match(result.stdout, /invalid stream-key/)
  assert.match(readFileSync(logPath, 'utf8'), /"event":"stream-key.invalid"/)
})

test('does not log ordinary command usage errors', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oorja-log-'))
  const result = spawnSync(process.execPath, ['bin/run.js', 'teletype', '--not-a-flag'], {
    encoding: 'utf8',
    env: {...process.env, XDG_CONFIG_HOME: directory},
  })

  assert.equal(result.status, 2)
  assert.equal(existsSync(path.join(directory, 'oorja', 'oorja.log')), false)
})

test('HTTP failures retain status details and authentication error types', async (t) => {
  const client = new ConnectClient('prod', 'us', '')
  const response = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('', {status: 503, statusText: 'Unavailable'}),
  )
  await assert.rejects(
    client.createRoom({roomName: 'test', apps: {defaultFocus: '39', appList: []}}),
    /HTTP 503 Unavailable/,
  )
  response.mock.mockImplementation(async () => new Response('', {status: 401, statusText: 'Unauthorized'}))
  await assert.rejects(
    client.fetchSessionUser(),
    (error) => error instanceof Unauthorized && error.message.includes('401'),
  )
})

import assert from 'node:assert/strict'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync} from 'node:fs'
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
  const entries = readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  assert.equal(entries[0].event, 'cli.start')
  assert.equal(entries[0].level, 'info')
  assert.equal(entries[0].command, 'teletype')
  assert.equal(entries[0].pid, result.pid)
  assert.equal(entries[0].nodeVersion, process.version)
  assert.equal(entries[1].event, 'stream-key.invalid')
  assert.match(entries[1].message, /invalid stream-key/)
})

test('does not log ordinary command usage errors', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oorja-log-'))
  const result = spawnSync(process.execPath, ['bin/run.js', 'teletype', '--not-a-flag'], {
    encoding: 'utf8',
    env: {...process.env, XDG_CONFIG_HOME: directory},
  })

  assert.equal(result.status, 2)
  const entries = readFileSync(path.join(directory, 'oorja', 'oorja.log'), 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  assert.equal(entries.length, 1)
  assert.equal(entries[0].event, 'cli.start')
  assert.equal(entries[0].level, 'info')
})

test('connection failure logs its cause before displaying the message and exiting', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'oorja-log-'))
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import {App} from 'oorja/lib/oorja/index';
    import {Config} from 'oorja/lib/config';
    import {logger} from 'oorja/lib/log';
    const directory = process.argv[1];
    logger.configure(directory, 'test');
    globalThis.fetch = async () => { throw new Error('simulated connection failure'); };
    await new App(new Config(directory)).init({authMode: 'anonymous'});
  `,
      directory,
    ],
    {encoding: 'utf8', timeout: 5000},
  )

  assert.equal(result.status, 1)
  assert.match(result.stdout + result.stderr, /There seems to be a connection issue/)
  const entry = JSON.parse(readFileSync(path.join(directory, 'oorja.log'), 'utf8'))
  assert.equal(entry.event, 'connection.establish')
  assert.equal(entry.message, 'simulated connection failure')
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

for (const scenario of [
  {name: 'missing pnpm', args: ['teletype', '--anonymous', '--new', '--harness-host'], path: '', status: 1},
  {
    name: 'no prepared runtimes',
    args: ['teletype', '--anonymous', '--new', '--harness-host'],
    path: process.env.PATH,
    status: 1,
  },
  {name: 'standalone missing pnpm', args: ['harness-host:run'], path: '', status: 1},
  {name: 'ordinary Teletype skips harness setup', args: ['teletype', '--anonymous', '--new'], path: '', status: 99},
]) {
  test(`setup before network access: ${scenario.name}`, {skip: process.platform === 'win32'}, (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'oorja-preflight-'))
    t.after(() => rmSync(directory, {recursive: true, force: true}))
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import {execute} from '@oclif/core';
      globalThis.fetch = () => process.exit(99);
      await execute({dir: process.cwd(), args: process.argv.slice(1)});
    `,
        ...scenario.args,
      ],
      {
        encoding: 'utf8',
        timeout: 10000,
        env: {...process.env, HOME: directory, XDG_CONFIG_HOME: directory, PATH: scenario.path},
      },
    )
    assert.equal(result.status, scenario.status, result.stdout + result.stderr)
    assert.equal(existsSync(path.join(directory, '.ai-sdk-harness')), false)
  })
}

test('ordinary Teletype does not load the optional Harness Host package', () => {
  const rejectHarnessHost = `data:text/javascript,${encodeURIComponent(`
    import {registerHooks} from 'node:module';
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('oorja-harness-host')) {
          throw new Error('Harness Host must remain optional');
        }
        return nextResolve(specifier, context);
      },
    });
  `)}`
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      rejectHarnessHost,
      '--input-type=module',
      '-e',
      `
        import {execute} from '@oclif/core';
        globalThis.fetch = () => process.exit(99);
        await execute({dir: process.cwd(), args: ['teletype', '--anonymous', '--new']});
      `,
    ],
    {encoding: 'utf8', timeout: 10000},
  )

  assert.equal(result.status, 99, result.stdout + result.stderr)
})

for (const preparedPi of [false, true]) {
  test(
    `Harness Host startup with ${preparedPi ? 'only Pi' : 'no runtimes'} prepared`,
    {skip: process.platform === 'win32'},
    (t) => {
      const directory = mkdtempSync(path.join(tmpdir(), 'oorja-harness-'))
      t.after(() => rmSync(directory, {recursive: true, force: true}))
      if (preparedPi) {
        const bin = path.join(directory, '.ai-sdk-harness', '.harness-bootstrap', 'pi', 'node_modules', '.bin')
        mkdirSync(bin, {recursive: true})
        symlinkSync(process.execPath, path.join(bin, 'pi'))
        const agent = path.join(directory, '.pi', 'agent')
        mkdirSync(agent, {recursive: true})
        writeFileSync(path.join(agent, 'auth.json'), JSON.stringify({deepseek: {type: 'api_key', key: 'test'}}))
      }
      const result = spawnSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `
      import assert from 'node:assert/strict';
      import {HarnessHostConnection} from 'oorja/lib/harnessHost/index';
      import {checkHarnessSetup} from 'oorja/lib/harnessHost/setup';
      import {createRoomKey, decrypt} from 'oorja/lib/encryption';
      const roomKey = createRoomKey('test');
      const state = Promise.withResolvers();
      const host = new HarnessHostConnection({
        userId: 'test', machineId: 'test', roomKey,
        process, multiplayer: false, stateFile: process.env.HOME + '/host.sqlite',
        joinChannel: ({onJoin}) => {
          queueMicrotask(onJoin);
          return {push: (_event, message) => state.resolve(decrypt(message.d, roomKey)), leave() {}};
        },
      });
      await checkHarnessSetup(process.cwd());
      await host.start();
      assert.deepEqual((await state.promise).harnesses, ['pi']);
      await host.stop();
    `,
        ],
        {encoding: 'utf8', timeout: 10000, env: {...process.env, HOME: directory}},
      )

      assert.equal(result.status, preparedPi ? 0 : 1, result.stderr)
      assert.equal(existsSync(path.join(directory, 'host.sqlite')), preparedPi)
      assert.equal(existsSync(path.join(directory, '.ai-sdk-harness')), preparedPi)
    },
  )
}

for (const scenario of [
  {name: 'missing shell fails', missing: true, exitCode: 0, multishell: false, status: 1},
  {name: 'nonzero shell exit fails', missing: false, exitCode: 7, multishell: false, status: 1},
  {name: 'normal shell exit succeeds', missing: false, exitCode: 0, multishell: false, status: 0},
  {name: 'multishell keeps hosting after shell failure', missing: false, exitCode: 7, multishell: true, status: 0},
]) {
  test(scenario.name, {skip: process.platform === 'win32'}, (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'oorja-shell-'))
    t.after(() => rmSync(directory, {recursive: true, force: true}))
    const shell = path.join(directory, 'shell')
    if (!scenario.missing) {
      writeFileSync(shell, `#!/bin/sh\nexit ${scenario.exitCode}\n`, {mode: 0o700})
    }
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import {TeletypeManager} from 'oorja/lib/teletype/index';
      import {logger} from 'oorja/lib/log';
      import {createRoomKey} from 'oorja/lib/encryption';
      const [directory, shell, mode] = process.argv.slice(1);
      const multishell = mode === 'multi';
      logger.configure(directory, 'test');
      await new TeletypeManager({
        userId: 'test', roomKey: createRoomKey('test'), shell,
        multiplex: false, multishell, streamingIndicator: false, harnessHost: false, process,
        joinChannel: ({onJoin}) => {
          queueMicrotask(onJoin);
          return {
            push: (_event, message) => {
              if (message.t === 'stream_exited' && multishell) {
                setImmediate(() => {
                  console.log('TEST_STILL_HOSTING');
                  process.emit('SIGINT');
                });
              }
            },
            leave() {},
          };
        },
      }).run();
    `,
        directory,
        shell,
        scenario.multishell ? 'multi' : 'single',
      ],
      {encoding: 'utf8', timeout: 5000},
    )

    assert.equal(result.status, scenario.status, result.stdout + result.stderr)
    const failed = scenario.missing || scenario.exitCode !== 0
    const logPath = path.join(directory, 'oorja.log')
    assert.equal(existsSync(logPath), failed)
    if (failed) {
      assert.equal(JSON.parse(readFileSync(logPath, 'utf8')).level, 'error')
    }
    if (scenario.multishell) {
      assert.match(result.stdout, /TEST_STILL_HOSTING/)
    }
  })
}

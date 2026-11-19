import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {mkdtempSync, rmSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {spawnStreamingShell} from 'oorja/lib/teletype/prompt'

const argumentsWithSpecialCharacters = ['two words', '', '--help', '--', '$HOME', '$(echo unexpected)', 'a;b', 'a|b']

test('multishell launches the same program and argv for each terminal', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
        import assert from 'node:assert/strict';
        import {TeletypeManager} from 'oorja/lib/teletype/index';
        import {createRoomKey, decrypt} from 'oorja/lib/encryption';
        const roomKey = createRoomKey('test');
        const output = {};
        let callbacks;
        let exits = 0;
        const manager = new TeletypeManager({
          userId: 'owner', roomKey, shell: process.execPath,
          launchArgs: ['-e', 'console.log(JSON.stringify(process.argv.slice(1)))', '--', 'two words', '$HOME'],
          multiplex: false, multishell: true, streamingIndicator: true, harnessHost: false, process,
          joinChannel(options) {
            callbacks = options;
            queueMicrotask(() => {
              options.handleSessionJoin('owner:browser:user', undefined, {metas: [{}]});
              options.onJoin();
            });
            return {
              leave() {},
              push(_event, message) {
                if (message.t === 'o') output[message.sid] = (output[message.sid] || '') + decrypt(message.d, roomKey);
                if (message.t === 'stream_exited') {
                  exits++;
                  setImmediate(() => {
                    if (exits === 1) {
                      callbacks.onMessage({from: {session: 'owner:browser:user'}, t: 'new_stream', d: {sid: '1'}});
                    } else {
                      process.emit('SIGINT');
                    }
                  });
                }
              },
            };
          },
        });
        await manager.run();
        assert.equal(exits, 2);
        for (const sid of ['1', '2']) assert.deepEqual(JSON.parse(output[sid].trim()), ['two words', '$HOME']);
      `,
    ],
    {encoding: 'utf8', timeout: 5000},
  )
  assert.equal(result.status, 0, result.stdout + result.stderr)
})

for (const scenario of [
  {name: 'default shell', argv: ['--new'], shell: '/test/default-shell', launchArgs: undefined},
  {name: 'selected shell', argv: ['--new', '--shell', 'fish'], shell: 'fish', launchArgs: undefined},
  {name: 'program without arguments', argv: ['--new', '--', 'htop'], shell: 'htop', launchArgs: []},
  {
    name: 'program arguments and flags',
    argv: ['--new', '--', 'program', ...argumentsWithSpecialCharacters],
    shell: 'program',
    launchArgs: argumentsWithSpecialCharacters,
  },
  {
    name: 'stream key before program',
    argv: ['sk-token:room#secret', '--', 'program', '--new'],
    shell: 'program',
    launchArgs: ['--new'],
  },
]) {
  test(`CLI launch target: ${scenario.name}`, (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'oorja-launch-'))
    t.after(() => rmSync(directory, {recursive: true, force: true}))
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import {execute} from '@oclif/core';
          import TeleTypeCommand from './dist/commands/teletype/index.js';
          // Exercise the real CLI parser, stopping before authentication/network use.
          globalThis.fetch = () => new Promise(() => {});
          const capture = async (_app, options) => {
            console.log(JSON.stringify({shell: options.shell, launchArgs: options.launchArgs}));
            process.exit(0);
          };
          TeleTypeCommand.prototype.createRoomAndStream = capture;
          TeleTypeCommand.prototype.streamUsingStreamKey = capture;
          await execute({dir: process.cwd(), args: ['teletype', ...process.argv.slice(1)]});
        `,
        '--',
        ...scenario.argv,
      ],
      {
        encoding: 'utf8',
        timeout: 5000,
        env: {...process.env, SHELL: '/test/default-shell', XDG_CONFIG_HOME: directory},
      },
    )
    assert.equal(result.status, 0, result.stdout + result.stderr)
    assert.deepEqual(JSON.parse(result.stdout), {
      shell: scenario.shell,
      ...(scenario.launchArgs === undefined ? {} : {launchArgs: scenario.launchArgs}),
    })
  })
}

for (const argv of [['--'], ['--shell', 'bash', '--', 'htop']]) {
  test(`rejects invalid launch usage before connecting: ${argv.join(' ')}`, (t) => {
    const directory = mkdtempSync(path.join(tmpdir(), 'oorja-launch-'))
    t.after(() => rmSync(directory, {recursive: true, force: true}))
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
          import {execute} from '@oclif/core';
          globalThis.fetch = () => process.exit(99);
          await execute({dir: process.cwd(), args: ['teletype', ...process.argv.slice(1)]});
        `,
        '--',
        ...argv,
      ],
      {encoding: 'utf8', timeout: 5000, env: {...process.env, XDG_CONFIG_HOME: directory}},
    )
    assert.equal(result.status, 2, result.stdout + result.stderr)
  })
}

test(
  'PTY launches a program directly with literal argv, cwd, environment, and exit status',
  {timeout: 5000},
  async () => {
    let output = ''
    const term = spawnStreamingShell(
      process.execPath,
      {name: 'xterm-256color', cols: 80, rows: 24, cwd: process.cwd(), env: {...process.env, TELETYPE_TEST: 'value'}},
      true,
      process.platform,
      [
        '-e',
        'console.log(JSON.stringify({args: process.argv.slice(1), cwd: process.cwd(), value: process.env.TELETYPE_TEST})); process.exitCode = 7;',
        '--',
        ...argumentsWithSpecialCharacters,
      ],
    )
    term.onData((data) => {
      output += data
    })
    const {exitCode} = await new Promise<{exitCode: number}>((resolve) => term.onExit(resolve))
    assert.equal(exitCode, 7)
    assert.deepEqual(JSON.parse(output.trim()), {
      args: argumentsWithSpecialCharacters,
      cwd: process.cwd(),
      value: 'value',
    })
  },
)

test(
  'explicit Bash arguments bypass prompt injection',
  {skip: process.platform === 'win32', timeout: 5000},
  async () => {
    let output = ''
    const term = spawnStreamingShell(
      '/bin/bash',
      {name: 'xterm-256color', cols: 80, rows: 24, cwd: process.cwd(), env: process.env},
      true,
      process.platform,
      ['--noprofile', '--norc', '-c', 'printf "EXPLICIT_PROGRAM\\n"'],
    )
    term.onData((data) => {
      output += data
    })
    const {exitCode} = await new Promise<{exitCode: number}>((resolve) => term.onExit(resolve))
    assert.equal(exitCode, 0)
    assert.equal(output.trim(), 'EXPLICIT_PROGRAM')
  },
)

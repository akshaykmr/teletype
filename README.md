oorja
=====

cli tool for interacting with oorja

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![Version](https://img.shields.io/npm/v/oorja.svg)](https://npmjs.org/package/oorja)
[![Downloads/week](https://img.shields.io/npm/dw/oorja.svg)](https://npmjs.org/package/oorja)
[![License](https://img.shields.io/npm/l/oorja.svg)](https://github.com/akshaykmr/oorja-cli/blob/master/package.json)

<!-- toc -->
* [Usage](#usage)
* [Commands](#commands)
<!-- tocstop -->
# Usage
<!-- usage -->
```sh-session
$ npm install -g oorja
$ oorja COMMAND
running command...
$ oorja (-v|--version|version)
oorja/1.1.0 linux-x64 node-v12.17.0
$ oorja --help [COMMAND]
USAGE
  $ oorja COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`oorja conf [KEY] [VALUE]`](#oorja-conf-key-value)
* [`oorja help [COMMAND]`](#oorja-help-command)
* [`oorja teletype [ROOM]`](#oorja-teletype-room)

## `oorja conf [KEY] [VALUE]`

manage configuration

```
USAGE
  $ oorja conf [KEY] [VALUE]

ARGUMENTS
  KEY    key of the config
  VALUE  value of the config

OPTIONS
  -d, --cwd=cwd          config file location
  -d, --delete           delete?
  -h, --help             show CLI help
  -k, --key=key          key of the config
  -n, --name=name        config file name
  -p, --project=project  project name
  -v, --value=value      value of the config
```

_See code: [conf-cli](https://github.com/natzcam/conf-cli/blob/v0.1.9/src/commands/conf.ts)_

## `oorja help [COMMAND]`

display help for oorja

```
USAGE
  $ oorja help [COMMAND]

ARGUMENTS
  COMMAND  command to show help for

OPTIONS
  --all  see all commands in CLI
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v3.1.0/src/commands/help.ts)_

## `oorja teletype [ROOM]`

Launch a terminal streaming session in oorja.

```
USAGE
  $ oorja teletype [ROOM]

OPTIONS
  -h, --help         show CLI help

  -m, --multiplex    allows room users to WRITE TO YOUR SHELL i.e enables collaboration mode. Make sure you trust room
                     participants. Off by default

  -s, --shell=shell  [default: /usr/bin/fish] shell to use. e.g. bash, fish

ALIASES
  $ oorja tty

EXAMPLES
  $ teletype
  will prompt to choose streaming destination - existing room or create a new one.


  $ teletype 'https://oorja.io/rooms?id=foo'
  will stream to the room specified by secret link, you must have joined the room before streaming.


  $ teletype -m 'https://oorja.io/rooms?id=foo'
  Will also allow room participants to write to your terminal!
```

_See code: [src/commands/teletype/index.ts](https://github.com/akshaykmr/oorja-cli/blob/v1.1.0/src/commands/teletype/index.ts)_
<!-- commandsstop -->

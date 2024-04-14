oclif-hello-world
=================

oclif example Hello World CLI

[![oclif](https://img.shields.io/badge/cli-oclif-brightgreen.svg)](https://oclif.io)
[![GitHub license](https://img.shields.io/github/license/oclif/hello-world)](https://github.com/oclif/hello-world/blob/main/LICENSE)

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
$ oorja (--version)
oorja/1.11.0 linux-x64 node-v18.18.0
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
* [`oorja signout`](#oorja-signout)
* [`oorja teletype [ROOM]`](#oorja-teletype-room)
* [`oorja tty [ROOM]`](#oorja-tty-room)

## `oorja conf [KEY] [VALUE]`

manage configuration

```
USAGE
  $ oorja conf [KEY] [VALUE] [-h] [-k <value>] [-v <value>] [-d] [-p <value>] [-n <value>] [-d <value>]

ARGUMENTS
  KEY    key of the config
  VALUE  value of the config

FLAGS
  -d, --cwd=<value>      config file location
  -d, --delete           delete?
  -h, --help             show CLI help
  -k, --key=<value>      key of the config
  -n, --name=<value>     config file name
  -p, --project=<value>  project name
  -v, --value=<value>    value of the config

DESCRIPTION
  manage configuration
```

_See code: [conf-cli](https://github.com/natzcam/conf-cli/blob/v0.1.9/src/commands/conf.ts)_

## `oorja help [COMMAND]`

Display help for oorja.

```
USAGE
  $ oorja help [COMMAND...] [-n]

ARGUMENTS
  COMMAND...  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for oorja.
```

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.21/src/commands/help.ts)_

## `oorja signout`

Sign-out of oorja. Clears saved auth-token

```
USAGE
  $ oorja signout

DESCRIPTION
  Sign-out of oorja. Clears saved auth-token
```

_See code: [src/commands/signout.ts](https://github.com/akshaykmr/teletype/blob/v1.11.0/src/commands/signout.ts)_

## `oorja teletype [ROOM]`

Launch a terminal streaming session in oorja.

```
USAGE
  $ oorja teletype [ROOM] [-h] [-s <value>] [-m] [-n]

FLAGS
  -h, --help           Show CLI help.
  -m, --multiplex      Allows room users to WRITE TO YOUR SHELL i.e enables collaboration mode. Make sure you trust room
                       participants. Off by default
  -n, --new_room       Create new room
  -s, --shell=<value>  [default: /usr/bin/zsh] shell to use. e.g. bash, fish

DESCRIPTION
  Launch a terminal streaming session in oorja.

ALIASES
  $ oorja tty

EXAMPLES
  $ teletype
  Will prompt to choose streaming destination - existing room or create a new one.

  $ teletype 'https://oorja.io/rooms?id=foo#key'
  Will stream to the room specified by secret link, you must have joined the room before streaming.

  $ teletype -m
  Will also allow room participants to write to your terminal!
```

_See code: [src/commands/teletype/index.ts](https://github.com/akshaykmr/teletype/blob/v1.11.0/src/commands/teletype/index.ts)_

## `oorja tty [ROOM]`

Launch a terminal streaming session in oorja.

```
USAGE
  $ oorja tty [ROOM] [-h] [-s <value>] [-m] [-n]

FLAGS
  -h, --help           Show CLI help.
  -m, --multiplex      Allows room users to WRITE TO YOUR SHELL i.e enables collaboration mode. Make sure you trust room
                       participants. Off by default
  -n, --new_room       Create new room
  -s, --shell=<value>  [default: /usr/bin/zsh] shell to use. e.g. bash, fish

DESCRIPTION
  Launch a terminal streaming session in oorja.

ALIASES
  $ oorja tty

EXAMPLES
  $ teletype
  Will prompt to choose streaming destination - existing room or create a new one.

  $ teletype 'https://oorja.io/rooms?id=foo#key'
  Will stream to the room specified by secret link, you must have joined the room before streaming.

  $ teletype -m
  Will also allow room participants to write to your terminal!
```
<!-- commandsstop -->

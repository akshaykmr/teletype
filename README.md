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
oorja/0.0.0 linux-x64 node-v12.17.0
$ oorja --help [COMMAND]
USAGE
  $ oorja COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`oorja hello [FILE]`](#oorja-hello-file)
* [`oorja help [COMMAND]`](#oorja-help-command)

## `oorja hello [FILE]`

describe the command here

```
USAGE
  $ oorja hello [FILE]

OPTIONS
  -f, --force
  -h, --help       show CLI help
  -n, --name=name  name to print

EXAMPLE
  $ oorja hello
  hello world from ./src/hello.ts!
```

_See code: [src/commands/hello.ts](https://github.com/akshaykmr/oorja-cli/blob/v0.0.0/src/commands/hello.ts)_

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
<!-- commandsstop -->

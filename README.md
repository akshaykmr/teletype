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
<!-- commandsstop -->

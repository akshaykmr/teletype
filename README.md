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
oorja/0.0.0 linux-x64 node-v18.18.0
$ oorja --help [COMMAND]
USAGE
  $ oorja COMMAND
...
```
<!-- usagestop -->
# Commands
<!-- commands -->
* [`oorja hello PERSON`](#oorja-hello-person)
* [`oorja hello world`](#oorja-hello-world)
* [`oorja help [COMMAND]`](#oorja-help-command)
* [`oorja plugins`](#oorja-plugins)
* [`oorja plugins add PLUGIN`](#oorja-plugins-add-plugin)
* [`oorja plugins:inspect PLUGIN...`](#oorja-pluginsinspect-plugin)
* [`oorja plugins install PLUGIN`](#oorja-plugins-install-plugin)
* [`oorja plugins link PATH`](#oorja-plugins-link-path)
* [`oorja plugins remove [PLUGIN]`](#oorja-plugins-remove-plugin)
* [`oorja plugins reset`](#oorja-plugins-reset)
* [`oorja plugins uninstall [PLUGIN]`](#oorja-plugins-uninstall-plugin)
* [`oorja plugins unlink [PLUGIN]`](#oorja-plugins-unlink-plugin)
* [`oorja plugins update`](#oorja-plugins-update)

## `oorja hello PERSON`

Say hello

```
USAGE
  $ oorja hello PERSON -f <value>

ARGUMENTS
  PERSON  Person to say hello to

FLAGS
  -f, --from=<value>  (required) Who is saying hello

DESCRIPTION
  Say hello

EXAMPLES
  $ oex hello friend --from oclif
  hello friend from oclif! (./src/commands/hello/index.ts)
```

_See code: [src/commands/hello/index.ts](https://github.com/akshaykmr/teletype/blob/v0.0.0/src/commands/hello/index.ts)_

## `oorja hello world`

Say hello world

```
USAGE
  $ oorja hello world

DESCRIPTION
  Say hello world

EXAMPLES
  $ oorja hello world
  hello world! (./src/commands/hello/world.ts)
```

_See code: [src/commands/hello/world.ts](https://github.com/akshaykmr/teletype/blob/v0.0.0/src/commands/hello/world.ts)_

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

_See code: [@oclif/plugin-help](https://github.com/oclif/plugin-help/blob/v6.0.20/src/commands/help.ts)_

## `oorja plugins`

List installed plugins.

```
USAGE
  $ oorja plugins [--json] [--core]

FLAGS
  --core  Show core plugins.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  List installed plugins.

EXAMPLES
  $ oorja plugins
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.0.6/src/commands/plugins/index.ts)_

## `oorja plugins add PLUGIN`

Installs a plugin into oorja.

```
USAGE
  $ oorja plugins add PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into oorja.

  Uses bundled npm executable to install plugins into /home/akshay/.local/share/oorja

  Installation of a user-installed plugin will override a core plugin.

  Use the OORJA_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the OORJA_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ oorja plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ oorja plugins add myplugin

  Install a plugin from a github url.

    $ oorja plugins add https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ oorja plugins add someuser/someplugin
```

## `oorja plugins:inspect PLUGIN...`

Displays installation properties of a plugin.

```
USAGE
  $ oorja plugins inspect PLUGIN...

ARGUMENTS
  PLUGIN...  [default: .] Plugin to inspect.

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Displays installation properties of a plugin.

EXAMPLES
  $ oorja plugins inspect myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.0.6/src/commands/plugins/inspect.ts)_

## `oorja plugins install PLUGIN`

Installs a plugin into oorja.

```
USAGE
  $ oorja plugins install PLUGIN... [--json] [-f] [-h] [-s | -v]

ARGUMENTS
  PLUGIN...  Plugin to install.

FLAGS
  -f, --force    Force npm to fetch remote resources even if a local copy exists on disk.
  -h, --help     Show CLI help.
  -s, --silent   Silences npm output.
  -v, --verbose  Show verbose npm output.

GLOBAL FLAGS
  --json  Format output as json.

DESCRIPTION
  Installs a plugin into oorja.

  Uses bundled npm executable to install plugins into /home/akshay/.local/share/oorja

  Installation of a user-installed plugin will override a core plugin.

  Use the OORJA_NPM_LOG_LEVEL environment variable to set the npm loglevel.
  Use the OORJA_NPM_REGISTRY environment variable to set the npm registry.

ALIASES
  $ oorja plugins add

EXAMPLES
  Install a plugin from npm registry.

    $ oorja plugins install myplugin

  Install a plugin from a github url.

    $ oorja plugins install https://github.com/someuser/someplugin

  Install a plugin from a github slug.

    $ oorja plugins install someuser/someplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.0.6/src/commands/plugins/install.ts)_

## `oorja plugins link PATH`

Links a plugin into the CLI for development.

```
USAGE
  $ oorja plugins link PATH [-h] [--install] [-v]

ARGUMENTS
  PATH  [default: .] path to plugin

FLAGS
  -h, --help          Show CLI help.
  -v, --verbose
      --[no-]install  Install dependencies after linking the plugin.

DESCRIPTION
  Links a plugin into the CLI for development.
  Installation of a linked plugin will override a user-installed or core plugin.

  e.g. If you have a user-installed or core plugin that has a 'hello' command, installing a linked plugin with a 'hello'
  command will override the user-installed or core plugin implementation. This is useful for development work.


EXAMPLES
  $ oorja plugins link myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.0.6/src/commands/plugins/link.ts)_

## `oorja plugins remove [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ oorja plugins remove [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ oorja plugins unlink
  $ oorja plugins remove

EXAMPLES
  $ oorja plugins remove myplugin
```

## `oorja plugins reset`

Remove all user-installed and linked plugins.

```
USAGE
  $ oorja plugins reset [--hard] [--reinstall]

FLAGS
  --hard       Delete node_modules and package manager related files in addition to uninstalling plugins.
  --reinstall  Reinstall all plugins after uninstalling.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.0.6/src/commands/plugins/reset.ts)_

## `oorja plugins uninstall [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ oorja plugins uninstall [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ oorja plugins unlink
  $ oorja plugins remove

EXAMPLES
  $ oorja plugins uninstall myplugin
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.0.6/src/commands/plugins/uninstall.ts)_

## `oorja plugins unlink [PLUGIN]`

Removes a plugin from the CLI.

```
USAGE
  $ oorja plugins unlink [PLUGIN...] [-h] [-v]

ARGUMENTS
  PLUGIN...  plugin to uninstall

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Removes a plugin from the CLI.

ALIASES
  $ oorja plugins unlink
  $ oorja plugins remove

EXAMPLES
  $ oorja plugins unlink myplugin
```

## `oorja plugins update`

Update installed plugins.

```
USAGE
  $ oorja plugins update [-h] [-v]

FLAGS
  -h, --help     Show CLI help.
  -v, --verbose

DESCRIPTION
  Update installed plugins.
```

_See code: [@oclif/plugin-plugins](https://github.com/oclif/plugin-plugins/blob/v5.0.6/src/commands/plugins/update.ts)_
<!-- commandsstop -->

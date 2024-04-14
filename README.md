TeleType
=====

cli tool that allows you to share your terminal online conveniently. Check out [oorja.io](https://oorja.io) - show off mad cli-fu, help a colleague, teach, or troubleshoot.

[![Version](https://img.shields.io/npm/v/oorja.svg)](https://npmjs.org/package/oorja)
[![Downloads/week](https://img.shields.io/npm/dw/oorja.svg)](https://npmjs.org/package/oorja)
[![Follow](https://img.shields.io/twitter/follow/oorja_app?style=social)](https://twitter.com/oorja_app)


<p align="center">
  <img width="600" src="https://teletype.oorja.io/images/cli-demo.svg">
</p>

<p align="center">
  <img src="https://teletype.oorja.io/images/teletype-session.png">
</p>

Your stream can be view-only or collaboration enabled (command-line flag).



<!-- toc -->
* [Install and stream!](#install-and-stream)
* [Commands](#commands)
<!-- tocstop -->

# Install and stream!

- You'll need Node 18.18.0 >. CLI is available via npm. <br />
  <a href="https://nodejs.org/en/download/" target="_blank">
  You can setup node/npm from here.
  </a> 
- Package does fail on some systems because of node-pty compilation failures. I'm thinking it's better to package the whole thing
as a binary in future releases (i.e. not available via npm but via a script or manual install).

- `npm install -g oorja`
- `teletype`
- `teletype -m`  (for collaboration mode)

Misc: If you have issues installing on apple M1 or similar systems:
- `sudo xcode-select --install`
- `CXXFLAGS="--std=c++17" npm install -g oorja`

**your stream is end-to-end encrypted**

**PRO TIP:**
Any participant in the room can stream their terminal(s) i.e there can be multiple streams at the same time, and you can switch between them like terminal tabs!

For options: `teletype -h` 

**Note**
This is the cli companion for [oorja.io](https://oorja.io) which is a privacy focussed collaboration tool with more features like voice, notes, and chat - [privacy policy](https://oorja.io/privacy_policy).
TLDR: Nothing stored on servers. Your data is end-to-end encrypted, synced between browsers (and cli) 🍻. No prying eyes. 

Like it ? [follow or tweet, tell your colleagues](https://twitter.com/oorja_app) 👩🏻‍💻

Love it ? [please subscribe](https://oorja.io/pricing) 🖖

Feel free to open [issues](https://github.com/akshaykmr/TeleType/issues) for bugs, improvements, app-discussions, and anything else really.

More ways to [contact](https://oorja.io/contact).


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

_See code: [src/commands/signout.ts](https://github.com/akshaykmr/teletype/blob/v1.11.2/src/commands/signout.ts)_

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

_See code: [src/commands/teletype/index.ts](https://github.com/akshaykmr/teletype/blob/v1.11.2/src/commands/teletype/index.ts)_

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

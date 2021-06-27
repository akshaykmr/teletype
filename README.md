TeleType
=====

cli tool that allows you to share your terminal online conveniently. Check out [teletype.oorja.io](https://teletype.oorja.io) - show off mad cli-fu, help a colleague, teach, or troubleshoot.

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

- Prerequisite: [nodejs `12.13.0` or later](https://nodejs.org/en/download/)

- **optional but highly recommended for successful install -> [npm install without sudo](https://github.com/sindresorhus/guides/blob/master/npm-global-without-sudo.md)**
- `npm install -g oorja`
- `teletype`
- `teletype -m`  (for collaboration mode)

**your stream is end-to-end encrypted**

**PRO TIP:**
Any participant in the room can stream their terminal(s) i.e there can be multiple streams at the same time, and you can switch between them like terminal tabs!

For options: `teletype -h` 

**Note**
This is the cli companion for [teletype.oorja.io](https://teletype.oorja.io) which is a privacy focussed collaboration tool with more features like voice, notes, and chat - [privacy policy](https://teletype.oorja.io/privacy_policy).
TLDR: Nothing stored on servers. Your data is end-to-end encrypted, synced between browsers (and cli) 🍻. No prying eyes. 

Like it ? [follow or tweet, tell your colleagues](https://twitter.com/oorja_app) 👩🏻‍💻

Love it ? [please subscribe](https://teletype.oorja.io/subscription) 🖖

Feel free to open [issues](https://github.com/akshaykmr/TeleType/issues) for bugs, improvements, app-discussions, and anything else really.

More ways to [contact](https://teletype.oorja.io/contact).


# Commands

* [`oorja teletype [ROOM]`](#oorja-teletype-room)
* [`oorja signout`](#oorja-signout)
* [`oorja help [COMMAND]`](#oorja-help-command)

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

_See code: [src/commands/teletype/index.ts](https://github.com/akshaykmr/teletype/blob/v1.2.3/src/commands/teletype/index.ts)_


## `oorja signout`

sign-out and clear saved access token from any prior login. By default cli
saves the token for any signed-in user (anonymous tokens aren't remembered).
Any new command will ask for a token again after sign-out.

```
USAGE
  $ oorja signout
```

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

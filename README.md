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

- You'll need Node 16. CLI is available via npm. <br />
  <a href="https://nodejs.org/en/download/" target="_blank">
  You can setup node/npm from here.
  </a> **Only Node 16 is supported**
- **optional but highly recommended for successful install -> [npm install without sudo](https://github.com/sindresorhus/guides/blob/master/npm-global-without-sudo.md)**.
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


  $ teletype 'https://oorja.io/rooms/foo#key'
  will stream to the room specified by secret link, you must have joined the room before streaming.


  $ teletype -m 'https://oorja.io/rooms/foo#key'
  Will also allow room participants to write to your terminal!
```

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

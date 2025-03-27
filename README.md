TeleType
=====

cli tool that allows you to share your terminal online conveniently. Check out [oorja.io](https://oorja.io) - show off mad cli-fu, help a colleague, teach, or troubleshoot.

[![Version](https://img.shields.io/npm/v/oorja.svg)](https://npmjs.org/package/oorja)
[![Downloads/week](https://img.shields.io/npm/dw/oorja.svg)](https://npmjs.org/package/oorja)
[![Follow](https://img.shields.io/twitter/follow/oorja_app?style=social)](https://twitter.com/oorja_app)


<p align="center">
  <img width="600" src="https://oorja.io/images/cli-demo.svg">
</p>

<p align="center">
  <img src="https://oorja.io/images/teletype-session.png">
</p>

Your stream can be view-only or collaboration enabled (command-line flag).


<!-- toc -->
* [Install and stream!](#install-and-stream)
* [Commands](#commands)
<!-- tocstop -->

# Install and stream!

- You'll need Node 22.10.0 >. CLI is available via npm. <br />
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
This is the cli companion for [oorja.io](https://oorja.io) which is a privacy focussed collaboration tool with more features like voice, notes, and chat - [privacy policy](https://oorja.io/privacy-policy).
TLDR: Your data is end-to-end encrypted, no prying eyes 🍻.

Like it ? [follow or tweet, tell your colleagues](https://twitter.com/oorja_app) 👩🏻‍💻

Open [issues](https://github.com/akshaykmr/TeleType/issues).

More ways to [contact](https://oorja.io/contact).


# Commands
<!-- commands-disabled -->
* [`oorja help [COMMAND]`](#oorja-help-command)
* [`oorja teletype [SPACE]`](#oorja-teletype-space)
* [`oorja signout`](#oorja-signout)

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

## `oorja teletype [SPACE_URL]`

Launch a terminal streaming session in oorja.

```
USAGE
  $ oorja teletype [SPACE_URL] [-h] [-s <value>] [-m] [-n]

FLAGS
  -h, --help           Show CLI help.
  -m, --multiplex      Allows users to WRITE TO YOUR SHELL i.e enables collaboration mode. Make sure you trust space
                       participants. Off by default
  -n, --new_space      Create new space
  -s, --shell=<value>  [default: /usr/bin/zsh] shell to use. e.g. bash, fish

DESCRIPTION
  Launch a terminal streaming session in oorja.

ALIASES
  $ oorja tty

EXAMPLES
  $ teletype
  Will prompt to choose streaming destination - existing space or create a new one.

  $ teletype 'https://oorja.io/spaces?id=foo#key'
  Will stream to the space specified by secret link, you must have joined the space before streaming.

  $ teletype -m
  Will also allow participants to write to your terminal!
```

## `oorja signout`

Sign-out of oorja. Clears saved auth-token

```
USAGE
  $ oorja signout

DESCRIPTION
  Sign-out of oorja. Clears saved auth-token
```

<!-- commandsstop-disabled -->

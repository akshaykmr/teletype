TeleType
=====

cli tool that allows you to share your terminal online conveniently. Check out [SupaKit](https://supakit.app) - show off mad cli-fu, help a colleague, teach, or troubleshoot.

[![Version](https://img.shields.io/npm/v/oorja.svg)](https://npmjs.org/package/oorja)
[![Downloads/week](https://img.shields.io/npm/dw/oorja.svg)](https://npmjs.org/package/oorja)
[![Follow](https://img.shields.io/twitter/follow/oorja_app?style=social)](https://twitter.com/oorja_app)


<p align="center">
  <img width="600" src="https://supakit.app/images/cli-demo.svg">
</p>

<p align="center">
  <img src="https://supakit.app/images/teletype-session.png">
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
- macOS: if teletype crashes with `Error: posix_spawnp failed.`, node-pty may have installed its helper without execute permissions ([node-pty#850](https://github.com/microsoft/node-pty/issues/850)). This should be fixed by a newer node-pty release. Workaround:
  `chmod +x "$(npm root -g)"/oorja/node_modules/node-pty/prebuilds/darwin-*/spawn-helper`

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
This is the cli companion for [SupaKit](https://supakit.app) which is a privacy focussed collaboration tool with more features like voice, notes, and chat - [privacy policy](https://supakit.app/privacy-policy).
TLDR: Your data is end-to-end encrypted, no prying eyes 🍻.

Like it ? [follow or tweet, tell your colleagues](https://twitter.com/oorja_app) 👩🏻‍💻

Open [issues](https://github.com/akshaykmr/TeleType/issues).

More ways to [contact](https://supakit.app/contact).


# Commands
<!-- commands -->
* [`oorja teletype [STREAMKEY]`](#oorja-teletype-streamkey)
* [`oorja signout`](#oorja-signout)
* [`oorja help [COMMAND]`](#oorja-help-command)

## `oorja teletype [STREAMKEY]`

Launch a terminal streaming session in SupaKit.

```
USAGE
  $ oorja teletype [STREAMKEY] [-h] [-s <value>] [-m] [-n] [--anonymous] [--ci-debug]

FLAGS
  -h, --help           Show CLI help.
  -m, --multiplex      Allows users to WRITE TO YOUR SHELL i.e enables collaboration mode. Make sure you trust space
                       participants. Off by default
  -n, --new            Create a new space
  -s, --shell=<value>  shell to use. e.g. bash, fish
      --anonymous      Create an anonymous session without prompting for sign-in.
      --ci-debug       Create a new anonymous writable bash stream for CI debugging.

DESCRIPTION
  Launch a terminal streaming session in SupaKit.

ALIASES
  $ oorja tty

EXAMPLES
  $ teletype
  Will prompt to choose streaming destination - either enter a stream key for an existing space or create a new space.

  $ teletype 'sk-xxxx:space-id#encryption-secret'
  Will stream to the space using the secret stream-key. NOTE: stream-keys are personal (generated for you in the teletype app at supakit.app), do not accept them from other people, nor should
  you share your stream-keys with others.

  $ teletype -m
  Will also allow participants to write to your terminal! Collaboration mode must be explicitly enabled.

  $ teletype --ci-debug
  Creates a new anonymous stream without prompting for sign-in. Useful for CI debug sessions you want to control from the link.
```

## `oorja signout`

Sign out of SupaKit. Clears saved auth-token

```
USAGE
  $ oorja signout

DESCRIPTION
  Sign out of SupaKit. Clears saved auth-token
```


## `oorja help [COMMAND]`

Display help for oorja.

```
USAGE
  $ oorja help [COMMAND...] [-n]

ARGUMENTS
  [COMMAND...]  Command to show help for.

FLAGS
  -n, --nested-commands  Include all nested commands in the output.

DESCRIPTION
  Display help for oorja.
```

<!-- commandsstop -->

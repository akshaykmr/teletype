import {randomBytes} from 'crypto'
import {mkdtempSync, rmSync, writeFileSync} from 'fs'
import {tmpdir} from 'os'
import {basename, join} from 'path'
import {spawn, IPty, IPtyForkOptions, IWindowsPtyForkOptions} from 'node-pty'

type PtyOptions = (IPtyForkOptions | IWindowsPtyForkOptions) & {env: NodeJS.ProcessEnv}
type ShellLaunch = {
  args: string[]
  env: NodeJS.ProcessEnv
  cleanup?: () => void
}

/**
 * Prepends TeleType to the shell prompt so people know their shell is being
 * streamed and do not forget.
 */
export const spawnStreamingShell = (
  shell: string,
  options: PtyOptions,
  streamingIndicator: boolean = true,
  platform: NodeJS.Platform = process.platform,
): IPty => {
  const launch = streamingIndicator ? prepareShell(shell, options.env, platform) : {args: [], env: options.env}
  try {
    const term = spawn(shell, launch.args, {...options, env: launch.env})
    if (launch.cleanup) {
      const subscription = term.onExit(() => {
        launch.cleanup!()
        subscription.dispose()
      })
    }
    return term
  } catch (error) {
    launch.cleanup?.()
    throw error
  }
}

const prepareShell = (shell: string, environment: NodeJS.ProcessEnv, platform: NodeJS.Platform): ShellLaunch => {
  if (platform === 'win32') {
    return {args: [], env: environment}
  }

  const id = randomBytes(6).toString('hex')
  switch (basename(shell).toLowerCase()) {
    case 'bash':
      return prepareBash(environment, id)
    case 'zsh':
      return prepareZsh(environment, id)
    case 'fish':
      return prepareFish(environment, id)
    case 'ash':
    case 'dash':
    case 'ksh':
    case 'mksh':
    case 'sh':
      return preparePosix(environment)
    default:
      return {args: [], env: environment}
  }
}

const prepareBash = (environment: NodeJS.ProcessEnv, id: string): ShellLaunch =>
  withTemporaryDirectory((directory) => {
    const rcfile = join(directory, 'bashrc')
    writeFileSync(rcfile, `[[ ! -r "$HOME/.bashrc" ]] || source "$HOME/.bashrc"\n` + `${makeBashSetup(id)}\n`, {
      mode: 0o600,
    })
    return {args: ['--rcfile', rcfile], env: environment}
  })

const prepareZsh = (environment: NodeJS.ProcessEnv, id: string): ShellLaunch =>
  withTemporaryDirectory((directory) => {
    const originalZdotdir = environment.ZDOTDIR ?? environment.HOME ?? ''
    const userZdotdir = `__teletype_user_zdotdir_${id}`
    const userZdotdirWasSet = `__teletype_user_zdotdir_was_set_${id}`
    const temporaryZdotdir = `__teletype_temporary_zdotdir_${id}`

    writeFileSync(
      join(directory, '.zshenv'),
      `typeset -g ${userZdotdir}=${quote(originalZdotdir)}\n` +
        `typeset -gi ${userZdotdirWasSet}=${environment.ZDOTDIR === undefined ? 0 : 1}\n` +
        `if (( ${userZdotdirWasSet} )); then ZDOTDIR=$${userZdotdir}; else unset ZDOTDIR; fi\n` +
        `[[ ! -r "$${userZdotdir}/.zshenv" && ! -r "$${userZdotdir}/.zshenv.zwc" ]] || source "$${userZdotdir}/.zshenv"\n` +
        `if (( \${+ZDOTDIR} )); then ${userZdotdir}=$ZDOTDIR; ${userZdotdirWasSet}=1; else ${userZdotdir}=$HOME; ${userZdotdirWasSet}=0; fi\n` +
        `if [[ -o rcs ]]; then ZDOTDIR=${quote(directory)}; else unset ${userZdotdir} ${userZdotdirWasSet}; fi\n`,
      {mode: 0o600},
    )
    writeFileSync(
      join(directory, '.zshrc'),
      `typeset -g ${temporaryZdotdir}=$ZDOTDIR\n` +
        `if (( ${userZdotdirWasSet} )); then ZDOTDIR=$${userZdotdir}; else unset ZDOTDIR; fi\n` +
        `unset ${userZdotdirWasSet}\n` +
        `[[ ! -r "$${userZdotdir}/.zshrc" && ! -r "$${userZdotdir}/.zshrc.zwc" ]] || source "$${userZdotdir}/.zshrc"\n` +
        `unset ${userZdotdir}\n` +
        `[[ $HISTFILE != $${temporaryZdotdir}/* ]] || HISTFILE=\${ZDOTDIR:-$HOME}/\${HISTFILE#$${temporaryZdotdir}/}\n` +
        `unset ${temporaryZdotdir}\n` +
        `${makeZshSetup(id)}\n`,
      {mode: 0o600},
    )

    return {args: [], env: {...environment, ZDOTDIR: directory}}
  })

const prepareFish = (environment: NodeJS.ProcessEnv, id: string): ShellLaunch => ({
  args: ['-C', makeFishSetup(id)],
  env: environment,
})

const preparePosix = (environment: NodeJS.ProcessEnv): ShellLaunch =>
  withTemporaryDirectory((directory) => {
    const rcfile = join(directory, 'env')
    const originalEnv = environment.ENV
    writeFileSync(
      rcfile,
      (originalEnv ? `ENV=${quote(originalEnv)}\n. "$ENV"\n` : 'unset ENV\n') +
        String.raw`PS1="$(printf '\342\227\217 TeleType  ')$PS1"` +
        '\n',
      {mode: 0o600},
    )
    return {args: [], env: {...environment, ENV: rcfile}}
  })

const BULLET_BYTES = String.raw`\342\227\217` // UTF-8 octal for "●"; escaped to keep startup files ASCII-safe.

const makeBashSetup = (id: string): string => {
  const hook = `__teletype_prompt_${id}`
  return String.raw`function ${hook} { local m='\[\e[93m\]'$'${BULLET_BYTES}''\[\e[0m\] TeleType  '; [[ $PS1 == "$m"* ]] || PS1="$m$PS1"; }
{
case "$(declare -p PROMPT_COMMAND 2>/dev/null)" in
  "declare -a"*) PROMPT_COMMAND+=(${hook}) ;;
  *) if [[ -n $PROMPT_COMMAND ]]; then PROMPT_COMMAND="$PROMPT_COMMAND;${hook}"; else PROMPT_COMMAND=${hook}; fi ;;
esac
} 2>/dev/null`
}

const makeZshSetup = (id: string): string => {
  const hook = `__teletype_prompt_${id}`
  return String.raw`function ${hook} { local m=$'%F{yellow}${BULLET_BYTES}%f TeleType  '; [[ $PROMPT == $m* ]] || { PROMPT=$m$PROMPT; } 2>/dev/null; add-zsh-hook -d precmd ${hook}; add-zsh-hook precmd ${hook} }
autoload -Uz add-zsh-hook
add-zsh-hook precmd ${hook}`
}

const makeFishSetup = (id: string): string => {
  const original = `__teletype_mode_prompt_${id}`
  return String.raw`begin; functions -q fish_mode_prompt; and functions -c fish_mode_prompt ${original}; function fish_mode_prompt; printf '\033[93m${BULLET_BYTES}\033[0m TeleType  '; functions -q ${original}; and ${original}; end; end 2>/dev/null`
}

const withTemporaryDirectory = (prepare: (directory: string) => Omit<ShellLaunch, 'cleanup'>): ShellLaunch => {
  const directory = mkdtempSync(join(tmpdir(), 'teletype-prompt-'))
  const cleanup = () => rmSync(directory, {force: true, recursive: true})
  try {
    return {...prepare(directory), cleanup}
  } catch (error) {
    cleanup()
    throw error
  }
}

const quote = (value: string): string => `'${value.replaceAll("'", String.raw`'\''`)}'`

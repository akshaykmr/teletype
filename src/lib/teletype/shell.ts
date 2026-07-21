type DefaultShellOptions = {
  ciDebug: boolean
  platform?: NodeJS.Platform
  environment?: NodeJS.ProcessEnv
}

export const getDefaultShell = ({
  ciDebug,
  platform = process.platform,
  environment = process.env,
}: DefaultShellOptions): string => {
  if (ciDebug && platform !== 'win32') return 'bash'
  if (platform === 'win32') return 'powershell.exe'
  return environment.SHELL || 'bash'
}

export function platformDefaultEirHome(
  home: string,
  env?: NodeJS.ProcessEnv,
  platform?: NodeJS.Platform,
): string

export function resolveDesktopUserData(defaultPath: string, env?: NodeJS.ProcessEnv): string

export interface EirHomeOptions {
  home: string
  env?: NodeJS.ProcessEnv
  platform?: NodeJS.Platform
  directoryExists?: (directory: string) => boolean
  readWindowsHome?: () => string | null
}

export function resolveDesktopEirHome(options: EirHomeOptions): string

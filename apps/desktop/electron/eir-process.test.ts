import { describe, expect, it } from 'vitest'

import { commandLineIsEirRuntime } from './eir-process'

// HX003: process identity comes from a whole argv TOKEN, never an argv substring.
describe('commandLineIsEirRuntime (HX003 token matching)', () => {
  it('matches a real Eir gateway command line', () => {
    expect(commandLineIsEirRuntime('eir\0gateway\0run')).toBe(true)
    expect(commandLineIsEirRuntime('eir gateway run')).toBe(true)
    expect(commandLineIsEirRuntime('eir --profile work gateway run')).toBe(true)
  })

  it('matches a Eir launched by an interpreter (basename of a path token)', () => {
    expect(commandLineIsEirRuntime('/venv/bin/python\0/venv/bin/eir\0gateway\0run')).toBe(true)
    expect(commandLineIsEirRuntime('C:\\Eir\\eir.exe gateway run')).toBe(true)
  })

  // The bug this replaces: a bare `.includes('eir')` matched any of these.
  it('does NOT match an unrelated process whose path merely contains "eir"', () => {
    expect(commandLineIsEirRuntime('vim /home/user/eir-notes.txt')).toBe(false)
    expect(commandLineIsEirRuntime('/opt/eirbrew/bin/tool --run')).toBe(false)
    expect(commandLineIsEirRuntime('node /srv/eir-dashboard/server.js')).toBe(false)
    expect(commandLineIsEirRuntime('cat ~/.eir/config.yaml')).toBe(false)
  })

  // G2 (#150283): the real unmanaged-gateway launch is `python -m eir_cli.main … gateway
  // run`, which the executable-basename-only matcher REJECTED — so findRunningGatewayProfiles
  // missed a live gateway at first launch / profile repair. Mirror the canonical Python matcher
  // (gateway.status.looks_like_gateway_command_line): recognize the module entry point, by argv
  // TOKENS not a substring, carrying the gateway subcommand.
  it('matches a module-launched gateway (python -m eir_cli.main … gateway run)', () => {
    expect(commandLineIsEirRuntime('python\0-m\0eir_cli.main\0-p\0x\0gateway\0run')).toBe(true)
    expect(commandLineIsEirRuntime('python -m eir_cli.main -p x gateway run')).toBe(true)
    expect(commandLineIsEirRuntime('/venv/bin/python /venv/lib/eir_cli/main.py gateway run')).toBe(true)
    expect(commandLineIsEirRuntime('python -m eir_cli.main --profile work gateway run')).toBe(true)
  })

  it('does NOT match a module entry without the gateway subcommand, nor an unrelated eir-tool path', () => {
    // A eir_cli.main invocation that is not a gateway (e.g. `chat`) is not a running gateway.
    expect(commandLineIsEirRuntime('python -m eir_cli.main chat')).toBe(false)
    // HX003: no substring; an unrelated tool whose path contains "eir" is never a runtime.
    expect(commandLineIsEirRuntime('/opt/eir-tool/foo gateway run')).toBe(false)
    // `-p gateway` is a profile value, not a subcommand.
    expect(commandLineIsEirRuntime('python -m eir_cli.main -p gateway chat')).toBe(false)
  })
})

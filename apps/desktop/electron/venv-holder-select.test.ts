import assert from 'node:assert/strict'

import { test } from 'vitest'

import { hasWindowsPathPrefix, isExternalVenvHolder, isEirOwnedVenvDaemon } from './venv-holder-select'

const SCRIPTS = 'C:\\Eir\\venv\\Scripts'

test('matches the hindsight daemon shim (exe under venv Scripts + hindsight cmdline)', () => {
  assert.equal(
    isEirOwnedVenvDaemon(
      'C:\\Eir\\venv\\Scripts\\pythonw.exe',
      'C:\\Eir\\venv\\Scripts\\pythonw.exe -m hindsight_api.main --daemon --idle-timeout 300 --port 9177',
      SCRIPTS
    ),
    true
  )
})

test('Windows path prefix match is ordinal case-insensitive', () => {
  assert.equal(
    isEirOwnedVenvDaemon(
      'c:\\eir\\venv\\scripts\\python.exe',
      'python.exe -m hindsight_api.main --daemon',
      'C:\\Eir\\venv\\Scripts'
    ),
    true
  )
})

test('excludes external venv holders that are not the hindsight daemon', () => {
  // a user terminal running the eir CLI from the venv — must NOT be killed
  assert.equal(isEirOwnedVenvDaemon('C:\\Eir\\venv\\Scripts\\eir.exe', 'eir chat -q "hi"', SCRIPTS), false)
  // an unrelated python script using the venv interpreter
  assert.equal(
    isEirOwnedVenvDaemon('C:\\Eir\\venv\\Scripts\\python.exe', 'python C:\\tools\\import.py', SCRIPTS),
    false
  )
})

test('excludes exes outside the venv even when the cmdline mentions hindsight', () => {
  assert.equal(
    isEirOwnedVenvDaemon('C:\\Other\\pythonw.exe', 'pythonw -m hindsight_api.main --daemon', SCRIPTS),
    false
  )
})

test('prefix boundary: sibling dirs (ScriptsX) do not match', () => {
  assert.equal(hasWindowsPathPrefix('C:\\Eir\\venv\\ScriptsX\\python.exe', SCRIPTS), false)
  assert.equal(hasWindowsPathPrefix('C:\\Eir\\venv\\Scripts\\python.exe', SCRIPTS), true)
})

test('null/undefined fields never match', () => {
  assert.equal(isEirOwnedVenvDaemon(null, 'x', SCRIPTS), false)
  assert.equal(isEirOwnedVenvDaemon('C:\\Eir\\venv\\Scripts\\pythonw.exe', null, SCRIPTS), false)
  assert.equal(isEirOwnedVenvDaemon(undefined, undefined, SCRIPTS), false)
})

// --- isExternalVenvHolder (#62311) ------------------------------------------

test('matches the autostart gateway shim (eir.exe under venv Scripts)', () => {
  assert.equal(
    isExternalVenvHolder(
      'C:\\Eir\\venv\\Scripts\\eir.exe',
      '"C:\\Eir\\venv\\Scripts\\eir.exe" gateway run --external-supervisor',
      SCRIPTS
    ),
    true
  )
})

test('matches the dashboard scheduled task (python -m eir_cli / -m eir)', () => {
  assert.equal(
    isExternalVenvHolder(
      'C:\\Eir\\venv\\Scripts\\python.exe',
      '"C:\\Eir\\venv\\Scripts\\python.exe" -m eir_cli.main dashboard',
      SCRIPTS
    ),
    true
  )
  assert.equal(
    isExternalVenvHolder('C:\\Eir\\venv\\Scripts\\pythonw.exe', 'pythonw.exe -m eir serve', SCRIPTS),
    true
  )
})

test('never matches an unrelated process that merely borrows the venv interpreter', () => {
  // a user's own script running on the venv python — NOT Eir, must NOT be killed
  assert.equal(
    isExternalVenvHolder('C:\\Eir\\venv\\Scripts\\python.exe', 'python C:\\tools\\import.py', SCRIPTS),
    false
  )
  // hindsight daemon is selected by isEirOwnedVenvDaemon, not here
  assert.equal(
    isExternalVenvHolder('C:\\Eir\\venv\\Scripts\\pythonw.exe', 'pythonw -m hindsight_api.main --daemon', SCRIPTS),
    false
  )
})

test('never matches a process outside the venv, even with eir in the cmdline', () => {
  // an editor / shell whose command line mentions the install root (#62445 regression guard)
  assert.equal(
    isExternalVenvHolder('C:\\Windows\\System32\\cmd.exe', 'cmd /c cd C:\\Eir\\venv\\Scripts && dir', SCRIPTS),
    false
  )
  assert.equal(isExternalVenvHolder('C:\\Other\\eir.exe', 'eir gateway run', SCRIPTS), false)
})

test('sibling-dir and boundary safety for the external selector', () => {
  assert.equal(isExternalVenvHolder('C:\\Eir\\venv\\ScriptsX\\eir.exe', 'eir gateway run', SCRIPTS), false)
  assert.equal(isExternalVenvHolder(null, 'eir gateway run', SCRIPTS), false)
  assert.equal(isExternalVenvHolder('C:\\Eir\\venv\\Scripts\\eir.exe', null, SCRIPTS), false)
})

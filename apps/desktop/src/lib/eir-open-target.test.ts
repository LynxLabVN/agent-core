import { describe, expect, it } from 'vitest'

import {
  normalizeEirOpenString,
  pathFromEirDeepLink,
  pathFromOpenDeepLink,
  resolveEirOpenPath
} from './eir-open-target'

describe('normalizeEirOpenString', () => {
  it('accepts hash-router paths and strips a leading hash', () => {
    expect(normalizeEirOpenString('/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeEirOpenString('#/index-network/intent/1')).toBe('/index-network/intent/1')
  })

  it('maps plugin-scoped eir:// deep links to the same path', () => {
    expect(normalizeEirOpenString('eir://index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeEirOpenString('eir://index-network/intent/1?focus=true')).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('maps eir://open/… deep links by stripping the open host', () => {
    expect(normalizeEirOpenString('eir://open/index-network/intent/1')).toBe('/index-network/intent/1')
    expect(normalizeEirOpenString('eir://open/settings/plugins')).toBe('/settings/plugins')
  })

  it('rejects reserved eir kinds and unsafe paths', () => {
    expect(normalizeEirOpenString('eir://blueprint/morning-brief')).toBeNull()
    expect(normalizeEirOpenString('eir://plugin/install')).toBeNull()
    expect(normalizeEirOpenString('https://example.com/x')).toBeNull()
    expect(normalizeEirOpenString('/../etc/passwd')).toBeNull()
    expect(normalizeEirOpenString('index-network')).toBeNull()
  })
})

describe('resolveEirOpenPath', () => {
  it('merges structured path + params', () => {
    expect(resolveEirOpenPath({ path: '/index-network/intent/1', params: { focus: 'true' } })).toBe(
      '/index-network/intent/1?focus=true'
    )
  })

  it('resolves href the same as a bare string', () => {
    expect(resolveEirOpenPath({ href: 'eir://index-network/intent/1' })).toBe('/index-network/intent/1')
  })
})

describe('pathFromEirDeepLink', () => {
  it('builds the navigate path from a plugin-scoped deep-link payload', () => {
    expect(pathFromEirDeepLink('index-network', 'intent/1')).toBe('/index-network/intent/1')
  })

  it('builds the navigate path from eir://open/… payloads', () => {
    expect(pathFromOpenDeepLink('index-network/intent/1')).toBe('/index-network/intent/1')
    expect(pathFromEirDeepLink('open', 'agent/42')).toBe('/agent/42')
  })

  it('ignores reserved kinds', () => {
    expect(pathFromEirDeepLink('blueprint', 'morning-brief')).toBeNull()
    expect(pathFromEirDeepLink('plugin', 'install')).toBeNull()
  })
})

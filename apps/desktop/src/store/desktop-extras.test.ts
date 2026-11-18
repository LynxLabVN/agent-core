import { describe, expect, it } from 'vitest'

import { $desktopExtras, publishDesktopExtras } from './desktop-extras'

// `desktop.extras` is backend-owned (a config.yaml key); the renderer store is
// only a mirror. The contract: true opts the profile's whimsy back in, and any
// other shape the backend could hand back — missing section, older backend,
// explicit false — stays on the quiet default.
describe('desktop extras mirror', () => {
  it('turns the gate on only for an explicit true', () => {
    publishDesktopExtras({ desktop: { extras: true } })
    expect($desktopExtras.get()).toBe(true)
  })

  it.each([
    ['missing section', {}],
    ['missing key', { desktop: {} }],
    ['older backend, no key yet', { desktop: { repo_scan_enabled: true } }],
    ['explicit false', { desktop: { extras: false } }],
    ['junk value', { desktop: { extras: 'yes' } }]
  ])('stays off for %s', (_label, config) => {
    publishDesktopExtras(config as Parameters<typeof publishDesktopExtras>[0])
    expect($desktopExtras.get()).toBe(false)
  })
})

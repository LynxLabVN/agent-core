import { beforeEach, describe, expect, it, vi } from 'vitest'

const LEGACY_VISIBLE_KEY = 'eir.desktop.statusbarVisible'

const loadStore = () => import('./statusbar-prefs')

describe('statusbar whole-bar visibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('rests hidden on a fresh install (Simple) and shows in Advanced, honouring a legacy v1 hide', async () => {
    const { $interfaceMode } = await import('./interface-mode')

    // Chat-first default: a fresh install never shows the bar.
    expect((await loadStore()).$statusbarVisible.get()).toBe(false)
    expect($interfaceMode.get()).toBe('simple')

    // The user's own answer exists only in Advanced — including an install
    // that hid the bar under the v1 key before the migration.
    window.localStorage.setItem(LEGACY_VISIBLE_KEY, 'false')
    $interfaceMode.set('advanced')

    expect((await loadStore()).$statusbarVisible.get()).toBe(true)
  })

  it('still honours a hide made after the update', async () => {
    const first = await loadStore()
    const { $interfaceMode } = await import('./interface-mode')
    $interfaceMode.set('advanced')

    first.toggleStatusbarVisible()
    expect(first.$statusbarVisible.get()).toBe(false)

    vi.resetModules()
    const reloaded = await loadStore()

    expect(reloaded.$statusbarVisible.get()).toBe(false)
  })
})

describe('statusbar hidden items', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.resetModules()
  })

  it('surfaces the approval pill for installs that hid it under the v1 defaults, keeping their other choices', async () => {
    window.localStorage.setItem(
      'eir.desktop.statusbarHidden',
      JSON.stringify(['approval-mode', 'cron', 'gateway-health'])
    )

    const { $statusbarHiddenIds } = await loadStore()

    expect($statusbarHiddenIds.get()).toEqual(['cron', 'gateway-health'])
  })

  it('still honours hiding the approval pill after the update', async () => {
    const first = await loadStore()

    first.setStatusbarItemVisible('approval-mode', false)

    vi.resetModules()
    const reloaded = await loadStore()

    expect(reloaded.$statusbarHiddenIds.get()).toContain('approval-mode')
  })
})

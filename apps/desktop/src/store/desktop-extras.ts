import { atom } from 'nanostores'

import type { EirConfig } from '@/types/eir'

/**
 * `desktop.extras` — the whimsy gate.
 *
 * The chat-first shell rests the petdex mascot and the starmap out of the
 * default surface; `desktop.extras: true` in config.yaml brings them back.
 * The backend owns the value (a config.yaml key like every other desktop
 * preference), so this store is only a mirror: it starts false — the quiet
 * default — and the config funnel (useEirConfig's refresh, which already runs
 * on connect, on gateway-scope switch and on `config.changed`) publishes what
 * the active profile's config says. No writer here: the setting's home is the
 * YAML, not a renderer toggle, so nothing to mirror back.
 */
export const $desktopExtras = atom(false)

/** Publish `desktop.extras` from a fetched config. Missing key / older backend = off. */
export function publishDesktopExtras(config: Pick<EirConfig, 'desktop'>): void {
  $desktopExtras.set(config.desktop?.extras === true)
}

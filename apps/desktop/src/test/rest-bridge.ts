import { vi } from 'vitest'

import type { EirApiRequest } from '@/global'

/** Install a fake `window.eirDesktop.api`, the preload bridge every REST helper sends through. */
export function installRestBridge(answer: (request: EirApiRequest) => object) {
  const api = vi.fn(async (request: EirApiRequest) => answer(request))

  Object.defineProperty(window, 'eirDesktop', { configurable: true, value: { api } })

  return api
}

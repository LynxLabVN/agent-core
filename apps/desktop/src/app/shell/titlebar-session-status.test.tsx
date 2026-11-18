import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { $activeSessionId, $busy, $currentUsage, $gatewayState } from '@/store/session'
import type { ContextBreakdown, UsageStats } from '@/types/eir'

import { TitlebarSessionStatus } from './titlebar-session-status'

// The chat-first shell's standing readouts live here once the statusbar
// unmounts (Simple mode). The contract: the dot tracks the socket state and
// opens the Command Center's system section; the meter shows the focused
// session's context occupancy — the live estimate, upgraded to the measured
// breakdown exactly like the statusbar gauge — and its popover reuses the
// statusbar's panel verbatim.

const usage: UsageStats = {
  calls: 1,
  context_estimated: true,
  context_max: 272_000,
  context_percent: 47,
  context_used: 128_200,
  input: 0,
  output: 0,
  total: 0
}

const breakdown: ContextBreakdown = {
  categories: [{ color: 'teal', id: 'conversation', label: 'Conversation', tokens: 241_400 }],
  context_max: 272_000,
  context_percent: 89,
  context_used: 241_400,
  estimated_total: 286_600,
  model: 'test-model'
}

afterEach(() => {
  cleanup()
  act(() => {
    $currentUsage.set({ calls: 0, input: 0, output: 0, total: 0 })
    $gatewayState.set('idle')
    $activeSessionId.set(null)
    $busy.set(false)
  })
  vi.restoreAllMocks()
})

function mount(onOpenSystem = vi.fn(), requestGateway = vi.fn()) {
  return render(
    <MemoryRouter>
      <TitlebarSessionStatus onOpenSystem={onOpenSystem} requestGateway={requestGateway} />
    </MemoryRouter>
  )
}

describe('TitlebarSessionStatus', () => {
  it('shows the streamed estimate with the tilde, and hides the meter with no reading', () => {
    act(() => $currentUsage.set(usage))
    const { container } = mount()
    expect(screen.getByTestId('titlebar-context-meter').textContent).toBe('~47%')

    act(() => $currentUsage.set({ calls: 0, input: 0, output: 0, total: 0 }))
    expect(container.querySelector('[data-testid="titlebar-context-meter"]')).toBeNull()
  })

  it('upgrades to the measured breakdown and opens the shared panel', async () => {
    act(() => {
      $currentUsage.set(usage)
      $activeSessionId.set('runtime-1')
    })
    const requestGateway = vi.fn().mockResolvedValue(breakdown)
    mount(vi.fn(), requestGateway)

    await waitFor(() => expect(screen.getByTestId('titlebar-context-meter').textContent).toBe('89%'))
    expect(requestGateway).toHaveBeenCalledWith('session.context_breakdown', { session_id: 'runtime-1' })

    // Radix's dropdown trigger opens on pointerdown (a synthetic 'click'
    // fireEvent alone does not open it — see project-menu.test.tsx).
    fireEvent.pointerDown(screen.getByTestId('titlebar-context-meter'), { button: 0, pointerType: 'mouse' })
    fireEvent.pointerUp(screen.getByTestId('titlebar-context-meter'), { button: 0, pointerType: 'mouse' })
    fireEvent.click(screen.getByTestId('titlebar-context-meter'))
    expect(await screen.findByText('Context Usage')).toBeTruthy()
  })

  it('the dot opens the system section of the Command Center', () => {
    const onOpenSystem = vi.fn()
    mount(onOpenSystem)

    fireEvent.click(screen.getByRole('button', { name: 'Gateway' }))
    expect(onOpenSystem).toHaveBeenCalledTimes(1)
  })

  it('the dot tone tracks the socket state', () => {
    const { container } = mount()
    const dot = container.querySelector('span[data-slot="status-dot"], span[class*="rounded-full"]')
    expect(dot).toBeTruthy()

    act(() => $gatewayState.set('open'))
    expect(dot?.className).toContain('bg-primary')

    act(() => $gatewayState.set('connecting'))
    expect(dot?.className).toContain('bg-amber-500')

    act(() => $gatewayState.set('closed'))
    expect(dot?.className).toContain('bg-destructive')
  })
})

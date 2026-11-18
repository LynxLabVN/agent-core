import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { setTerminalTakeover } from '@/app/right-sidebar/store'
import { registerPaneCloser } from '@/components/pane-shell/tree/store'

import { setInterfaceMode } from './interface-mode'
import { setFileBrowserOpen } from './layout'
import { revealDesktopPane } from './pane-focus'

// D2 spotlight: an agent-driven reveal (the active session's `pane.reveal`)
// steps aside the right-hand pane the agent revealed last, so only one
// agent-driven pane is open at a time. Simple-only, and a reveal without the
// spotlight flag (the tour, a layout pick) never closes anything.

const closeFiles = vi.fn()

beforeEach(() => {
  setInterfaceMode('simple')
  closeFiles.mockReset()
  registerPaneCloser('files', closeFiles)
  setFileBrowserOpen(false)
  setTerminalTakeover(false)
})

afterEach(() => {
  registerPaneCloser('files')
  setFileBrowserOpen(false)
  setTerminalTakeover(false)
  setInterfaceMode('simple')
})

describe('agent spotlight auto-close', () => {
  it('leaves panes alone in Advanced and for non-agent reveals', () => {
    setInterfaceMode('advanced')
    revealDesktopPane('files', { spotlight: true })
    revealDesktopPane('terminal', { spotlight: true })
    expect(closeFiles).not.toHaveBeenCalled()

    // A reveal without the spotlight flag is the tour/layout-pick path.
    setInterfaceMode('simple')
    revealDesktopPane('files')
    revealDesktopPane('terminal', { spotlight: true })
    expect(closeFiles).not.toHaveBeenCalled()
  })

  it('closes the previously agent-revealed pane when the spotlight moves', () => {
    expect(revealDesktopPane('files', { spotlight: true })).toBe(true)
    expect(closeFiles).not.toHaveBeenCalled()

    expect(revealDesktopPane('terminal', { spotlight: true })).toBe(true)
    expect(closeFiles).toHaveBeenCalledTimes(1)

    // Re-revealing the pane the spotlight already sits on never closes it.
    revealDesktopPane('terminal', { spotlight: true })
    expect(closeFiles).toHaveBeenCalledTimes(1)
  })

  it('ignores unknown panes without touching the spotlight', () => {
    revealDesktopPane('files', { spotlight: true })
    expect(revealDesktopPane('no-such-pane', { spotlight: true })).toBe(false)

    revealDesktopPane('terminal', { spotlight: true })
    expect(closeFiles).toHaveBeenCalledTimes(1)
  })
})

import { setTerminalTakeover } from '@/app/right-sidebar/store'
import { isLayoutNode, type LayoutNode } from '@/components/pane-shell/tree/model'
import { applyLayoutPreset, LAYOUTS_AREA } from '@/components/pane-shell/tree/presets'
import { closeTreePane, revealTreePane } from '@/components/pane-shell/tree/store'
import { registry } from '@/contrib/registry'

import { $interfaceMode } from './interface-mode'
import { setFileBrowserOpen, setSidebarOpen } from './layout'
import { openReview } from './review'

// Explicit-request pane reveals, keyed to the backend `focus_pane` tool. Each
// entry drives the pane's own reveal path (some are toggle-bound) so a revealed
// pane matches a user-driven open. files/review are workspace-gated — a no-op
// without a project cwd, which is the honest behavior.
const PANE_REVEALERS: Record<string, () => void> = {
  chat: () => revealTreePane('workspace'),
  files: () => setFileBrowserOpen(true),
  review: () => openReview(),
  sessions: () => setSidebarOpen(true),
  terminal: () => setTerminalTakeover(true)
}

// The store setters above are same-value no-ops: `$open` already reads true
// while the pane sits in a zone the user minimized from its chevron, so the
// listener never fires and the tool reported success over an invisible pane
// (#106009). An explicit reveal also un-minimizes and fronts the tree pane.
const TREE_PANE_OF: Record<string, string> = {
  files: 'files',
  review: 'review',
  sessions: 'sessions',
  terminal: 'terminal'
}

// D2 spotlight: the agent's attention moves across the right-hand panes, and
// the pane it revealed last steps aside when it reveals another — so at most
// one agent-driven pane is ever open. Simple-only (in Advanced these are the
// user's chrome), and only explicit agent reveals count (`spotlight: true`
// from the active session's `pane.reveal`): a tour or layout pick, or a pane
// the user opened, is never auto-closed.
const SPOTLIGHT_PANES = new Set(['files', 'review', 'terminal'])
let agentSpotlight: string | null = null

/** Reveal a desktop pane by name. Returns false for an unknown pane.
 *  `spotlight` marks an agent-driven reveal (see above). */
export function revealDesktopPane(pane: string, options?: { spotlight?: boolean }): boolean {
  const reveal = PANE_REVEALERS[pane]

  if (!reveal) {
    return false
  }

  const spotlight = options?.spotlight === true && SPOTLIGHT_PANES.has(pane) && $interfaceMode.get() === 'simple'

  if (spotlight && agentSpotlight && agentSpotlight !== pane) {
    closeTreePane(agentSpotlight)
  }

  reveal()

  const treePane = TREE_PANE_OF[pane]

  if (treePane) {
    revealTreePane(treePane)
  }

  if (spotlight) {
    agentSpotlight = pane
  }

  return true
}

// Elite is the terminal deck with the tools its card names open. The preset itself rests them, so the
// same deck picked in Settings stays quiet; a pick from the layout card or set_theme shows the difference.
const PICK_OPENS = new Map<string, readonly string[]>([['terminal-deck', ['terminal', 'files']]])

/** The panes a layout pick opens beyond its preset's resting set. */
export const layoutPickOpens = (preset: string): readonly string[] => PICK_OPENS.get(preset) ?? []

/** Open the panes `layoutPickOpens` names for `preset`. */
export function openLayoutPickPanes(preset: string): void {
  for (const pane of layoutPickOpens(preset)) {
    revealDesktopPane(pane)
  }
}

/** Apply a layout preset by id, resolved against the layouts contribution
 *  registry — the SAME list the layout picker renders, so core presets
 *  (default/focus/terminal-deck/quad), plugin presets, and user-saved presets
 *  are all addressable by the backend `set_theme` tool. Returns false for
 *  an unknown id. */
export function applyDesktopLayoutPreset(preset: string): boolean {
  if (!preset) {
    return false
  }

  const entry = registry
    .getArea(LAYOUTS_AREA)
    .find(candidate => candidate.id === preset && isLayoutNode(candidate.data))

  if (!entry) {
    return false
  }

  applyLayoutPreset(entry.id, entry.data as LayoutNode)

  return true
}

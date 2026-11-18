import { useStore } from '@nanostores/react'
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router'

import { appViewForPath, isOverlayView } from '@/app/routes'
import { ContextUsagePanel } from '@/app/shell/context-usage-panel'
import { useCompactConversation } from '@/app/shell/hooks/use-compact-conversation'
import { useContextBreakdown } from '@/app/shell/hooks/use-context-breakdown'
import { StatusDot, type StatusTone } from '@/components/status-dot'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tip } from '@/components/ui/tooltip'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'
import { $activeSessionId, $busy, $currentUsage, $gatewayState } from '@/store/session'

import { StatusbarMenuCloseContext } from './statusbar-controls'

/**
 * The chat-first shell's two standing readouts, carried by the titlebar
 * because the statusbar that used to own them unmounts in Simple mode.
 * Backend dot (socket truth — the nuanced inference/messaging health stays
 * one click away in the Command Center) and the primary chat's context
 * meter, whose popover reuses the statusbar's panel verbatim.
 *
 * Positioned left of the whole right tool band via the wiring's own CSS
 * vars, so it needs no width accounting of its own.
 */

type GatewayRequester = <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>

const DOT_TONE: Record<string, StatusTone> = {
  connecting: 'warn',
  error: 'bad',
  idle: 'bad',
  open: 'good'
}

export function TitlebarSessionStatus({
  onOpenSystem,
  requestGateway
}: {
  onOpenSystem: () => void
  requestGateway: GatewayRequester
}) {
  const { t } = useI18n()
  const location = useLocation()
  const busy = useStore($busy)
  const gatewayState = useStore($gatewayState)
  const currentUsage = useStore($currentUsage)
  const sessionId = useStore($activeSessionId)

  const [menuOpen, setMenuOpen] = useState(false)

  // Same pipeline the statusbar gauge runs, so both meters read identically
  // when both are visible: the estimate from the live usage payload, upgraded
  // to the measured breakdown once the backend has one.
  const { breakdown, loading } = useContextBreakdown({ busy, enabled: true, requestGateway, sessionId })
  const compactConversation = useCompactConversation({ busy, sessionId })

  const gaugeUsage = useMemo(() => {
    if (!breakdown) {
      return currentUsage
    }

    const reading = breakdown.context_max > 0 ? breakdown : currentUsage

    return {
      ...currentUsage,
      context_estimated: reading.context_estimated,
      context_source: reading.context_source,
      context_max: reading.context_max,
      context_percent: reading.context_percent,
      context_used: reading.context_used
    }
  }, [breakdown, currentUsage])

  const label = useMemo(() => {
    if (!gaugeUsage.context_max) {
      return ''
    }

    const pct = Math.max(0, Math.min(100, Math.round(gaugeUsage.context_percent ?? 0)))

    return `${gaugeUsage.context_estimated ? '~' : ''}${pct}%`
  }, [gaugeUsage])

  // Overlays own the window — same stand-down as the tool clusters.
  if (isOverlayView(appViewForPath(location.pathname))) {
    return null
  }

  return (
    <div
      className="fixed z-70 flex flex-row items-center pointer-events-auto select-none pr-1 top-(--titlebar-controls-top) [-webkit-app-region:no-drag] right-[calc(var(--titlebar-tools-right)+var(--titlebar-tools-width,0px)+6px)]"
      data-slot="titlebar-session-status"
      onPointerDown={event => event.stopPropagation()}
    >
      <Tip label={t.shell.statusbar.gatewayTitle} placement="toolbar">
        <button
          aria-label={t.shell.statusbar.gatewayTitle}
          className="flex size-(--titlebar-control-size) cursor-pointer items-center justify-center rounded-md hover:bg-(--chrome-action-hover)"
          onClick={onOpenSystem}
          type="button"
        >
          <StatusDot tone={DOT_TONE[gatewayState] ?? 'bad'} />
        </button>
      </Tip>

      {label && (
        <Tip label={t.shell.statusbar.toggleContextUsage} placement="toolbar">
          <DropdownMenu modal={false} onOpenChange={setMenuOpen} open={menuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={t.shell.statusbar.toggleContextUsage}
                className={cn(
                  'min-w-0 cursor-pointer rounded-md px-1.5 text-[0.6875rem] tabular-nums text-(--ui-text-tertiary)',
                  'hover:bg-(--chrome-action-hover) hover:text-foreground'
                )}
                data-testid="titlebar-context-meter"
                type="button"
              >
                {label}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-(--ui-stroke-secondary) p-0">
              <StatusbarMenuCloseContext.Provider value={() => setMenuOpen(false)}>
                <ContextUsagePanel
                  breakdown={breakdown}
                  compact={compactConversation}
                  loading={loading}
                  usage={gaugeUsage}
                />
              </StatusbarMenuCloseContext.Provider>
            </DropdownMenuContent>
          </DropdownMenu>
        </Tip>
      )}
    </div>
  )
}

import { useStore } from '@nanostores/react'

import { $statusbarVisible } from '@/store/statusbar-prefs'
import { isBrowserWindow, isHudWindow } from '@/store/windows'

import { TitlebarControls, type TitlebarTool } from '../shell/titlebar-controls'
import { TitlebarSessionStatus } from '../shell/titlebar-session-status'
import { WslgWindowControls } from '../shell/wslg-window-controls'

import type { AmbientGatewayRequest } from './session-rpc-dispatcher'

/**
 * The titlebar chrome band ContribWiring hangs on its shell: readout pill +
 * window controls behind the HUD/browser guard (their clusters are `fixed`,
 * so without it they'd float over the surface as orphaned buttons), plus the
 * WSLg min/max/close cluster behind its own guard.
 *
 * Extracted so the pill's statusbar-off conditional — and the guards it shares
 * with the controls — live outside ContribWiring's complexity budget.
 */
export function TitlebarToolsBand({
  customWindowControls,
  isFullscreen,
  isMaximized,
  leftTools,
  onOpenSettings,
  onOpenSystem,
  requestGateway,
  tools
}: {
  customWindowControls: boolean
  isFullscreen: boolean
  isMaximized: boolean
  leftTools: TitlebarTool[]
  onOpenSettings: () => void
  onOpenSystem: () => void
  requestGateway: AmbientGatewayRequest
  tools: TitlebarTool[]
}) {
  // The titlebar readouts pill owns the gateway dot + context meter exactly
  // while the statusbar that used to carry them is unmounted (Simple's
  // default), so the two never duplicate a readout.
  const statusbarVisible = useStore($statusbarVisible)

  return (
    <>
      {!isHudWindow() && !isBrowserWindow() && (
        <>
          {!statusbarVisible && (
            <TitlebarSessionStatus onOpenSystem={onOpenSystem} requestGateway={requestGateway} />
          )}
          <TitlebarControls leftTools={leftTools} onOpenSettings={onOpenSettings} tools={tools} />
        </>
      )}
      {!isHudWindow() && customWindowControls && (
        <WslgWindowControls isFullscreen={isFullscreen} isMaximized={isMaximized} />
      )}
    </>
  )
}

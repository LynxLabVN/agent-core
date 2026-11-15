import { contextBridge, ipcRenderer, webFrame, webUtils } from 'electron'

import type { DesktopProfileRoute } from './desktop-profile'
import type { HudModifierApi, HudModifierStatus } from './hud-modifier-types'
import { customWindowControlsEnabled } from './window-controls'

// Which translucency the OS can back. Asked synchronously because the renderer
// needs it before its first paint, and answered by main because deciding it
// needs `os.release()` — a sandboxed preload may only require electron, events,
// timers and url, so importing node:os here throws before contextBridge runs
// and takes the ENTIRE bridge down with it (window.eirDesktop undefined =>
// "Desktop IPC bridge is unavailable"). No reply means no glass, which degrades
// to an ordinary opaque window rather than a page thinned over nothing.
const translucencySupport = ipcRenderer.sendSync('eir:translucency:support')
const hudWindowing = ipcRenderer.sendSync('eir:hud:windowing')
const hudNativeDrag = hudWindowing?.nativeDrag === true

const launchFlags: { localModels?: boolean; assumeFreshInstall?: boolean } | undefined =
  ipcRenderer.sendSync('eir:feature-flags')

// Local, sanitized skin payload for the first renderer theme paint. This does
// not wait on `gateway.ready`, so an unreachable remote primary cannot force
// the built-in palette over the skin configured on this machine.
const localSkin = ipcRenderer.sendSync('eir:skin:local')

// This machine's UI preferences store (#145213), read before the first paint so
// a preference set in another window or in this machine's Webapp paints at once.
const uiPreferencesSnapshot = ipcRenderer.sendSync('eir:ui-preferences:snapshot')

import { unwrapExpectedNotFound } from './api-expected-404'

contextBridge.exposeInMainWorld('eirDesktop', {
  glassSupported: translucencySupport?.glass === true,
  translucencySupported: translucencySupport?.translucency === true,
  // Launch-flag fact: the app was started with --local, so the renderer may
  // show the local-models surfaces. Static for the window's lifetime.
  localModelsEnabled: launchFlags?.localModels === true,
  // Dev-only launch fact: an unpackaged app started with --fresh-install, so
  // onboarding treats this launch as a fresh install. Always false when packaged.
  assumeFreshInstall: launchFlags?.assumeFreshInstall === true,
  localSkin: localSkin && typeof localSkin === 'object' ? localSkin : null,
  uiPreferences: {
    snapshot: uiPreferencesSnapshot && typeof uiPreferencesSnapshot === 'object' ? uiPreferencesSnapshot : null,
    read: () => ipcRenderer.invoke('eir:ui-preferences:read'),
    write: payload => ipcRenderer.invoke('eir:ui-preferences:write', payload),
    onChanged: callback => {
      const listener = (_event, snapshot) => callback(snapshot)
      ipcRenderer.on('eir:ui-preferences:changed', listener)

      return () => ipcRenderer.removeListener('eir:ui-preferences:changed', listener)
    }
  },
  getConnection: (profile, opts) => ipcRenderer.invoke('eir:connection', profile, opts),
  // Loopback origin that hosts YouTube's player for the file:// renderer.
  getEmbedHostOrigin: () => ipcRenderer.invoke('eir:embed-host:origin'),
  // Registry-scoped backend resolution: { connectionId, profile } → descriptor.
  getConnectionFor: payload => ipcRenderer.invoke('eir:connection:for', payload),
  getProfileRoutes: profiles => ipcRenderer.invoke('eir:plugin-profile-routes', profiles),
  revalidateConnection: () => ipcRenderer.invoke('eir:connection:revalidate'),
  getGatewayWsUrl: profile => ipcRenderer.invoke('eir:gateway:ws-url', profile),
  // Registry-scoped fresh WS URL: { connectionId, profile } → result shape of
  // getGatewayWsUrl, minted against that connection's backend.
  getGatewayWsUrlFor: payload => ipcRenderer.invoke('eir:gateway:ws-url-for', payload),
  // { connectionId, profile, pluginId, path } → one-use local plugin socket URL, null, or { refused: 'permission' }.
  getPluginWsUrl: payload => ipcRenderer.invoke('eir:plugin:ws-url', payload),
  // Union agent roster across every registered connection.
  getAgentRoster: () => ipcRenderer.invoke('eir:agents:roster'),
  openSessionWindow: (sessionId, opts) => ipcRenderer.invoke('eir:window:openSession', sessionId, opts),
  openSessionInTerminal: (sessionId, opts) => ipcRenderer.invoke('eir:window:openInTerminal', sessionId, opts),
  openWindow: (options?: DesktopProfileRoute) => ipcRenderer.invoke('eir:window:openInstance', options),
  openBrowserWindow: tabId => ipcRenderer.invoke('eir:window:openBrowser', tabId),
  windowRelay: {
    send: payload => ipcRenderer.send('eir:window:relay', payload),
    onMessage: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:window:relay', listener)

      return () => ipcRenderer.removeListener('eir:window:relay', listener)
    }
  },
  onBrowserPopoutClosed: callback => {
    const listener = (_event, tabId) => callback(tabId)
    ipcRenderer.on('eir:browser-popout:closed', listener)

    return () => ipcRenderer.removeListener('eir:browser-popout:closed', listener)
  },
  claimAmbientCue: key => ipcRenderer.invoke('eir:ambient:claim', key),
  windowControls: {
    custom: customWindowControlsEnabled(),
    minimize: () => ipcRenderer.send('eir:window-control', 'minimize'),
    toggleMaximize: () => ipcRenderer.send('eir:window-control', 'toggle-maximize'),
    close: () => ipcRenderer.send('eir:window-control', 'close')
  },
  wakeIndicator: {
    getState: () => ipcRenderer.invoke('eir:wake-indicator:get'),
    setState: state => ipcRenderer.send('eir:wake-indicator:set', state),
    onState: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('eir:wake-indicator:state', listener)

      return () => ipcRenderer.removeListener('eir:wake-indicator:state', listener)
    }
  },
  chatOnboarding: {
    size: mode => ipcRenderer.send('eir:window:size', mode)
  },
  petOverlay: {
    // Main renderer → main process: window lifecycle + drag. `request` is
    // `{ bounds, screen }`; resolves with the screen bounds it actually used.
    open: request => ipcRenderer.invoke('eir:pet-overlay:open', request),
    close: () => ipcRenderer.invoke('eir:pet-overlay:close'),
    setBounds: bounds => ipcRenderer.send('eir:pet-overlay:set-bounds', bounds),
    setIgnoreMouse: ignore => ipcRenderer.send('eir:pet-overlay:ignore-mouse', ignore),
    // Flip the overlay focusable (and focus it) while the composer needs keys.
    setFocusable: focusable => ipcRenderer.send('eir:pet-overlay:set-focusable', focusable),
    // Main renderer → overlay (forwarded by main): push the latest pet state.
    pushState: payload => ipcRenderer.send('eir:pet-overlay:state', payload),
    // Overlay → main renderer (forwarded by main): pop back in / composer submit.
    control: payload => ipcRenderer.send('eir:pet-overlay:control', payload),
    // Overlay subscribes to state pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:pet-overlay:state', listener)

      return () => ipcRenderer.removeListener('eir:pet-overlay:state', listener)
    },
    // Main renderer subscribes to overlay control messages.
    onControl: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:pet-overlay:control', listener)

      return () => ipcRenderer.removeListener('eir:pet-overlay:control', listener)
    }
  },
  // HUD mode: the chrome-free floating chat. A full app renderer (own gateway)
  // sized as a floating bar, so it mounts the real composer. Main owns the
  // window; `onChanged` keeps every window's toggle truthful.
  hud: {
    nativeDrag: hudNativeDrag,
    windowing: {
      clientPlacement: hudWindowing?.clientPlacement !== false,
      controlDrag: hudWindowing?.controlDrag === true,
      nativeDrag: hudNativeDrag,
      solid: hudWindowing?.solid === true,
      workspaceTransfer: hudWindowing?.workspaceTransfer === true
    },
    open: request => ipcRenderer.invoke('eir:hud:open', request),
    close: () => ipcRenderer.invoke('eir:hud:close'),
    setIgnoreMouse: ignore => ipcRenderer.send('eir:hud:ignore-mouse', ignore),
    beginMove: () => ipcRenderer.send('eir:hud:begin-move'),
    endMove: () => ipcRenderer.send('eir:hud:end-move'),
    moveBy: delta => ipcRenderer.send('eir:hud:move-by', delta),
    setWorkspaceTransfer: transferring => ipcRenderer.send('eir:hud:workspace-transfer', transferring),
    setBounds: bounds => ipcRenderer.send('eir:hud:set-bounds', bounds),
    resetLayout: () => ipcRenderer.invoke('eir:hud:reset-layout'),
    // Whether the band covers the window below the bar. Main pairs it with the
    // user's translucency setting to decide the native frost (macOS vibrancy /
    // Windows 11 DWM backdrop) — see hudFrostFor.
    setFrost: showing => ipcRenderer.invoke('eir:hud:frost', showing),
    // The HUD tells main which session it is on; main hands that back to the
    // app window when the HUD closes, so the app can re-home onto it.
    setSession: sessionId => ipcRenderer.send('eir:hud:session', sessionId),
    onGoto: callback => {
      const listener = (_event, sessionId) => callback(sessionId)
      ipcRenderer.on('eir:hud:goto', listener)

      return () => ipcRenderer.removeListener('eir:hud:goto', listener)
    },
    onChanged: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('eir:hud:changed', listener)

      return () => ipcRenderer.removeListener('eir:hud:changed', listener)
    },
    // Linux only, and silent elsewhere: where the cursor is, in page
    // coordinates, or null when it has left the window. Stands in for the
    // mousemove that `setIgnoreMouseEvents(true, { forward: true })` delivers on
    // macOS and Windows but not here.
    onCursor: callback => {
      const listener = (_event, point) => callback(point)
      ipcRenderer.on('eir:hud:cursor', listener)

      return () => ipcRenderer.removeListener('eir:hud:cursor', listener)
    },
    // Main's game-overlay watch: whether a fullscreen app (a game) is under
    // the HUD, so the renderer can step back to the low-opacity overlay
    // treatment while one owns the screen.
    onGameOverlay: callback => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('eir:hud:game-overlay', listener)

      return () => ipcRenderer.removeListener('eir:hud:game-overlay', listener)
    }
  },
  hudModifier: {
    getSettings: () => ipcRenderer.invoke('eir:hud-modifier:settings:get'),
    setEnabled: enabled => ipcRenderer.invoke('eir:hud-modifier:settings:set', enabled),
    openPermissionSettings: () => ipcRenderer.invoke('eir:hud-modifier:permission'),
    onStatus: callback => {
      const listener = (_event: Electron.IpcRendererEvent, status: HudModifierStatus) => callback(status)
      ipcRenderer.on('eir:hud-modifier:status', listener)

      return () => ipcRenderer.removeListener('eir:hud-modifier:status', listener)
    }
  } satisfies HudModifierApi,
  // macOS native screenshot gesture; captures require a main-issued request.
  screenshot:
    process.platform === 'darwin'
      ? {
          getSettings: () => ipcRenderer.invoke('eir:screenshot:settings:get'),
          setEnabled: enabled => ipcRenderer.invoke('eir:screenshot:settings:set', enabled),
          openPermissionSettings: kind => ipcRenderer.invoke('eir:screenshot:permission', kind),
          capture: requestId => ipcRenderer.invoke('eir:screenshot:capture', requestId),
          onStatus: callback => {
            const listener = (_event, status) => callback(status)
            ipcRenderer.on('eir:screenshot:status', listener)

            return () => ipcRenderer.removeListener('eir:screenshot:status', listener)
          },
          onRequest: callback => {
            const channel = 'eir:screenshot:request'
            const listener = (_event, requestId) => callback(requestId)

            if (ipcRenderer.listenerCount(channel) === 0) {
              ipcRenderer.send('eir:screenshot:subscribe', true)
            }

            ipcRenderer.on(channel, listener)

            return () => {
              ipcRenderer.removeListener(channel, listener)

              if (ipcRenderer.listenerCount(channel) === 0) {
                ipcRenderer.send('eir:screenshot:subscribe', false)
              }
            }
          }
        }
      : undefined,
  // Quick Entry: the global-hotkey mini composer window. Main owns the OS
  // shortcut + the persisted preference; the quick window only captures text
  // and hands it back, and the primary renderer submits it through the normal
  // prompt path.
  quickEntry: {
    getSettings: () => ipcRenderer.invoke('eir:quick-entry:settings:get'),
    setSettings: patch => ipcRenderer.invoke('eir:quick-entry:settings:set', patch),
    // Invoke returns the delivery result so the draft is not lost (#85590).
    submit: payload => ipcRenderer.invoke('eir:quick-entry:submit', payload),
    // Main cannot invoke the primary renderer, so it receives this ack (#85590).
    ackSubmit: (correlationId, result) => ipcRenderer.send('eir:quick-entry:ack', { correlationId, result }),
    dismiss: () => ipcRenderer.send('eir:quick-entry:dismiss'),
    // Primary renderer → main → quick window: gateway connection state + the
    // recent-session options the target picker offers. Main caches the latest
    // payload so a freshly spawned quick window starts from truth.
    pushState: payload => ipcRenderer.send('eir:quick-entry:state', payload),
    // Quick window subscribes to those pushes.
    onState: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:quick-entry:state', listener)

      return () => ipcRenderer.removeListener('eir:quick-entry:state', listener)
    },
    // Main → primary renderer: a submit captured by the quick window.
    onSubmit: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:quick-entry:submit', listener)

      return () => ipcRenderer.removeListener('eir:quick-entry:submit', listener)
    },
    // Main → quick window: you were just summoned (reset draft + refocus).
    onShown: callback => {
      const listener = () => callback()
      ipcRenderer.on('eir:quick-entry:shown', listener)

      return () => ipcRenderer.removeListener('eir:quick-entry:shown', listener)
    },
    // Main → quick window: the outcome of a submit whose relay already timed
    // out. Delivery is now KNOWN — reconcile the unknown state instead of
    // leaving the user to resend a prompt that may already be delivered.
    onLateResult: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:quick-entry:late-result', listener)

      return () => ipcRenderer.removeListener('eir:quick-entry:late-result', listener)
    }
  },
  getBootProgress: () => ipcRenderer.invoke('eir:boot-progress:get'),
  getConnectionConfig: profile => ipcRenderer.invoke('eir:connection-config:get', profile),
  saveConnectionConfig: payload => ipcRenderer.invoke('eir:connection-config:save', payload),
  applyConnectionConfig: payload => ipcRenderer.invoke('eir:connection-config:apply', payload),
  testConnectionConfig: payload => ipcRenderer.invoke('eir:connection-config:test', payload),
  // Opt-in OS-keychain encryption for stored gateway secrets (default off —
  // see secret-storage-policy.ts). get never touches the OS keychain.
  getSecretStorageEncryption: () => ipcRenderer.invoke('eir:secret-storage:get'),
  setSecretStorageEncryption: (on: boolean) => ipcRenderer.invoke('eir:secret-storage:set', on),
  // v2 multi-connection registry: named agent sources (local / remote / cloud / ssh).
  connections: {
    list: () => ipcRenderer.invoke('eir:connections:list'),
    save: payload => ipcRenderer.invoke('eir:connections:save', payload),
    remove: id => ipcRenderer.invoke('eir:connections:remove', id),
    setPrimary: id => ipcRenderer.invoke('eir:connections:set-primary', id),
    setLaunchMode: mode => ipcRenderer.invoke('eir:connections:set-launch-mode', mode),
    setLastUsed: id => ipcRenderer.invoke('eir:connections:set-last-used', id),
    test: id => ipcRenderer.invoke('eir:connections:test', id),
    updateManaged: id => ipcRenderer.invoke('eir:connections:update-managed', id),
    // Fan out `eir update` to every eligible registered connection.
    // Optional excludeIds skips rows the caller updates through another path.
    updateAll: options => ipcRenderer.invoke('eir:connections:update-all', options),
    // Registry lifecycle push (main → renderer): a connection was removed or
    // materially edited, so secondaries scoped to it must be disposed (and,
    // for edits, re-dialed at the new target).
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:connections:changed', listener)

      return () => ipcRenderer.removeListener('eir:connections:changed', listener)
    }
  },
  sshConfigHosts: () => ipcRenderer.invoke('eir:ssh-config:hosts'),
  sshResolveHost: host => ipcRenderer.invoke('eir:ssh-config:resolve', host),
  probeConnectionConfig: remoteUrl => ipcRenderer.invoke('eir:connection-config:probe', remoteUrl),
  // `options` lets a registry-editor draft sign in BEFORE it is saved: the
  // main process settles the draft's connection id up front so the login
  // window writes into the per-connection cookie jar the saved entry will
  // read (not the legacy shared jar an unsaved URL would fall back to).
  oauthLoginConnectionConfig: (remoteUrl, options) =>
    ipcRenderer.invoke('eir:connection-config:oauth-login', remoteUrl, options),
  oauthLogoutConnectionConfig: remoteUrl => ipcRenderer.invoke('eir:connection-config:oauth-logout', remoteUrl),
  // Eir Cloud: one portal login powers discovery + silent per-agent sign-in
  // (cloud-auto-discovery Phase 3).
  cloud: {
    status: () => ipcRenderer.invoke('eir:cloud:status'),
    login: () => ipcRenderer.invoke('eir:cloud:login'),
    logout: () => ipcRenderer.invoke('eir:cloud:logout'),
    discover: org => ipcRenderer.invoke('eir:cloud:discover', org),
    agentSignIn: dashboardUrl => ipcRenderer.invoke('eir:cloud:agent-sign-in', dashboardUrl)
  },
  profile: {
    getDefault: () => ipcRenderer.invoke('eir:profile:default:get'),
    setDefault: (route: DesktopProfileRoute) => ipcRenderer.invoke('eir:profile:default:set', route),
    onDefaultChanged: (callback: (route: DesktopProfileRoute | null) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, route: DesktopProfileRoute | null) => callback(route)
      ipcRenderer.on('eir:profile:default:changed', listener)

      return () => ipcRenderer.removeListener('eir:profile:default:changed', listener)
    },
    get: () => ipcRenderer.invoke('eir:profile:get'),
    remember: name => ipcRenderer.invoke('eir:profile:remember', name),
    importConnections: (record: Record<string, string>) =>
      ipcRenderer.invoke('eir:profile:connections:import', record),
    rememberConnection: (connectionId: string, profile: string) =>
      ipcRenderer.invoke('eir:profile:connections:remember', connectionId, profile),
    set: name => ipcRenderer.invoke('eir:profile:set', name)
  },
  // The handler resolves an expected 404 with a sentinel instead of rejecting
  // (Electron logs a stack for every rejected invoke). Turn it back into the
  // rejection the renderer expects — see electron/api-expected-404.ts.
  api: request => ipcRenderer.invoke('eir:api', request).then(unwrapExpectedNotFound),
  notify: payload => ipcRenderer.invoke('eir:notify', payload),
  claimStartupLatency: () => ipcRenderer.invoke('eir:startup-latency:claim'),
  requestMicrophoneAccess: () => ipcRenderer.invoke('eir:requestMicrophoneAccess'),
  readWindowBelow: () => ipcRenderer.invoke('eir:window:readBelow'),
  readFileDataUrl: filePath => ipcRenderer.invoke('eir:readFileDataUrl', filePath),
  readFileDataUrlForAttach: filePath => ipcRenderer.invoke('eir:readFileDataUrlForAttach', filePath),
  dataUrlReadMax: {
    get: () => ipcRenderer.invoke('eir:data-url-read-max:get'),
    set: maxMb => ipcRenderer.invoke('eir:data-url-read-max:set', maxMb)
  },
  readFileText: filePath => ipcRenderer.invoke('eir:readFileText', filePath),
  readPluginSource: (filePath: string) => ipcRenderer.invoke('eir:readPluginSource', filePath),
  selectPaths: options => ipcRenderer.invoke('eir:selectPaths', options),
  selectSavePath: options => ipcRenderer.invoke('eir:selectSavePath', options),
  saveTextFileAs: request => ipcRenderer.invoke('eir:saveTextFileAs', request),
  writeClipboard: text => ipcRenderer.invoke('eir:writeClipboard', text),
  readClipboard: () => ipcRenderer.invoke('eir:readClipboard'),
  saveGatewayFile: payload => ipcRenderer.invoke('eir:saveGatewayFile', payload),
  saveImageFromUrl: url => ipcRenderer.invoke('eir:saveImageFromUrl', url),
  contextMenuEdit: command => ipcRenderer.invoke('eir:context-menu:edit', command),
  contextMenuCopyImage: () => ipcRenderer.invoke('eir:context-menu:copy-image'),
  contextMenuSpellcheck: action => ipcRenderer.invoke('eir:context-menu:spellcheck', action),
  contextMenuGuestAddWord: payload => ipcRenderer.invoke('eir:context-menu:guest-add-word', payload),
  spellcheckDictionary: (op, word) => ipcRenderer.invoke('eir:spellcheck:dictionary', { op, word }),
  onContextMenuSpellcheck: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:context-menu-spellcheck', listener)

    return () => ipcRenderer.removeListener('eir:context-menu-spellcheck', listener)
  },
  saveImageBuffer: (data, ext, name) => ipcRenderer.invoke('eir:saveImageBuffer', { data, ext, name }),
  capturePreview: payload => ipcRenderer.invoke('eir:capturePreview', payload),
  savePastedText: text => ipcRenderer.invoke('eir:savePastedText', { text }),
  saveClipboardImage: () => ipcRenderer.invoke('eir:saveClipboardImage'),
  getPathForFile: file => {
    try {
      return webUtils.getPathForFile(file) || ''
    } catch {
      return ''
    }
  },
  normalizePreviewTarget: (target, baseDir) => ipcRenderer.invoke('eir:normalizePreviewTarget', target, baseDir),
  watchPreviewFile: url => ipcRenderer.invoke('eir:watchPreviewFile', url),
  watchDirectory: dir => ipcRenderer.invoke('eir:watchDirectory', dir),
  stopPreviewFileWatch: id => ipcRenderer.invoke('eir:stopPreviewFileWatch', id),
  setActiveWork: payload => ipcRenderer.send('eir:active-work', payload),
  scheduleStreamWorkWake: (token, delayMs) => ipcRenderer.send('eir:stream-work-wake', { token, delayMs }),
  onStreamWorkWake: callback => {
    const listener = (_event, token) => callback(token)
    ipcRenderer.on('eir:stream-work-ready', listener)

    return () => ipcRenderer.removeListener('eir:stream-work-ready', listener)
  },
  setTitleBarTheme: payload => ipcRenderer.send('eir:titlebar-theme', payload),
  setNativeTheme: mode => ipcRenderer.send('eir:native-theme', mode),
  setTranslucency: payload => ipcRenderer.send('eir:translucency', payload),
  setKeepAwake: mode => ipcRenderer.send('eir:keep-awake', mode),
  // Once per computer, after a timed sleep interrupted a turn with keep-awake off.
  onKeepAwakeOffer: callback => {
    const listener = () => callback()
    ipcRenderer.on('eir:keep-awake-offer', listener)

    return () => ipcRenderer.removeListener('eir:keep-awake-offer', listener)
  },
  minimizeToTray: {
    get: () => ipcRenderer.invoke('eir:minimize-to-tray:get'),
    set: on => ipcRenderer.invoke('eir:minimize-to-tray:set', on),
    onChanged: callback => {
      const listener = (_event, status) => callback(status)
      ipcRenderer.on('eir:minimize-to-tray:changed', listener)

      return () => ipcRenderer.removeListener('eir:minimize-to-tray:changed', listener)
    }
  },
  setDisableF12: blocked => ipcRenderer.send('eir:devtools:disable-f12', blocked),
  setF12ShortcutActive: active => ipcRenderer.send('eir:f12ShortcutActive', Boolean(active)),
  onF12Shortcut: callback => {
    const listener = (_event, input) => callback(input)
    ipcRenderer.on('eir:f12-shortcut', listener)

    return () => ipcRenderer.removeListener('eir:f12-shortcut', listener)
  },
  setPreviewShortcutActive: active => ipcRenderer.send('eir:previewShortcutActive', Boolean(active)),
  setPreviewGuestHidden: (webContentsId, hidden) =>
    ipcRenderer.send('eir:preview-guest-hidden', { webContentsId, hidden: Boolean(hidden) }),
  beginPreviewGuestActivity: webContentsId => ipcRenderer.invoke('eir:preview-guest-activity:begin', webContentsId),
  endPreviewGuestActivity: token => ipcRenderer.invoke('eir:preview-guest-activity:end', token),
  executePreviewGuestScript: (token, code) => ipcRenderer.invoke('eir:preview-guest-activity:script', token, code),
  syncPreviewSignins: request => ipcRenderer.invoke('eir:preview-signins:sync', request),
  migratePreviewSigninsForProfile: (request: { oldProfile: string; newProfile: string }) =>
    ipcRenderer.invoke('eir:preview-signins:profile-renamed', request),
  dropPreviewSigninsForProfile: (request: { profile: string }) =>
    ipcRenderer.invoke('eir:preview-signins:profile-deleted', request),
  openExternal: url => ipcRenderer.invoke('eir:openExternal', url),
  freeTierChallenge: {
    // Load the account service's challenge page in a hidden window (revealed
    // only if the page asks for the human). Resolves with how it ended.
    run: request => ipcRenderer.invoke('eir:freeTierChallenge:run', request)
  },
  mcpOauth: {
    // One-shot loopback listener for MCP OAuth against remote backends: bind
    // on this machine, hand redirectUri to mcp.servers.oauth.start, then wait
    // for the provider redirect and relay code/state via oauth.callback.
    listen: () => ipcRenderer.invoke('eir:mcp-oauth:listen'),
    wait: (id, timeoutMs) => ipcRenderer.invoke('eir:mcp-oauth:wait', id, timeoutMs),
    cancel: id => ipcRenderer.invoke('eir:mcp-oauth:cancel', id)
  },
  openPreviewInBrowser: url => ipcRenderer.invoke('eir:openPreviewInBrowser', url),
  reachPreviewUrl: url => ipcRenderer.invoke('eir:preview:reach', url),
  setActiveConnectionRoute: route => ipcRenderer.send('eir:connection:active-route', route),
  fetchLinkTitle: url => ipcRenderer.invoke('eir:fetchLinkTitle', url),
  resolveFavicon: url => ipcRenderer.invoke('eir:resolveFavicon', url),
  sanitizeWorkspaceCwd: cwd => ipcRenderer.invoke('eir:workspace:sanitize', cwd),
  settings: {
    getDefaultProjectDir: () => ipcRenderer.invoke('eir:setting:defaultProjectDir:get'),
    setDefaultProjectDir: dir => ipcRenderer.invoke('eir:setting:defaultProjectDir:set', dir),
    pickDefaultProjectDir: () => ipcRenderer.invoke('eir:setting:defaultProjectDir:pick')
  },
  preparedSubmissions: {
    read: () => ipcRenderer.invoke('eir:prepared-submissions:read'),
    update: (key, entry) => ipcRenderer.invoke('eir:prepared-submissions:update', key, entry),
    compareAndSet: (key, expected, entry) =>
      ipcRenderer.invoke('eir:prepared-submissions:compare-and-set', key, expected, entry)
  },
  zoom: {
    // Current zoom of this window, as { level, percent }.
    get: () => ipcRenderer.invoke('eir:zoom:get'),
    // Synchronous zoom factor (1 = 100%). Coordinate math needs it in the
    // same tick as the event it converts, so no IPC round-trip here.
    factor: () => webFrame.getZoomFactor(),
    setPercent: percent => ipcRenderer.send('eir:zoom:set-percent', percent),
    // Fires on every zoom change, including the Ctrl/Cmd +/-/0 shortcuts,
    // so the settings UI can stay in sync with the keyboard.
    onChanged: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:zoom:changed', listener)

      return () => ipcRenderer.removeListener('eir:zoom:changed', listener)
    }
  },
  revealLogs: () => ipcRenderer.invoke('eir:logs:reveal'),
  getRecentLogs: () => ipcRenderer.invoke('eir:logs:recent'),
  // Fire-and-forget: persists a renderer error-boundary catch (with component
  // stack) to desktop.log so crashes survive the window (#79428).
  reportRendererError: report => ipcRenderer.send('eir:logs:renderer-error', report),
  logLine: (line: string): void => ipcRenderer.send('eir:logs:renderer-line', line),
  readDir: dirPath => ipcRenderer.invoke('eir:fs:readDir', dirPath),
  gitRoot: startPath => ipcRenderer.invoke('eir:fs:gitRoot', startPath),
  revealPath: targetPath => ipcRenderer.invoke('eir:fs:reveal', targetPath),
  openDir: dirPath => ipcRenderer.invoke('eir:fs:openDir', dirPath),
  desktopPluginsRoot: () => ipcRenderer.invoke('eir:fs:desktopPluginsRoot'),
  reconcileDesktopPlugins: async () => (await ipcRenderer.invoke('eir:fs:reconcileDesktopPlugins')).published,
  reconcileDesktopPluginsReport: () => ipcRenderer.invoke('eir:fs:reconcileDesktopPlugins'),
  logsRoot: (profile?: string) => ipcRenderer.invoke('eir:fs:logsRoot', profile),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('eir:fs:rename', targetPath, newName),
  writeTextFile: (filePath, content) => ipcRenderer.invoke('eir:fs:writeText', filePath, content),
  trashPath: targetPath => ipcRenderer.invoke('eir:fs:trash', targetPath),
  pluginFiles: {
    request: (pluginId, labels) => ipcRenderer.invoke('eir:pluginFiles:request', pluginId, labels),
    grants: pluginId => ipcRenderer.invoke('eir:pluginFiles:grants', pluginId),
    revoke: (pluginId, folderId) => ipcRenderer.invoke('eir:pluginFiles:revoke', pluginId, folderId),
    op: (pluginId, request) => ipcRenderer.invoke('eir:pluginFiles:op', pluginId, request),
    onChanged: callback => {
      const listener = (_event, change) => callback(change)
      ipcRenderer.on('eir:pluginFiles:changed', listener)

      return () => ipcRenderer.removeListener('eir:pluginFiles:changed', listener)
    }
  },
  git: {
    worktreeList: repoPath => ipcRenderer.invoke('eir:git:worktreeList', repoPath),
    worktreeAdd: (repoPath, options) => ipcRenderer.invoke('eir:git:worktreeAdd', repoPath, options),
    worktreeRemove: (repoPath, worktreePath, options) =>
      ipcRenderer.invoke('eir:git:worktreeRemove', repoPath, worktreePath, options),
    branchSwitch: (repoPath, branch) => ipcRenderer.invoke('eir:git:branchSwitch', repoPath, branch),
    branchList: repoPath => ipcRenderer.invoke('eir:git:branchList', repoPath),
    baseBranchList: repoPath => ipcRenderer.invoke('eir:git:baseBranchList', repoPath),
    repoStatus: repoPath => ipcRenderer.invoke('eir:git:repoStatus', repoPath),
    fileDiff: (repoPath, filePath) => ipcRenderer.invoke('eir:git:fileDiff', repoPath, filePath),
    scanRepos: (roots, options) => ipcRenderer.invoke('eir:git:scanRepos', roots, options),
    review: {
      list: (repoPath, scope, baseRef) => ipcRenderer.invoke('eir:git:review:list', repoPath, scope, baseRef),
      diff: (repoPath, filePath, scope, baseRef, staged) =>
        ipcRenderer.invoke('eir:git:review:diff', repoPath, filePath, scope, baseRef, staged),
      stage: (repoPath, filePath) => ipcRenderer.invoke('eir:git:review:stage', repoPath, filePath),
      unstage: (repoPath, filePath) => ipcRenderer.invoke('eir:git:review:unstage', repoPath, filePath),
      revert: (repoPath, filePath) => ipcRenderer.invoke('eir:git:review:revert', repoPath, filePath),
      revParse: (repoPath, ref) => ipcRenderer.invoke('eir:git:review:revParse', repoPath, ref),
      commit: (repoPath, message, push) => ipcRenderer.invoke('eir:git:review:commit', repoPath, message, push),
      commitContext: repoPath => ipcRenderer.invoke('eir:git:review:commitContext', repoPath),
      push: repoPath => ipcRenderer.invoke('eir:git:review:push', repoPath),
      shipInfo: repoPath => ipcRenderer.invoke('eir:git:review:shipInfo', repoPath),
      prList: (repoPath, branches, numbers) =>
        ipcRenderer.invoke('eir:git:review:prList', repoPath, branches, numbers),
      createPr: repoPath => ipcRenderer.invoke('eir:git:review:createPr', repoPath)
    }
  },
  terminal: {
    attach: id => ipcRenderer.invoke('eir:terminal:attach', id),
    cwd: id => ipcRenderer.invoke('eir:terminal:cwd', id),
    dispose: id => ipcRenderer.invoke('eir:terminal:dispose', id),
    resize: (id, size) => ipcRenderer.invoke('eir:terminal:resize', id, size),
    start: options => ipcRenderer.invoke('eir:terminal:start', options),
    write: (id, data) => ipcRenderer.invoke('eir:terminal:write', id, data),
    onData: (id, callback) => {
      const channel = `eir:terminal:${id}:data`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    },
    onExit: (id, callback) => {
      const channel = `eir:terminal:${id}:exit`
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on(channel, listener)

      return () => ipcRenderer.removeListener(channel, listener)
    }
  },
  onClosePreviewRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('eir:close-preview-requested', listener)

    return () => ipcRenderer.removeListener('eir:close-preview-requested', listener)
  },
  onPreviewNav: callback => {
    const listener = (_event, command) => callback(command)
    ipcRenderer.on('eir:preview-nav', listener)

    return () => ipcRenderer.removeListener('eir:preview-nav', listener)
  },
  onOpenFolderRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('eir:open-folder-requested', listener)

    return () => ipcRenderer.removeListener('eir:open-folder-requested', listener)
  },
  onOpenUpdatesRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('eir:open-updates', listener)

    return () => ipcRenderer.removeListener('eir:open-updates', listener)
  },
  onDeepLink: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:deep-link', listener)

    return () => ipcRenderer.removeListener('eir:deep-link', listener)
  },
  signalDeepLinkReady: () => ipcRenderer.invoke('eir:deep-link-ready'),
  probePluginRepo: payload => ipcRenderer.invoke('eir:plugin:probe', payload),
  installDesktopPlugin: payload => ipcRenderer.invoke('eir:plugin:installDesktop', payload),
  removeDesktopPlugin: payload => ipcRenderer.invoke('eir:plugin:removeDesktop', payload),
  onWindowStateChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:window-state-changed', listener)

    return () => ipcRenderer.removeListener('eir:window-state-changed', listener)
  },
  onFocusSession: callback => {
    const listener = (_event, sessionId) => callback(sessionId)
    ipcRenderer.on('eir:focus-session', listener)

    return () => ipcRenderer.removeListener('eir:focus-session', listener)
  },
  onNotificationAction: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:notification-action', listener)

    return () => ipcRenderer.removeListener('eir:notification-action', listener)
  },
  onNotificationActivate: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:notification-activate', listener)

    return () => ipcRenderer.removeListener('eir:notification-activate', listener)
  },
  onExternalOpenFailed: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:external-open-failed', listener)

    return () => ipcRenderer.removeListener('eir:external-open-failed', listener)
  },
  onPreviewFileChanged: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:preview-file-changed', listener)

    return () => ipcRenderer.removeListener('eir:preview-file-changed', listener)
  },
  onBackendExit: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:backend-exit', listener)

    return () => ipcRenderer.removeListener('eir:backend-exit', listener)
  },
  // Soft gateway-mode apply finished tearing down the primary backend. Renderer
  // should wipe session lists + re-dial without a window reload.
  onConnectionApplied: callback => {
    const listener = () => callback()
    ipcRenderer.on('eir:connection:applied', listener)

    return () => ipcRenderer.removeListener('eir:connection:applied', listener)
  },
  onPowerResume: callback => {
    const listener = () => callback()
    ipcRenderer.on('eir:power-resume', listener)

    return () => ipcRenderer.removeListener('eir:power-resume', listener)
  },
  // AC ↔ battery transitions; renderers slow their backstop polls on battery.
  getOnBattery: () => ipcRenderer.invoke('eir:power-battery:get'),
  onBatteryChanged: callback => {
    const listener = (_event, onBattery) => callback(Boolean(onBattery))
    ipcRenderer.on('eir:power-battery', listener)

    return () => ipcRenderer.removeListener('eir:power-battery', listener)
  },
  onBootProgress: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:boot-progress', listener)

    return () => ipcRenderer.removeListener('eir:boot-progress', listener)
  },
  // First-launch bootstrap progress -- emitted by the install.ps1 stage
  // runner in main.ts (apps/desktop/electron/bootstrap-runner.ts).
  // Renderer's install overlay subscribes to live events and queries the
  // current snapshot via getBootstrapState() to recover after a devtools
  // reload mid-bootstrap.
  getBootstrapState: () => ipcRenderer.invoke('eir:bootstrap:get'),
  probeLocalBackend: () => ipcRenderer.invoke('eir:local-backend:probe'),
  continueBootstrapLocal: () => ipcRenderer.invoke('eir:bootstrap:continue-local'),
  recycleBackend: profile => ipcRenderer.invoke('eir:backend:recycle', profile),
  resetBootstrap: () => ipcRenderer.invoke('eir:bootstrap:reset'),
  updateHold: {
    recheck: () => ipcRenderer.invoke('eir:update-hold:recheck'),
    quit: () => ipcRenderer.invoke('eir:update-hold:quit'),
    startAnyway: (request: { holdId: string; confirmed: true }) =>
      ipcRenderer.invoke('eir:update-hold:start-anyway', request)
  },
  repairBootstrap: () => ipcRenderer.invoke('eir:bootstrap:repair'),
  cancelBootstrap: () => ipcRenderer.invoke('eir:bootstrap:cancel'),
  onBootstrapEvent: callback => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('eir:bootstrap:event', listener)

    return () => ipcRenderer.removeListener('eir:bootstrap:event', listener)
  },
  getVersion: (scope?: { connectionId?: string; profile?: string }) => ipcRenderer.invoke('eir:version', scope),
  relaunchApp: () => ipcRenderer.invoke('eir:app:relaunch'),
  getMachineProfile: () => ipcRenderer.invoke('eir:machine:profile'),
  getRemoteDisplayReason: () => ipcRenderer.invoke('eir:get-remote-display-reason'),
  uninstall: {
    summary: () => ipcRenderer.invoke('eir:uninstall:summary'),
    run: mode => ipcRenderer.invoke('eir:uninstall:run', { mode }),
    openAppsSettings: () => ipcRenderer.invoke('eir:uninstall:openAppsSettings')
  },
  updates: {
    check: opts => ipcRenderer.invoke('eir:updates:check', opts),
    apply: opts => ipcRenderer.invoke('eir:updates:apply', opts),
    setChannel: name => ipcRenderer.invoke('eir:updates:channel:set', name),
    onProgress: callback => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('eir:updates:progress', listener)

      return () => ipcRenderer.removeListener('eir:updates:progress', listener)
    },
    takePendingRun: () => ipcRenderer.invoke('eir:updates:metric:take'),
    ackPendingRun: sent => ipcRenderer.invoke('eir:updates:metric:ack', sent),
    onPendingRun: callback => {
      const listener = () => callback()
      ipcRenderer.on('eir:updates:metric:pending', listener)

      return () => ipcRenderer.removeListener('eir:updates:metric:pending', listener)
    }
  },
  desktopMetrics: {
    setEnabled: (on, profile) => ipcRenderer.invoke('eir:desktop-metrics:set-enabled', on, profile),
    takeRendererCrashes: () => ipcRenderer.invoke('eir:desktop-metrics:crash:take'),
    ackRendererCrashes: sent => ipcRenderer.invoke('eir:desktop-metrics:crash:ack', sent)
  },
  themes: {
    fetchMarketplace: id => ipcRenderer.invoke('eir:vscode-theme:fetch', id),
    searchMarketplace: query => ipcRenderer.invoke('eir:vscode-theme:search', query)
  },
  // Find-in-page (Ctrl/Cmd+F): delegates to Electron's
  // webContents.findInPage on the IPC sender's window so a Cmd+F pressed
  // in a secondary session window searches THAT window, not the primary.
  // `onFoundInPage` returns the unsubscribe fn; the renderer wires it via
  // `initFindInPageListener` in store/find-in-page.ts and tears it down
  // when the FindBar unmounts.
  findInPage: (query, options) => ipcRenderer.invoke('eir:find-in-page', query, options),
  stopFindInPage: () => ipcRenderer.invoke('eir:stop-find-in-page'),
  onFoundInPage: callback => {
    const listener = (_event, result) => callback(result)
    ipcRenderer.on('eir:found-in-page', listener)

    return () => ipcRenderer.removeListener('eir:found-in-page', listener)
  },
  // Main-process `before-input-event` forwards Ctrl/Cmd+F here so renderer
  // can open the FindBar even when the GTK compositor has already grabbed
  // the chord at the windowing layer (#81727).
  onOpenFindBarRequested: callback => {
    const listener = () => callback()
    ipcRenderer.on('eir:open-find-bar', listener)

    return () => ipcRenderer.removeListener('eir:open-find-bar', listener)
  }
})

/**
 * Which persisted keys are machine-level UI preferences (#145213).
 *
 * Only these leave localStorage for the machine's shared store, so native
 * Desktop and every browser that opens this machine's Webapp show the same
 * choices. Scoped families keep their scope inside the key name (a
 * `….profile.<name>` or per-connection suffix): only the location changes.
 *
 * Deliberately NOT here (they stay in this browser/window):
 * - credentials, grants and connection config: gateway registry, custom model
 *   endpoints, plugin decisions and preview-script grants, embed permissions;
 * - per-window or per-device runtime state: layout tree, open tiles and tabs,
 *   last route/session, scroll, zoom, pet and popout geometry, keep-awake;
 * - drafts, queues, journals and caches: composer queue, in-flight turns,
 *   pending/prepared submissions, previews, pricing, backend skin cache, the
 *   "provider configured" onboarding cache (each backend answers that itself);
 * - one-off notices: butterbar, update and real-profile prompts.
 */

const SHARED_KEYS: ReadonlySet<string> = new Set([
  // Appearance.
  'eir-desktop-theme-v2',
  'eir-desktop-mode-v1',
  'eir-desktop-profile-themes-v1',
  'eir-desktop-profile-modes-v1',
  'eir-desktop-user-themes-v1',
  'eir.desktop.backdrop.v1',
  'eir.desktop.chat-text-scale.v1',
  'eir.desktop.interfaceMode.v1',
  'eir.desktop.textDirection',
  'eir.desktop.translucency.v2',
  'eir.desktop.user-bubble-transparency.v1',
  // Sessions sidebar and profile rail.
  'eir.desktop.agentsGroupedByWorkspace',
  'eir.desktop.profileColors',
  'eir.desktop.profileOrder',
  'eir.desktop.profileRailVisible',
  'eir.desktop.sessionListDensity',
  'eir.desktop.sessionOrder',
  'eir.desktop.sessionOrder.manual',
  'eir.desktop.showAllProfiles',
  'eir.desktop.sidebarAgentsGrouped.allProfiles',
  'eir.desktop.sidebarCardRows',
  'eir.desktop.sidebarGrouping',
  'eir.desktop.sidebarGrouping.allProfiles',
  'eir.desktop.sidebarRowMeta',
  'eir.desktop.sidebarShowAllSessions',
  'eir.desktop.sidebarShowArchived',
  'eir.desktop.sidebarSortKey',
  // Status bar.
  'eir.desktop.statusbarHidden.v2',
  'eir.desktop.statusbarVisible.v2',
  // Transcript and tools.
  'eir.desktop.hideThreadTimeline',
  'eir.desktop.reasoning.collapsedByDefault',
  'eir.desktop.toolView.hideCodeDiffs',
  'eir.desktop.toolView.technical',
  // Shell, panes and behaviour.
  'eir.desktop.alwaysExternalLinks.v1',
  'eir.desktop.capabilities.catalogCardView',
  'eir.desktop.composerPopout.enabled',
  'eir.desktop.composerPopout.gesturesEnabled',
  'eir.desktop.files.showIgnored',
  'eir.desktop.keybinds',
  'eir.desktop.layoutPresets.v2',
  'eir.desktop.panesFlipped',
  'eir.desktop.tabStripDefault',
  'eir.desktop.titlebarAppActions',
  // Guidance: what the user already skipped, saw or dismissed does not come
  // back in every new browser or origin (#145600).
  'eir-onboarding-skipped-v1',
  'eir.desktop.tips.last.v1',
  'eir.desktop.tips.next.v1',
  'eir.desktop.tips.retired.v1',
  'eir.desktop.tips.rotation.v1',
  'eir.desktop.tips.shownAt.v1',
  'eir.desktop.tours.v1',
  // Sound and media.
  'eir.desktop.autoSpeakReplies',
  'eir.desktop.completionSoundVariantId',
  'eir.desktop.hapticsMuted',
  'eir.desktop.videoPlaybackSpeed',
  // Model picker.
  'eir.desktop.collapsed-providers',
  'eir.desktop.favorite-models',
  // visible-models is a diff against known-models: they only make sense together.
  'eir.desktop.known-models',
  'eir.desktop.model-presets',
  'eir.desktop.visible-models'
])

/** Families whose scope rides in the key suffix (gateway aliases/order/collapsed). */
const SHARED_PREFIXES: readonly string[] = ['eir.desktop.sidebar.gatewayGroups.v1.']

export function isSharedPreferenceKey(key: string): boolean {
  return SHARED_KEYS.has(key) || SHARED_PREFIXES.some(prefix => key.startsWith(prefix))
}

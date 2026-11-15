/**
 * Eir Cloud owns updates for its agents: it replaces the agent's image, so
 * no in-app updater may be offered there. Two shapes reach a Cloud agent:
 *
 * - the Webapp served BY a Cloud agent (the tab's own origin is the agent):
 *   every update target is Cloud's, because the app itself comes from it;
 * - native Desktop CONNECTED to a Cloud agent: only the backend target is;
 *   the Desktop app on this machine still updates itself.
 */

import { isEirCloudUrl } from '@eir/shared'
import { computed } from 'nanostores'

import type { EirConnection } from '@/global'
import { servedByEirCloud } from '@/lib/eir-cloud-host'
import type { UpdateTarget } from '@/lib/update-copy'
import { $connection } from '@/store/session'

function connectedToEirCloud(connection: EirConnection | null): boolean {
  return connection?.mode === 'remote' && (connection.remoteKind === 'cloud' || isEirCloudUrl(connection.baseUrl))
}

/** Whether Eir Cloud owns updates for `target` under `connection`. */
export function cloudOwnsUpdates(target: UpdateTarget, connection: EirConnection | null = $connection.get()): boolean {
  return servedByEirCloud() || (target === 'backend' && connectedToEirCloud(connection))
}

/**
 * The target a generic "Update Eir" command acts on: the connected backend
 * in remote mode, unless Eir Cloud owns it — then this machine's own app.
 */
export function updateTargetFor(connection: EirConnection | null): UpdateTarget {
  return connection?.mode === 'remote' && !cloudOwnsUpdates('backend', connection) ? 'backend' : 'client'
}

/** Per target: true while every update control for it must stay hidden. */
export const $cloudOwnsUpdates = computed($connection, connection => ({
  backend: cloudOwnsUpdates('backend', connection),
  client: cloudOwnsUpdates('client', connection)
}))

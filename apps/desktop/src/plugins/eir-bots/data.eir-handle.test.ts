/**
 * @eir belongs to the default bot only while its source has no real
 * (pre-reservation) `eir` profile. With one, the roster shows exactly one
 * @eir — the real profile — and the default answers to @default, so a
 * typed @eir reaches the same profile the backend's message_agent does.
 */

import { describe, expect, it, vi } from 'vitest'

import { botHandle, botMentionTag, claimDefaultHandles, mergeMultiSourceRoster, resolveRosterMentions } from './data'
import { previewKind } from './row-helpers'
import type { RosterRow } from './types'

vi.mock('@eir/plugin-sdk', async () => {
  const { atom } = await import('nanostores')

  return { atom, host: {}, queryClient: undefined, useQuery: vi.fn(), useValue: vi.fn() }
})

vi.mock('./shared', () => ({ getPluginCtx: () => null, ID: 'eir-bots' }))

function roster(names: string[]): RosterRow[] {
  const local = { profiles: names.map(name => ({ name })) }

  // What Electron's buildAgentRoster reports for a single local source: bare-name handles.
  const union = {
    agents: names.map(profile => ({
      connectionId: 'local',
      connectionKind: 'local' as const,
      connectionLabel: 'This device',
      handle: profile,
      profile,
      targetProfile: profile
    })),
    primaryConnectionId: 'local'
  }

  return mergeMultiSourceRoster(local, union, 'local').profiles as RosterRow[]
}

describe('the @eir handle', () => {
  it.each([
    [['default', 'researcher'], 'default'],
    [['default', 'eir', 'researcher'], 'eir']
  ])('roster %j shows one @eir and a typed @eir reaches %s', (names, owner) => {
    const rows = roster(names)
    const handles = rows.map(row => botHandle(row.name, row))

    expect(handles.filter(handle => handle === 'eir')).toHaveLength(1)
    expect(rows.map(row => botMentionTag(row)).filter(tag => tag === 'eir')).toHaveLength(1)
    expect(resolveRosterMentions('@eir ping', rows, { name: 'researcher' }).map(row => row.name)).toEqual([owner])
  })

  it('names the default @default once a real eir profile holds the handle', () => {
    const rows = roster(['default', 'eir', 'researcher'])
    const byName = Object.fromEntries(rows.map(row => [row.name, botHandle(row.name, row)]))

    expect(byName).toEqual({ default: 'default', eir: 'eir', researcher: 'researcher' })
    expect(resolveRosterMentions('@default ping', rows, { name: 'researcher' }).map(row => row.name)).toEqual(['default'])
  })

  it('keeps each source separate: a remote eir profile does not rename the local default', () => {
    const rows = claimDefaultHandles<Partial<RosterRow>>([
      { connectionId: 'local', name: 'default' },
      { connectionId: 'mini', name: 'default' },
      { connectionId: 'mini', name: 'eir' }
    ])

    expect(rows.map(row => botHandle(String(row.name), row))).toEqual(['eir', 'default', 'eir'])
  })

  it("never lets a source's stale 'eir' handle on its default answer @eir", () => {
    // An older backend labels its default @eir even beside a real eir profile.
    const rows = claimDefaultHandles<RosterRow>([
      { connectionId: 'mini', handle: 'eir', name: 'default', remoteSource: true },
      { connectionId: 'mini', handle: 'eir', name: 'eir', remoteSource: true },
      { connectionId: 'local', name: 'researcher' }
    ])

    expect(resolveRosterMentions('@eir ping', rows, { name: 'researcher' }).map(row => row.name)).toEqual(['eir'])
  })

  it('names a DM sender in a row preview by its roster handle', () => {
    const rows = claimDefaultHandles<RosterRow>(
      ['default', 'eir', 'researcher'].map(name => ({ connectionId: 'local', name }))
    )

    const sender = (name: string, list: RosterRow[]) =>
      previewKind(`Message from 🤖 ${name} (@x): hi`, list, 'local').fromBot

    expect([sender('default', rows), sender('eir', rows)]).toEqual(['default', 'eir'])
    // No real eir profile: the default is still @eir (#89484).
    expect(sender('default', claimDefaultHandles<RosterRow>([{ connectionId: 'local', name: 'default' }]))).toBe(
      'eir'
    )
  })
})

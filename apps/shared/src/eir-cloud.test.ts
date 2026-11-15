import { describe, expect, it } from 'vitest'

import { isEirCloudUrl } from './eir-cloud'

describe('isEirCloudUrl', () => {
  it('recognises production and staging agent hosts, nothing else', () => {
    expect(isEirCloudUrl('https://ares-3009.agents.nousresearch.com')).toBe(true)
    expect(isEirCloudUrl('https://ares--app.agents.staging-nousresearch.com/')).toBe(true)
    expect(isEirCloudUrl('https://agents.nousresearch.com.evil.example')).toBe(false)
    expect(isEirCloudUrl('https://my-box.tailnet.ts.net')).toBe(false)
    expect(isEirCloudUrl('not a url')).toBe(false)
    expect(isEirCloudUrl(undefined)).toBe(false)
  })
})

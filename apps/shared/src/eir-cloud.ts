/**
 * Eir Cloud agents: their public host is `<label>.agents.nousresearch.com`
 * (staging `<label>.agents.staging-nousresearch.com`), the URL the portal gives
 * each agent. Cloud updates an agent by replacing its image, so nothing may run
 * `eir update` against one.
 */

const EIR_CLOUD_HOST_SUFFIXES = ['.agents.nousresearch.com', '.agents.staging-nousresearch.com']

/** Why an update target is skipped: the platform updates it. */
export const EIR_CLOUD_MANAGED = 'cloud-managed'

export function isEirCloudUrl(url: null | string | undefined): boolean {
  if (!url) {
    return false
  }

  try {
    const host = new URL(url).hostname.toLowerCase()

    return EIR_CLOUD_HOST_SUFFIXES.some(suffix => host.endsWith(suffix))
  } catch {
    return false
  }
}

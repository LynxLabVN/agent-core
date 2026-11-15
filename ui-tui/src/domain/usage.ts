import type { Usage } from '@eir/shared/gateway-events'

export { usageFromTick } from '@eir/shared/usage-tick'

export const ZERO: Usage = { calls: 0, input: 0, output: 0, total: 0 }

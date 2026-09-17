import { describe, expect, it } from 'vitest'
import { nextVersion, versionPrefix } from './configRepo'

const today = new Date('2026-09-17T13:00:00Z')

describe('nextVersion', () => {
  it('starts at .1 on a fresh day', () => {
    expect(nextVersion([], today)).toBe('pricing-2026-09-17.1')
    expect(nextVersion(['pricing-2026-09-16.4'], today)).toBe('pricing-2026-09-17.1')
  })

  it('continues after the highest number today, whatever the order', () => {
    expect(nextVersion(['pricing-2026-09-17.2', 'pricing-2026-09-17.1'], today)).toBe('pricing-2026-09-17.3')
    expect(nextVersion(['pricing-2026-09-17.10', 'pricing-2026-09-17.9'], today)).toBe('pricing-2026-09-17.11')
  })

  it('ignores versions that do not follow the pattern', () => {
    expect(nextVersion(['pricing-demo-previous', 'pricing-2026-09-17.x'], today)).toBe('pricing-2026-09-17.1')
  })

  it('uses the UTC date, like every version already in the table', () => {
    expect(versionPrefix(new Date('2026-09-17T23:30:00-05:00'))).toBe('pricing-2026-09-18.')
  })
})

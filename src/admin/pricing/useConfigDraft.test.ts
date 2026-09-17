import { describe, expect, it } from 'vitest'
import { fieldErrors } from '../configLabels'
import { ADMIN_BUNDLES } from '../strings'
import { resolveFieldError } from './useConfigDraft'

const en = ADMIN_BUNDLES.en

describe('resolveFieldError', () => {
  const errs = fieldErrors(
    [
      'packages[0].battery: liquid needs integer count > 0 and ampHours > 0',
      'packages[1].priceLyd: must be a positive number',
      'packages: must be an array of exactly 5 packages',
      "loadDefaults.appliancesByName: missing 'TV' — the form offers it, so it needs a power figure",
      'customBom.fixed[2]: needs qty > 0',
    ],
    en,
  )

  it('a field gets its own error first', () => {
    expect(resolveFieldError(errs, 'packages[1].priceLyd')?.reason).toBe(en.pricing.paths.reason.positive)
  })

  it('a field inherits the error on its container', () => {
    expect(resolveFieldError(errs, 'packages[0].battery.count')?.reason).toBe(en.pricing.paths.reason.liquidBattery)
    expect(resolveFieldError(errs, 'packages[0].battery.ampHours')?.reason).toBe(en.pricing.paths.reason.liquidBattery)
    expect(resolveFieldError(errs, 'customBom.fixed[2].qty')?.reason).toBe(en.pricing.paths.reason.qty)
  })

  it('but not a top-level section error, which is shown at the top', () => {
    expect(resolveFieldError(errs, 'packages[3].inverterKva')).toBeNull()
  })

  it('nor a table-level error about a different row', () => {
    expect(resolveFieldError(errs, 'loadDefaults.appliancesByName["Dryer"].watts')).toBeNull()
    // The table itself still gets it.
    expect(resolveFieldError(errs, 'loadDefaults.appliancesByName')?.reason).toContain('TV')
  })

  it('a clean field has none', () => {
    expect(resolveFieldError(errs, 'sizing.peakSunHours')).toBeNull()
  })
})

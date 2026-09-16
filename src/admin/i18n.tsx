import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { BUNDLES } from '../i18n'
import type { Lang, Strings } from '../i18n'
import { ADMIN_BUNDLES } from './strings'
import type { AdminStrings } from './strings'

/**
 * Language for the admin panel — its own provider, not the customer one.
 *
 * The two are independent on purpose: a salesperson working in Arabic must
 * not flip the customer site, and the customer's choice is never remembered
 * while the staff's is. What they share is the `opt` label maps for stored
 * form values, which the admin reads from the customer bundle so a property
 * type or an outage bracket is translated once, in one place.
 */

const STORAGE_KEY = 'alqema.admin.lang.v1'

/** Arabic first: it matches the customer site and the sales team. */
const DEFAULT_LANG: Lang = 'ar'

const readStored = (): Lang => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'ar' || v === 'en' ? v : DEFAULT_LANG
  } catch {
    return DEFAULT_LANG
  }
}

type AdminLangValue = {
  lang: Lang
  dir: 'rtl' | 'ltr'
  isRtl: boolean
  /** The admin bundle. */
  t: AdminStrings
  /** The customer bundle's label maps for stored form values. */
  opt: Strings['opt']
  units: Strings['units']
  setLang: (l: Lang) => void
}

const AdminLangContext = createContext<AdminLangValue | null>(null)

export function AdminLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored)

  const setLang = (l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(STORAGE_KEY, l)
    } catch {
      // Private mode or blocked storage: the choice lasts for the session.
    }
  }

  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  const t = ADMIN_BUNDLES[lang]

  // Layout effect, not effect: index.html ships `dir="rtl"`, and a plain
  // effect runs after paint, so an English admin would flash one RTL frame.
  useLayoutEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = dir
    document.title = t.app.title
  }, [lang, dir, t])

  const value = useMemo<AdminLangValue>(
    () => ({
      lang,
      dir,
      isRtl: dir === 'rtl',
      t,
      opt: BUNDLES[lang].opt,
      units: BUNDLES[lang].units,
      setLang,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang],
  )

  return <AdminLangContext.Provider value={value}>{children}</AdminLangContext.Provider>
}

export function useAdminLang(): AdminLangValue {
  const ctx = useContext(AdminLangContext)
  if (!ctx) throw new Error('useAdminLang must be used within AdminLangProvider')
  return ctx
}

/**
 * Label lookup for a database column typed `string` (`tier`, `lang`,
 * `confidence`, `property_type`). The maps say `string`; the runtime can say
 * `undefined`, and the honest fallback is the raw value, never a blank.
 */
export const lookup = (map: Record<string, string>, key: string | null | undefined): string =>
  key ? (map[key] ?? key) : ''

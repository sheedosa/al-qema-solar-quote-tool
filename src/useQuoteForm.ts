import { useCallback, useRef, useState } from 'react'
import {
  initialData,
  makeAc,
  makeAppliance,
  type Preset,
} from './logic'
import type { AcUnit, ColdUnit, FormData, Lighting, PhotoKey } from './types'

/**
 * Owns the wizard's form state and exposes the same mutation surface as the
 * original design prototype's logic class.
 */
export function useQuoteForm() {
  const [data, setData] = useState<FormData>(initialData)
  const appId = useRef(1)

  const setD = useCallback((patch: Partial<FormData>) => {
    setData((s) => ({ ...s, ...patch }))
  }, [])

  const setAcCount = useCallback((n: number) => {
    n = Math.max(0, Math.min(10, n))
    setData((s) => {
      let arr = s.acUnits.slice()
      while (arr.length < n) arr.push(makeAc())
      arr = arr.slice(0, n)
      return { ...s, acUnits: arr }
    })
  }, [])

  const setAc = useCallback((i: number, patch: Partial<AcUnit>) => {
    setData((s) => ({
      ...s,
      acUnits: s.acUnits.map((u, j) => (j === i ? { ...u, ...patch } : u)),
    }))
  }, [])

  const removeAc = useCallback((i: number) => {
    setData((s) => ({ ...s, acUnits: s.acUnits.filter((_, j) => j !== i) }))
  }, [])

  const setCold = useCallback(
    (key: 'fridge' | 'freezer', patch: Partial<ColdUnit>) => {
      setData((s) => ({ ...s, [key]: { ...s[key], ...patch } }))
    },
    [],
  )

  const setLight = useCallback((patch: Partial<Lighting>) => {
    setData((s) => ({ ...s, lighting: { ...s.lighting, ...patch } }))
  }, [])

  const addAppliance = useCallback((p: Preset | null) => {
    setData((s) => ({
      ...s,
      appliances: s.appliances.concat([makeAppliance(appId.current++, p)]),
    }))
  }, [])

  const setApp = useCallback(
    (id: number, patch: Partial<FormData['appliances'][number]>) => {
      setData((s) => ({
        ...s,
        appliances: s.appliances.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      }))
    },
    [],
  )

  const removeApp = useCallback((id: number) => {
    setData((s) => ({ ...s, appliances: s.appliances.filter((a) => a.id !== id) }))
  }, [])

  const setPhoto = useCallback((key: PhotoKey, url: string | null) => {
    setData((s) => ({ ...s, photos: { ...s.photos, [key]: url } }))
  }, [])

  const reset = useCallback(() => {
    setData(initialData())
  }, [])

  return {
    data,
    setD,
    setAcCount,
    setAc,
    removeAc,
    setCold,
    setLight,
    addAppliance,
    setApp,
    removeApp,
    setPhoto,
    reset,
  }
}

export type QuoteForm = ReturnType<typeof useQuoteForm>

/** Read a File input's first file as an object URL and pass it to `cb`. */
export function fileUrl(
  e: React.ChangeEvent<HTMLInputElement>,
  cb: (url: string) => void,
) {
  const f = e.target.files && e.target.files[0]
  if (f) cb(URL.createObjectURL(f))
}

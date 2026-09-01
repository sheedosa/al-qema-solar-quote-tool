import { useCallback, useEffect, useRef, useState } from 'react'
import { initialData, makeAc, makeAppliance } from './logic'
import type { AcUnit, ColdUnit, FormData, Lighting, PhotoKey } from './types'

/**
 * Every object URL this form has handed out. Blob URLs pin their file in
 * memory until explicitly revoked, and camera captures on a phone are several
 * megabytes each — nothing used to revoke them, so replacing or removing a
 * photo leaked the old one for the lifetime of the tab.
 */
function revoke(url: string | null | undefined) {
  if (url && url.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url)
    } catch {
      /* already gone */
    }
  }
}

/**
 * Owns the wizard's form state and exposes the same mutation surface as the
 * original design prototype's logic class.
 */
export function useQuoteForm(initial?: FormData) {
  const [data, setData] = useState<FormData>(() => initial ?? initialData())
  const appId = useRef(1)
  const acId = useRef(1)

  // Release every outstanding object URL when the form unmounts.
  const dataRef = useRef(data)
  dataRef.current = data
  useEffect(() => {
    return () => {
      const d = dataRef.current
      Object.values(d.photos).forEach(revoke)
      d.acUnits.forEach((u) => revoke(u.photo))
    }
  }, [])

  const setD = useCallback((patch: Partial<FormData>) => {
    setData((s) => ({ ...s, ...patch }))
  }, [])

  const setAcCount = useCallback((n: number) => {
    n = Math.max(0, Math.min(10, n))
    setData((s) => {
      let arr = s.acUnits.slice()
      while (arr.length < n) arr.push(makeAc(acId.current++))
      // Trimming drops rows off the end — release their photos first.
      arr.slice(n).forEach((u) => revoke(u.photo))
      arr = arr.slice(0, n)
      return { ...s, acUnits: arr }
    })
  }, [])

  const setAc = useCallback((i: number, patch: Partial<AcUnit>) => {
    setData((s) => ({
      ...s,
      acUnits: s.acUnits.map((u, j) => {
        if (j !== i) return u
        // Replacing a photo orphans the previous blob unless it is revoked.
        if ('photo' in patch && patch.photo !== u.photo) revoke(u.photo)
        return { ...u, ...patch }
      }),
    }))
  }, [])

  const removeAc = useCallback((i: number) => {
    setData((s) => {
      revoke(s.acUnits[i]?.photo)
      return { ...s, acUnits: s.acUnits.filter((_, j) => j !== i) }
    })
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

  const addAppliance = useCallback((name: string | null) => {
    setData((s) => ({
      ...s,
      appliances: s.appliances.concat([makeAppliance(appId.current++, name)]),
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
    setData((s) => {
      if (s.photos[key] !== url) revoke(s.photos[key])
      return { ...s, photos: { ...s.photos, [key]: url } }
    })
  }, [])

  const reset = useCallback(() => {
    setData((s) => {
      Object.values(s.photos).forEach(revoke)
      s.acUnits.forEach((u) => revoke(u.photo))
      return initialData()
    })
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

/** Longest edge, in px, we keep a picked photo at. */
const MAX_PHOTO_EDGE = 1600

/**
 * Read a File input's first file as an object URL and pass it to `cb`.
 *
 * Phone captures are frequently 8–12 megapixels and were being decoded at full
 * size into 56px thumbnails. The image is downscaled first where the browser
 * supports it, and falls back to the original blob otherwise — a photo the
 * customer picked must never be silently dropped.
 */
export function fileUrl(e: React.ChangeEvent<HTMLInputElement>, cb: (url: string) => void) {
  const f = e.target.files && e.target.files[0]
  if (!f) return
  const original = URL.createObjectURL(f)
  if (!f.type.startsWith('image/') || typeof document === 'undefined') return cb(original)

  const img = new Image()
  img.onload = () => {
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.width, img.height))
    if (scale === 1) return cb(original)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return cb(original)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => {
          if (!blob) return cb(original)
          revoke(original)
          cb(URL.createObjectURL(blob))
        },
        'image/jpeg',
        0.85,
      )
    } catch {
      cb(original)
    }
  }
  img.onerror = () => cb(original)
  img.src = original
}

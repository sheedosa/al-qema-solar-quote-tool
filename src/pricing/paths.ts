/**
 * One grammar for addressing a value inside the pricing config.
 *
 * The validator already emits paths in this shape — `sizing.peakSunHours`,
 * `packages[2].priceLyd`, `components["Jinko 590W"]` — so by parsing that
 * same syntax, a field's address, its validation error, its entry in a diff
 * and its "scroll to it" handle are all the same string. Nothing else in the
 * admin needs to know how the config is nested.
 */

export type Seg = { key: string } | { index: number }

const IDENT = /^[A-Za-z_$][\w$]*$/

/**
 * Parse `a.b[2]["some name"].c`. A map key in `["…"]` and a dotted identifier
 * both become `{ key }`; `[digits]` becomes `{ index }`. Unparseable input
 * degrades to a single key segment rather than throwing — labels then fall
 * back to the raw path, which is ugly but never a crash.
 */
export function parsePath(path: string): Seg[] {
  const segs: Seg[] = []
  let i = 0
  const n = path.length
  while (i < n) {
    const ch = path[i]
    if (ch === '.') {
      i++
      continue
    }
    if (ch === '[') {
      if (path[i + 1] === '"') {
        // Quoted key: up to the next `"]`. Names are never escaped by the
        // validator, so this is the only sensible reading.
        const end = path.indexOf('"]', i + 2)
        if (end === -1) return [{ key: path }]
        segs.push({ key: path.slice(i + 2, end) })
        i = end + 2
        continue
      }
      const end = path.indexOf(']', i)
      if (end === -1) return [{ key: path }]
      const num = Number(path.slice(i + 1, end))
      if (!Number.isInteger(num) || num < 0) return [{ key: path }]
      segs.push({ index: num })
      i = end + 1
      continue
    }
    let j = i
    while (j < n && path[j] !== '.' && path[j] !== '[') j++
    segs.push({ key: path.slice(i, j) })
    i = j
  }
  return segs
}

export function formatPath(segs: readonly Seg[]): string {
  let out = ''
  for (const s of segs) {
    if ('index' in s) out += '[' + s.index + ']'
    else if (IDENT.test(s.key)) out += (out ? '.' : '') + s.key
    else out += '["' + s.key + '"]'
  }
  return out
}

const segKey = (s: Seg): string | number => ('index' in s ? s.index : s.key)

export function getAt(obj: unknown, path: string): unknown {
  let cur: unknown = obj
  for (const s of parsePath(path)) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string | number, unknown>)[segKey(s)]
  }
  return cur
}

/**
 * Mutates `obj` in place — meant to run inside the editor's `patch()`, which
 * has already deep-cloned. Intermediate containers are created as needed so a
 * new add-on or list line can be written by path.
 */
export function setAt(obj: unknown, path: string, value: unknown): void {
  const segs = parsePath(path)
  if (segs.length === 0) return
  let cur = obj as Record<string | number, unknown>
  for (let i = 0; i < segs.length - 1; i++) {
    const k = segKey(segs[i])
    const next = cur[k]
    if (next === null || typeof next !== 'object') {
      cur[k] = 'index' in segs[i + 1] ? [] : {}
    }
    cur = cur[k] as Record<string | number, unknown>
  }
  cur[segKey(segs[segs.length - 1])] = value
}

/** `packages[2].priceLyd` → `packages[2]`; a top-level key → null. */
export function parentPath(path: string): string | null {
  const segs = parsePath(path)
  if (segs.length <= 1) return null
  return formatPath(segs.slice(0, -1))
}

/** A DOM-safe id for a path, so an error can scroll to its field. */
export const domId = (path: string): string => 'cfg-' + path.replace(/[^\w-]+/g, '-')

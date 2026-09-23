/**
 * The one way the app talks to the backend.
 *
 * POST bodies are JSON sent as `text/plain`: that makes the request "simple"
 * in CORS terms, so the browser sends it without a preflight, which Apps
 * Script cannot answer. Nothing here ever throws — a network failure, a
 * timeout, an HTML error page from Google, all come back as `{ ok: false }`.
 */
import { SHEETS_API_URL } from '../config'
import type { Action, ApiError, ApiResult, ErrorCode } from './protocol'

const fail = (code: ErrorCode, message: string): ApiError => ({ ok: false, code, message })

/** Worth trying again later: the request itself was fine. */
export function isRetryable(code: ErrorCode): boolean {
  return (
    code === 'network' ||
    code === 'server' ||
    code === 'busy' ||
    code === 'rate_limited' ||
    code === 'bad_response' ||
    code === 'not_configured'
  )
}

async function send<A extends Action>(init: RequestInit & { url: string }, timeoutMs: number): Promise<ApiResult<A>> {
  if (!SHEETS_API_URL) return fail('not_configured', 'The backend URL is not set')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(init.url, { ...init, signal: controller.signal, redirect: 'follow' })
    // Read the body inside the timeout: a server that sends headers and then
    // stalls must not leave the caller waiting forever.
    const text = await res.text()
    if (!res.ok) return fail('bad_response', 'HTTP ' + res.status)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      // Typically Google's HTML sign-in page: the web app is not deployed
      // for "Anyone", or the URL is wrong.
      return fail('bad_response', 'The backend did not answer with JSON')
    }
    if (body && typeof body === 'object' && 'ok' in body) return body as ApiResult<A>
    return fail('bad_response', 'Unexpected answer')
  } catch (err) {
    return fail('network', err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timer)
  }
}

export function callApi<A extends Action>(action: A, body: object, timeoutMs = 15000): Promise<ApiResult<A>> {
  return send<A>(
    {
      url: SHEETS_API_URL,
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, action }),
    },
    timeoutMs,
  )
}

/** The published pricing config — a GET, so it is as light as it can be. */
export function fetchActiveConfig(timeoutMs: number): Promise<ApiResult<'config'>> {
  return send<'config'>({ url: SHEETS_API_URL + '?action=config', method: 'GET' }, timeoutMs)
}

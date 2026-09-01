import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { LangProvider } from './i18n'
import { PRICING_CONFIG } from './pricing/config'
import type { PricingConfig } from './pricing/types'
import { flushPendingLeads } from './pricing/persist'
import { loadActiveConfig } from './pricing/remoteConfig'

const wantAdmin = window.location.hash.startsWith('#/admin')

// Hash edits don't reload on their own — force one when admin-ness flips.
window.addEventListener('hashchange', () => {
  if (window.location.hash.startsWith('#/admin') !== wantAdmin) window.location.reload()
})

const root = createRoot(document.getElementById('root')!)

if (wantAdmin) {
  // The boot placeholder is a fixed full-screen overlay. It is removed on the
  // customer path once React mounts; the admin path has to remove it too, or
  // the panel renders underneath it and the overlay swallows every click.
  document.getElementById('boot')?.remove()
  // Lazy chunk: company staff only — customers never download it.
  const AdminApp = lazy(() => import('./admin/AdminApp'))
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <Suspense fallback={<div />}>
          <AdminApp />
        </Suspense>
      </ErrorBoundary>
    </StrictMode>,
  )
} else {
  // Load the live pricing config (remote → cache → bundled) before first
  // render so the whole session prices against one consistent version.
  const start = (cfg: PricingConfig, source: string) => {
    // Which config won matters when a quote is disputed later, and it is the
    // only signal that the remote load is failing.
    if (source !== 'remote') console.warn('[alqema] pricing config source:', source)
    document.getElementById('boot')?.remove()
    // Deliver anything a previous visit could not save.
    void flushPendingLeads()
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <LangProvider>
            <App cfg={cfg} />
          </LangProvider>
        </ErrorBoundary>
      </StrictMode>,
    )
  }

  // `loadActiveConfig` is written never to throw, but the entire first render
  // hangs off this promise — so a rejection or a module-level failure would
  // mean no render at all. Falling back to the bundled config guarantees the
  // customer always sees the form.
  loadActiveConfig().then(
    ({ cfg, source }) => start(cfg, source),
    (err) => {
      console.error('[alqema] config load failed', err)
      start(PRICING_CONFIG, 'bundled')
    },
  )
}

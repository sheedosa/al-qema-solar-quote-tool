import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { LangProvider } from './i18n'
import { loadActiveConfig } from './pricing/remoteConfig'

const wantAdmin = window.location.hash.startsWith('#/admin')

// Hash edits don't reload on their own — force one when admin-ness flips.
window.addEventListener('hashchange', () => {
  if (window.location.hash.startsWith('#/admin') !== wantAdmin) window.location.reload()
})

const root = createRoot(document.getElementById('root')!)

if (wantAdmin) {
  // Lazy chunk: company staff only — customers never download it.
  const AdminApp = lazy(() => import('./admin/AdminApp'))
  root.render(
    <StrictMode>
      <Suspense fallback={<div />}>
        <AdminApp />
      </Suspense>
    </StrictMode>,
  )
} else {
  // Load the live pricing config (remote → cache → bundled) before first
  // render so the whole session prices against one consistent version.
  void loadActiveConfig().then(({ cfg }) => {
    root.render(
      <StrictMode>
        <LangProvider>
          <App cfg={cfg} />
        </LangProvider>
      </StrictMode>,
    )
  })
}

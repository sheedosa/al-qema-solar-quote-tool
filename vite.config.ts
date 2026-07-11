import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// `base` is the repo name so assets resolve on the GitHub Pages project URL
// (https://sheedosa.github.io/al-qema-solar-quote-tool/).
export default defineConfig({
  base: '/al-qema-solar-quote-tool/',
  plugins: [react()],
})

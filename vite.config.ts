import { defineConfig } from 'vitest/config'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'
import pkg from './package.json' with { type: 'json' }

const base = '/amway-tracker-pwa/'

// Strict CSP for production builds only (dev server needs inline scripts for HMR).
// connect-src 'self': the app makes no network calls beyond loading itself.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
  "connect-src 'self'; manifest-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"
const csp: Plugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head' }],
}

const sha = (process.env.GITHUB_SHA ?? (() => { try { return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return 'dev' } })()).slice(0, 7)

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __GIT_SHA__: JSON.stringify(sha) },
  build: { sourcemap: false },
  plugins: [
    react(),
    csp,
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon.svg'],
      manifest: {
        id: base,
        name: '安麗長客統計',
        short_name: '長客統計',
        description: '離線記錄安麗長期訂購客戶、產品與每月扣款統計',
        lang: 'zh-TW',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F8F9FC',
        theme_color: '#3B6EA8',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // No runtime caching: the app never calls the network beyond loading itself.
        runtimeCaching: [],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})

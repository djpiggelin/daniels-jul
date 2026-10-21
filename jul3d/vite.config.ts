import { defineConfig } from 'vite'

// Built into ../dist/by/ next to the 2D site; netlify.toml serves it as the front page.
// Shares public/ (art, sounds, example content) and src/data.ts with the 2D site.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/by/' : '/',
  publicDir: '../public',
  server: { fs: { allow: ['..'] } },
  build: { outDir: '../dist/by', emptyOutDir: true, copyPublicDir: false },
  // public/ is served from the site root by the 2D build, not from /by/
  experimental: { renderBuiltUrl: (file, { type }) => (type === 'public' ? `/${file}` : undefined) },
}))

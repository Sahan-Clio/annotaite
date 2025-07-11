import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { createRequire } from 'node:module'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const require = createRequire(import.meta.url)
const pdfjsDistPath = path.dirname(require.resolve('pdfjs-dist/package.json'))
const cMapsDir = normalizePath(path.join(pdfjsDistPath, 'cmaps'))
const standardFontsDir = normalizePath(path.join(pdfjsDistPath, 'standard_fonts'))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: cMapsDir,
          dest: '',
        },
        {
          src: standardFontsDir,
          dest: '',
        },
      ],
    }),
  ],
  envPrefix: ['VITE_', 'APP_'],
})

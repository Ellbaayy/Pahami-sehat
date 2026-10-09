import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' supaya hasil build tetap jalan walau disajikan dari sub-folder
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // jangan inline font/logo — biar ukuran asset gampang dipantau
    assetsInlineLimit: 0,
  },
})

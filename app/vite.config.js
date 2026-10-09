import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base './' supaya hasil build tetap jalan walau disajikan dari sub-folder
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    // aplikasi dibangun ke dist/app/ supaya halaman penjelasan bisa menempati
    // root situs (dist/index.html) — jadi alamat pertama yang muncul adalah
    // halaman penjelasan, bukan aplikasi
    outDir: 'dist/app',
    emptyOutDir: true,
    // jangan inline font/logo — biar ukuran asset gampang dipantau
    assetsInlineLimit: 0,
  },
  server: {
    // saat `npm run dev`, /api diteruskan ke server Express (npm run server)
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
})

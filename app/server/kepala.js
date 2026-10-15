/**
 * Kepala keamanan dasar untuk semua respons — dipakai dua entry point
 * (server/index.js lokal & api/index.js Vercel) supaya perilakunya sama.
 *
 * Sengaja MINIMAL: tiga kepala yang tidak bisa merusak aplikasi.
 * Content-Security-Policy TIDAK dipasang di sini — salah tulis satu
 * direktif bisa mematikan peta, suara, atau OCR di produksi, dan itu
 * butuh pengujiannya sendiri sebelum lomba.
 *
 * Ditambahkan 15 Okt 2026 dari uji penetrasi putaran 2:
 * - X-Powered-By: Express bocor di semua respons (sekarang dimatikan)
 * - tanpa X-Content-Type-Options, peramban bisa menebak tipe berkas
 * - tanpa Referrer-Policy, URL penuh (termasuk ?paksa=rahasia kalau salah
 *   pakai) ikut terkirim ke situs luar saat pengguna mengklik tautan sumber
 */
export function pasangKepala(app) {
  // jangan bocorkan tumpukan server di setiap respons
  app.disable('x-powered-by')

  app.use((_req, res, next) => {
    // jangan biarkan peramban menebak tipe berkas — cegah MIME-sniffing
    res.set('X-Content-Type-Options', 'nosniff')
    // jangan kirim URL penuh ke situs luar saat pengguna mengklik tautan
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    next()
  })
}

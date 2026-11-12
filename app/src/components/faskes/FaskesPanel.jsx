/**
 * Halaman "Fasilitas Kesehatan".
 * ============================================================================
 *
 * SEJARAH SINGKAT — kenapa berkas ini sekarang hanya pembungkus
 * ------------------------------------------------------------
 * Sampai 8 Nov 2026 halaman ini punya dua tab: "Fasilitas Terdekat" (peta
 * radius memakai Overpass/OpenStreetMap) dan "Rumah Sakit Nasional" (3.325 RS
 * SIRS). Pemilik proyek memutuskan tab radius DIHAPUS dan tab nasional
 * DIPERLUAS menjadi seluruh fasilitas kesehatan yang kita punya (21.477 baris:
 * 3.325 rumah sakit Kemenkes + 18.152 fasilitas OpenStreetMap).
 *
 * Kode peta radius — `useFaskes`, `PetaFaskes`, `PanelNavigasi`, `InputLokasi`,
 * `useCariLokasi` — masih ada di repo, tetapi TIDAK dipakai halaman ini lagi.
 * Modul server `/api/faskes` (radius), `/api/faskes/cari-lokasi`, `/api/rute`,
 * dan `/api/wilayah/titik` juga tetap hidup: dipakai uji dan masih bisa
 * dihidupkan kembali tanpa menulis ulang apa pun.
 *
 * Halaman ini sengaja tipis supaya tidak ada dua tempat yang mengatur judul,
 * tab, dan isi secara bersamaan.
 */

import FaskesNasionalPanel from './FaskesNasionalPanel'

export default function FaskesPanel({ t = (k) => k }) {
  return (
    <section aria-labelledby="faskes-judul" className="space-y-2">
      <div className="rounded-2xl border border-line-200/80 bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(15,30,51,0.04),0_8px_24px_-16px_rgba(15,30,51,0.10)]">
        {/* H1 satu-satunya di halaman ini. */}
        <h1
          id="faskes-judul"
          className="text-[clamp(1.05rem,0.95rem+0.45vw,1.35rem)] font-bold tracking-tight text-navy-900"
        >
          {t('faskes.judul')}
        </h1>
        <p className="mt-1 max-w-3xl text-[0.8rem] leading-snug text-muted-600">{t('faskesNasional.catatanKepala')}</p>
      </div>

      <FaskesNasionalPanel t={t} />
    </section>
  )
}

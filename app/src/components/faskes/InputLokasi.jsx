/**
 * Pencarian lokasi dengan dua cara: ketik alamat, atau pilih wilayah.
 * ============================================================================
 *
 * KENAPA DUA METODE DIPISAH JELAS
 * -------------------------------
 * Setiap metode menghasilkan titik asal dengan sifat yang berbeda, dan
 * mencampurnya membuat pengguna tidak tahu apa yang sedang dipakai:
 *
 *   - **Ketik alamat** -> koordinat hasil geocoding. Akurat sampai tingkat
 *     bangunan/jalan kalau sumbernya tahu; kalau sumbernya hanya tahu kota,
 *     titiknya pusat kota dan itu disebut terbuka.
 *   - **Pilih wilayah** -> titik referensi wilayah. Itu PERKIRAAN, bukan
 *     lokasi presisi, dan labelnya harus mengatakan begitu.
 *
 * Mengganti metode MENGOSONGKAN titik dari metode sebelumnya. Tidak pernah ada
 * campuran "koordinat dari alamat + label dari wilayah".
 */

import { useEffect, useState } from 'react'
import { Search, MapPin, X, Loader2, TriangleAlert, Check, Map, Crosshair } from 'lucide-react'
import { useAlamat } from '../../lib/useAlamat'
import PemilihWilayah from './PemilihWilayah'

/**
 * Tampilan tombol metode lokasi (tata letak 5 Nov 2026).
 *
 * SATU konstanta untuk ketiganya supaya tidak pernah menyimpang: tiga tombol
 * yang dianggap setara harus terlihat PERSIS sama. Saat masih ditulis terpisah
 * per tombol, satu tombol sempat mendapat gaya sorotan dan dua lainnya tidak —
 * dan itulah yang terbaca sebagai "ada langkah yang belum dikerjakan".
 *
 * Tingginya `min-h-11` (44 px) — ambang target sentuh yang dipakai seluruh
 * aplikasi.
 */
const KELAS_TOMBOL_METODE =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line-200 bg-white px-3 text-[0.82rem] font-medium text-navy-700 transition hover:border-brand-300 hover:text-brand-800'

/** Nama tingkat ketepatan untuk ditampilkan apa adanya. */
const LABEL_KETEPATAN = {
  titik: 'ketepatan: titik/bangunan',
  jalan: 'ketepatan: jalan',
  kelurahan: 'ketepatan: kelurahan/desa',
  kecamatan: 'ketepatan: kecamatan',
  kabupaten: 'ketepatan: pusat kabupaten/kota',
  provinsi: 'ketepatan: pusat provinsi',
  lain: 'ketepatan: tidak diketahui',
}

/**
 * Baris pembeda: kota/kabupaten + provinsi, untuk kandidat yang namanya sama.
 *
 * Sumbernya `petunjukWilayah` (Photon) atau `wilayah` (Nominatim). Ini HANYA
 * untuk membedakan tampilan — bukan untuk deteksi wilayah resmi, karena
 * `state` Photon bukan nama provinsi resmi. Karena itu dipakai apa adanya
 * sebagai petunjuk, dan tidak disimpan sebagai identitas wilayah.
 */
function kotaPembeda(h) {
  const p = h?.petunjukWilayah ?? {}
  const w = h?.wilayah ?? {}
  const kota = p.kabupaten || w.kabupaten || p.kecamatan
  const prov = p.provinsi || w.provinsi
  const bagian = [kota, prov].filter(Boolean)
  // Hanya tampil kalau memang ada kota; kalau kosong, baris itu tidak berguna.
  return bagian.length ? bagian.join(' · ') : null
}

export default function InputLokasi({
  t = (k) => k,
  lokasi,
  statusLokasi,
  memuatTitik,
  onAlamat, // (hasilGeocoding) => void  — koordinat dari geocoding
  onWilayah, // (wilayah) => void        — titik referensi wilayah
  onGps,
  /*
   * Pencarian nama tempat + ringkasan status lokasi — pindahan dari `LokasiBar`
   * (5 Nov 2026). Komponen itu berdiri sebagai KARTU KEDUA tepat di bawah
   * kartu ini, padahal isinya masih bagian dari "menentukan lokasi": judulnya
   * pun "Lokasi belum diketahui" berikut kolom pencarian nama tempat. Di layar
   * itu terbaca sebagai dua kotak pencarian lokasi yang berdampingan, dan itulah
   * keluhan yang muncul saat tata letak baru dicoba.
   *
   * Sekarang isinya duduk di BAWAH garis pemisah di dalam kartu yang sama —
   * persis seperti desain yang disetujui (bagian kedua kartu yang dipisah
   * garis): di atas garis = cara memilih lokasi, di bawah garis = lokasi yang
   * sedang dipakai.
   */
  kueriLokasi = '',
  setKueriLokasi = () => {},
  cariLokasi = null,
  onPilihLokasi,
}) {
  const [metode, setMetode] = useState('alamat') // 'alamat' | 'wilayah'
  const a = useAlamat()
  /*
   * Sorotan keyboard untuk daftar saran.
   *
   * Perilaku yang ditiru dari Google Maps: panah bawah/atas memindahkan
   * sorotan, Enter memilih yang tersorot, Escape menutup daftar. Tanpa ini,
   * pengguna keyboard harus Tab melewati semua saran sebelum bisa memilih.
   */
  const [sorot, setSorot] = useState(-1)

  const wilayahDipilih = lokasi?.dari === 'wilayah' ? lokasi : null
  /*
   * Kotak "alamat terpilih" berlaku untuk hasil geocoding ('alamat').
   *
   * 'wilayah' TIDAK termasuk: titik itu ditampilkan oleh PemilihWilayah dengan
   * label perkiraannya sendiri, dan menampilkannya dua kali membuat pengguna
   * mengira ada dua lokasi berbeda.
   */
  const alamatDipilih = lokasi?.dari === 'alamat' ? lokasi : null

  const gantiMetode = (m) => {
    if (m === metode) return
    setMetode(m)
    // Titik dari metode lama DIBUANG, bukan disimpan diam-diam: kalau tidak,
    // pengguna pindah ke "pilih wilayah" tapi pencarian masih memakai
    // koordinat alamat sebelumnya.
    a.bersihkan()
    if (m === 'wilayah') onAlamat(null)
    else onWilayah(null)
  }

  // Sorotan direset setiap daftar saran berganti: menyisakan indeks lama akan
  // menunjuk baris yang sudah tidak ada.
  useEffect(() => {
    setSorot(-1)
  }, [a.saran])

  const pilihSaran = async (h) => {
    if (!h) return
    // `pilih` mengembalikan kandidat yang sudah dilengkapi wilayahnya (Photon
    // belum punya wilayah resmi). Tanpa menunggu, peta akan menerima
    // `wilayah.dikenal:false` padahal server sudah tahu jawabannya.
    const lengkap = await a.pilih(h)
    onAlamat(lengkap)
    setSorot(-1)
  }

  /**
   * Enter: pilih yang tersorot, atau ambil saran PERTAMA kalau belum ada
   * sorotan.
   *
   * Mengambil yang pertama saat Enter ditekan BUKAN "memilih otomatis" yang
   * dilarang: pengguna sendiri yang menekan Enter setelah melihat daftarnya.
   * Yang dilarang adalah memilih tanpa pengguna tahu — dan di sini daftarnya
   * terlihat di layar sebelum Enter ditekan.
   */
  const saatEnter = () => {
    if (a.saran.length) {
      pilihSaran(a.saran[sorot >= 0 ? sorot : 0])
    }
  }

  const saatTombol = (e) => {
    if (!a.saran.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSorot((i) => (i + 1) % a.saran.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSorot((i) => (i <= 0 ? a.saran.length - 1 : i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      saatEnter()
    } else if (e.key === 'Escape') {
      setSorot(-1)
      a.setKueri('')
    }
  }

  return (
    <section
      aria-labelledby="input-lokasi-judul"
      className="rounded-2xl border border-line-200/80 bg-white p-3 shadow-sm"
    >
      {/* Judul seksi. Dulu `sr-only`; sekarang TAMPIL karena tata letak
          mengikuti desain yang disetujui (5 Nov 2026): setiap bagian kartu
          punya judul yang terlihat, sehingga pengguna tahu sedang mengisi
          apa. `h2` tetap, karena `h1` halaman sudah dipakai panel fitur. */}
      <h2 id="input-lokasi-judul" className="text-[1.05rem] font-bold tracking-tight text-navy-900">
        {t('lokasi.cariJudul')}
      </h2>

      {/* METODE 1: ketik alamat ---------------------------------------- */}
      {metode === 'alamat' ? (
        <div className="mt-2.5">
          <label htmlFor="input-alamat" className="sr-only">
            {t('lokasi.labelAlamat')}
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-400"
              aria-hidden="true"
            />
            <input
              id="input-alamat"
              type="search"
              value={a.kueri}
              onChange={(e) => a.setKueri(e.target.value)}
              onKeyDown={saatTombol}
              role="combobox"
              aria-autocomplete="list"
              aria-controls="alamat-saran"
              aria-activedescendant={sorot >= 0 ? `saran-${sorot}` : undefined}
              placeholder={t('lokasi.placeholder')}
              autoComplete="off"
              aria-describedby="alamat-bantuan"
              aria-expanded={a.saran.length > 0}
              className="min-h-11 w-full rounded-xl border border-line-300 bg-white pl-10 pr-10 text-[0.88rem] text-navy-900 placeholder:text-muted-400"
            />
            {a.memuat ? (
              <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-400" aria-hidden="true" />
            ) : a.kueri ? (
              <button
                type="button"
                onClick={() => a.setKueri('')}
                aria-label={t('lokasi.hapus')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-400 hover:text-navy-700"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          {/*
           * TOMBOL + CONTOH HANYA MUNCUL SAAT DIBUTUHKAN (disunting 5 Nov 2026).
           *
           * Sebelumnya keduanya selalu tampil. Akibatnya, sebelum pengguna
           * mengetik apa pun, kartu ini sudah berisi dua baris tambahan:
           * tombol "Cari Lokasi" yang MATI (dimatikan karena kueri < 3 huruf)
           * dan satu kalimat contoh yang panjang. Di layar itu terbaca sebagai
           * dua tombol abu-abu berdempet di bawah kolom isian — padahal
           * pengguna belum sampai ke langkah mencari.
           *
           * Sekarang keduanya muncul begitu pengguna mulai mengetik. Saat
           * kolom kosong, kartu hanya berisi judul, kolom isian, dan tiga
           * tombol metode — persis seperti desain.
           *
           * Kontras tetap dijaga: tombol abu-abu yang mati hanya terbaca
           * sebagai "belum bisa dipakai" karena ADA di samping kolom yang
           * terisi. Tanpa itu, ia terbaca sebagai tombol rusak.
           */}
          {a.kueri.trim() ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => (a.saran.length ? pilihSaran(a.saran[sorot >= 0 ? sorot : 0]) : a.setKueri(a.kueri))}
                disabled={a.kueri.trim().length < 3 || a.memuat}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-brand-700 px-2.5 text-[0.78rem] font-semibold text-white disabled:bg-surface-200 disabled:text-muted-400"
              >
                <Search className="size-3.5" aria-hidden="true" />
                {t('lokasi.tombolCari')}
              </button>
              <p id="alamat-bantuan" className="text-[0.72rem] leading-snug text-muted-500">
                {t('lokasi.contohAlamat')}
              </p>
            </div>
          ) : null}

          {/* Saran ---------------------------------------------------- */}
          {a.saran.length > 0 ? (
            <div className="mt-1.5">
              {a.perluPilih ? (
                <p className="mb-1 flex items-center gap-1 text-[0.74rem] font-medium text-amber-800">
                  <TriangleAlert className="size-3.5" aria-hidden="true" />
                  {t('lokasi.pilihSalahSatu')}
                </p>
              ) : null}
              <ul
                id="alamat-saran"
                role="listbox"
                className="max-h-56 divide-y divide-line-200 overflow-y-auto rounded-lg border border-line-200 bg-white"
              >
                {a.saran.map((h, i) => {
                  const w = h.wilayah ?? {}
                  return (
                    <li
                      key={`${h.lat}-${h.lon}-${i}`}
                      id={`saran-${i}`}
                      role="option"
                      aria-selected={i === sorot}
                      className={i === sorot ? 'bg-brand-50' : undefined}
                    >
                      <button
                        type="button"
                        onClick={() => pilihSaran(h)}
                        className="flex w-full items-start gap-2 px-2.5 py-2 text-left hover:bg-surface-50"
                      >
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand-600" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block truncate text-[0.83rem] font-semibold text-navy-900">{h.nama}</span>
                          {/*
                           * PEMBEDA KOTA DIPISAH DAN DITEBALKAN.
                           *
                           * "Malioboro" ada di Surabaya DAN di Yogyakarta; nama
                           * jalan "Jalan Malioboro" ada di Jakarta, Balikpapan,
                           * Serbelawan, dan Yogyakarta. Kalau kota hanya
                           * tercantum di tengah alamat panjang, pengguna harus
                           * membaca kalimat penuh untuk membedakannya — dan pada
                           * uji nyata, yang terpilih justru Malioboro Surabaya.
                           *
                           * Baris ini menaruh kota di depan, sebelum alamat
                           * lengkap, supaya dua kandidat yang namanya sama
                           * langsung terlihat berbeda.
                           */}
                          {kotaPembeda(h) ? (
                            <span className="block text-[0.75rem] font-medium text-brand-800">
                              {kotaPembeda(h)}
                            </span>
                          ) : null}
                          <span className="block text-[0.74rem] leading-snug text-muted-500">{h.alamat}</span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[0.71rem] text-muted-500">
                            {/* Wilayah ditampilkan SEBELUM pencarian dijalankan,
                                sesuai permintaan: pengguna melihat apa yang
                                dikenali sumber, bukan setelah menunggu. */}
                            {w.kecamatan ? <span>{w.kecamatan}</span> : null}
                            {w.kabupaten ? <span>· {w.kabupaten}</span> : null}
                            {w.provinsi ? <span>· {w.provinsi}</span> : null}
                            {/*
                              * Petunjuk kota di atas berasal dari Photon dan
                              * hanya untuk MEMBEDAKAN kandidat. Wilayah resmi
                              * (kode BPS) baru diambil setelah pengguna memilih.
                              *
                              * Karena itu kalimatnya "wilayah resmi menyusul",
                              * BUKAN "wilayah tidak dikenali" — yang terakhir
                              * terbaca seolah sistem gagal, padahal kotanya
                              * sudah terlihat jelas di baris atas.
                              */}
                            {!w.dikenal ? (
                              <span className="text-muted-400">· {t('lokasi.wilayahResmiMenyusul')}</span>
                            ) : null}
                            <span className="text-muted-400">· {LABEL_KETEPATAN[h.ketepatan] ?? h.ketepatan}</span>
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}

          {/* Galat layanan vs tidak ditemukan: dua hal berbeda --------- */}
          {a.galat ? (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[0.76rem] leading-snug text-amber-900">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {a.galat.code === 'kuota'
                ? t('lokasi.kuota')
                : a.galat.code === 'layanan_gagal' || a.galat.code === 'jaringan'
                  ? t('lokasi.layananMati')
                  : t('lokasi.tidakDitemukan')}
            </p>
          ) : null}

          {/* Titik yang sudah dipilih -------------------------------- */}
          {alamatDipilih ? (
            <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2">
              <p className="flex items-start gap-1.5 text-[0.8rem] font-semibold text-emerald-900">
                <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  {alamatDipilih.label || t('lokasi.alamatTerpilih')}
                </span>
              </p>
              <p className="mt-0.5 pl-5 text-[0.74rem] leading-snug text-emerald-800">
                {alamatDipilih.lat.toFixed(5)}, {alamatDipilih.lon.toFixed(5)}
                {alamatDipilih.ketepatanText ? ` · ${alamatDipilih.ketepatanText}` : null}
              </p>
              <WilayahTerdeteksi t={t} wilayah={alamatDipilih.wilayah} />
            </div>
          ) : null}
        </div>
      ) : null}

      {/* METODE 2: pilih wilayah ---------------------------------------- */}
      {metode === 'wilayah' ? (
        <div className="mt-2">
          <PemilihWilayah
            t={t}
            lokasiAktif={wilayahDipilih?.label ?? null}
            statusLokasi={statusLokasi}
            memuatTitik={memuatTitik}
            presisi={wilayahDipilih?.presisi ?? null}
            onGps={onGps}
            onPilih={onWilayah}
          />
          {/* Sifat titik wilayah disebut terbuka: ini PERKIRAAN. */}
          <p className="mt-1 flex items-start gap-1.5 text-[0.73rem] leading-snug text-amber-800">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t('lokasi.wilayahPerkiraan')}
          </p>
        </div>
      ) : null}

      {/*
       * DUA TOMBOL METODE — di BAWAH kolom isian.
       *
       * Tombol "Pilih di Peta" (klik peta untuk menentukan titik) DIHAPUS
       * 5 Nov 2026 atas permintaan pengguna. Yang tersisa adalah dua cara yang
       * tetap berjalan tanpa bergantung pada klik di peta: ketik alamat dan
       * pilih wilayah.
       *
       * KEDUA TOMBOLNYA SENGAJA TERLIHAT SAMA (5 Nov 2026).
       * Versi pertama tata letak ini memberi sorotan penuh pada tombol yang
       * "sedang aktif" — akibatnya "Ketik Alamat" selalu terlihat terpilih
       * walaupun belum ada yang menyentuhnya, sehingga pengguna mengira ada
       * langkah tambahan yang tertinggal. Sekarang tidak ada yang disorot;
       * tombol hanya BERTINDAK. Status "mode wilayah sedang terbuka" tetap
       * terlihat dari isi kartu di bawahnya (pemilih wilayah tampil), bukan
       * dari warna tombol.
       *
       * Perilaku `gantiMetode` TIDAK DIUBAH: titik dari metode sebelumnya
       * tetap dibuang, karena mencampur "koordinat dari alamat" dengan "label
       * dari wilayah" adalah kesalahan yang sudah pernah terjadi.
       */}
      <p className="mt-2 text-[0.8rem] text-muted-500">{t('lokasi.metodeLain')}</p>
      <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="group" aria-label={t('lokasi.metodeLain')}>
        {/* 1. Ketik alamat — juga jalan kembali dari mode wilayah. */}
        <button
          type="button"
          aria-pressed={metode === 'alamat'}
          onClick={() => gantiMetode('alamat')}
          className={KELAS_TOMBOL_METODE}
        >
          <Search className="size-4" aria-hidden="true" />
          {t('lokasi.ketikAlamat')}
        </button>

        {/*
         * 2. PILIH WILAYAH — DAN GPS, PADA TOMBOL YANG SAMA.
         *
         * GPS dulu punya tombol sendiri di kanan atas dan satu tautan kecil di
         * bawah. Keduanya dibuang (5 Nov 2026) karena merangsang salah paham:
         *   - Tombol "Pakai GPS" duplikat dengan "Izinkan akses lokasi" yang
         *     SUDAH ada di baris ringkasan lokasi tepat di bawah kartu ini.
         *     Dua tombol untuk satu tindakan yang sama.
         *   - Tautan kecil "Pakai GPS" di bawah tombol metode terbaca sebagai
         *     catatan kaki, bukan sebagai cara memilih lokasi.
         *
         * Perilaku: satu klik membuka pemilih wilayah (seperti sebelumnya).
         * GPS tetap tersedia di dalam panel wilayah, di baris ringkasan lokasi,
         * dan di header. Yang hilang hanya DUPLIKAT tombolnya — bukan
         * kemampuannya. Desain yang disetujui pun tidak punya tombol GPS
         * terpisah, jadi ini yang paling dekat dengan desain tanpa mencabut
         * jalan pintas yang berguna.
         */}
        <button
          type="button"
          aria-pressed={metode === 'wilayah'}
          onClick={() => gantiMetode('wilayah')}
          className={KELAS_TOMBOL_METODE}
        >
          <Map className="size-4" aria-hidden="true" />
          {t('lokasi.pilihWilayah')}
        </button>
      </div>

      <StatusLokasi
        t={t}
        lokasi={lokasi}
        statusLokasi={statusLokasi}
        onMinta={onGps}
        kueriLokasi={kueriLokasi}
        setKueriLokasi={setKueriLokasi}
        cariLokasi={cariLokasi}
        onPilihLokasi={onPilihLokasi}
      />
    </section>
  )
}

/**
 * Ringkasan lokasi yang sedang dipakai + pencarian nama tempat.
 *
 * DIPISAH DENGAN GARIS, bukan kartu sendiri (diubah 5 Nov 2026 — isinya
 * pindahan dari `LokasiBar`). Garis pemisah itu punya makna: di atasnya
 * adalah CARA menentukan lokasi, di bawahnya adalah lokasi YANG SUDAH
 * ditentukan.
 *
 * Dua lapis pencarian tetap ada dan tetap berbeda fungsinya:
 *   - kolom "Cari lokasi Anda" di atas -> geocoding alamat (Photon/Nominatim),
 *     hasilnya kaya wilayah resmi dan ketepatan titik;
 *   - kolom "Cari nama tempat, jalan…" di sini -> pencarian nama tempat
 *     (`/api/faskes/cari-lokasi`, Nominatim) yang hasilnya hanya nama + alamat.
 * Penggabungan keduanya menjadi satu kolom akan MENGHAPUS fungsi, bukan
 * menyederhanakan: pencarian nama tempat hanya mencari, sedangkan kolom atas
 * juga dipakai untuk menormalkan wilayah dan ketepatan.
 *
 * JIKA `cariLokasi` TIDAK DIOPER (pemakaian komponen di tempat lain), blok
 * bawah garis hanya menampilkan ringkasan status — tidak ada kolom kosong yang
 * tidak berfungsi.
 */
function StatusLokasi({ t, lokasi, statusLokasi, onMinta, kueriLokasi, setKueriLokasi, cariLokasi, onPilihLokasi }) {
  const pesan =
    statusLokasi === 'ditolak'
      ? t('faskes.gpsDitolak')
      : statusLokasi === 'takdidukung'
        ? t('faskes.gpsTakDidukung')
        : statusLokasi === 'galat'
          ? t('faskes.gpsGalat')
          : null

  return (
    <div className="mt-2 border-t border-line-200 pt-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-1.5 text-[0.84rem] font-semibold text-navy-800">
          <MapPin className="size-4 text-brand-700" aria-hidden="true" />
          {lokasi ? lokasi.label ?? t('faskes.lokasiTerdeteksi') : t('faskes.lokasiBelum')}
        </span>
        {lokasi ? (
          <span className="font-mono text-[0.76rem] text-muted-500">
            {lokasi.lat.toFixed(5)}, {lokasi.lon.toFixed(5)}
            {lokasi.dari === 'gps' ? ` · ${t('faskes.dariGps')}` : ''}
          </span>
        ) : (
          <button
            type="button"
            onClick={onMinta}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-[0.82rem] font-semibold text-white hover:bg-brand-700"
          >
            <Crosshair className="size-3.5" aria-hidden="true" />
            {t('faskes.izinkanLokasi')}
          </button>
        )}
      </div>

      {pesan ? (
        <p className="mt-2 flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[0.8rem] leading-snug text-navy-800">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          {pesan}
        </p>
      ) : null}

      {cariLokasi ? (
        <>
          <form
            className="mt-1.5 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              cariLokasi.cari(kueriLokasi)
            }}
          >
            <label htmlFor="cari-lokasi" className="sr-only">
              {t('faskes.cariLokasiLabel')}
            </label>
            <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl border border-line-200 bg-surface-100 px-3">
              <Search className="size-4 shrink-0 text-muted-400" aria-hidden="true" />
              <input
                id="cari-lokasi"
                value={kueriLokasi}
                onChange={(e) => setKueriLokasi(e.target.value)}
                placeholder={t('faskes.cariLokasi')}
                className="min-h-11 w-full bg-transparent text-[0.86rem] text-navy-900 outline-none placeholder:text-muted-400"
              />
            </div>
            <button
              type="submit"
              className="min-h-11 rounded-xl border border-line-200 bg-white px-3 text-[0.84rem] font-semibold text-navy-800 hover:border-brand-300 hover:text-brand-800"
            >
              {t('faskes.cari')}
            </button>
          </form>

          {cariLokasi.memuat ? (
            <p className="mt-2 inline-flex items-center gap-1.5 text-[0.8rem] text-muted-500">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {t('faskes.mencariLokasi')}
            </p>
          ) : null}
          {cariLokasi.galat === 'tidak_ditemukan' ? (
            <p className="mt-2 text-[0.8rem] text-muted-500">{t('faskes.lokasiTidakDitemukan')}</p>
          ) : null}
          {cariLokasi.galat === 'jaringan' || cariLokasi.galat === 'lokasi_gagal' ? (
            <p className="mt-2 text-[0.8rem] text-amber-700">{t('faskes.lokasiGalatCari')}</p>
          ) : null}

          {cariLokasi.hasil.length ? (
            <ul className="mt-2 divide-y divide-line-200 overflow-hidden rounded-xl border border-line-200">
              {cariLokasi.hasil.map((h) => (
                <li key={`${h.lat},${h.lon}`}>
                  <button
                    type="button"
                    onClick={() => onPilihLokasi?.(h)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-100"
                  >
                    <MapPin className="mt-0.5 size-3.5 shrink-0 text-brand-700" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[0.85rem] font-semibold text-navy-900">{h.nama}</span>
                      <span className="block truncate text-[0.76rem] text-muted-500">{h.alamat}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

/** Tampilkan wilayah yang berhasil dikenali, APA ADANYA. */
function WilayahTerdeteksi({ t, wilayah }) {
  const w = wilayah ?? {}
  const baris = [
    ['Provinsi', w.provinsi],
    ['Kabupaten/Kota', w.kabupaten],
    ['Kecamatan', w.kecamatan],
    ['Kelurahan/Desa', w.kelurahan],
  ].filter(([, v]) => v)

  if (!w.dikenal) {
    return (
      <p className="mt-1 flex items-start gap-1.5 rounded-md bg-amber-100/70 px-2 py-1 text-[0.73rem] leading-snug text-amber-900">
        <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
        {t('lokasi.wilayahTidakDikenalPanjang')}
      </p>
    )
  }

  return (
    <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 pl-5 text-[0.73rem] leading-snug text-emerald-900">
      {baris.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-emerald-700">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </div>
      ))}
      {/* Kecamatan kosong BUKAN kelalaian: sumbernya memang tidak memberi
          kecamatan untuk titik ini. Mengosongkan barisnya lebih jujur daripada
          mengisinya dengan nama kabupaten. */}
      {!w.kecamatan ? (
        <div className="contents">
          <dt className="font-medium text-emerald-700">Kecamatan</dt>
          <dd className="text-emerald-700/80">{t('lokasi.tidakDiketahui')}</dd>
        </div>
      ) : null}
    </dl>
  )
}

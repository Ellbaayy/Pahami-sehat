/**
 * Rute API Pahami Sehat — dipakai DUA tempat:
 *   1. server lokal  (server/index.js)  — untuk dev & Grand Final
 *   2. serverless    (api/index.js)     — untuk deploy di Vercel
 *
 * Semua logika endpoint ada di sini supaya kedua jalur berperilaku sama persis.
 * Endpoint:
 *   GET  /api/health
 *   GET  /api/meta
 *   POST /api/tanya            { pertanyaan, tingkat }
 *   POST /api/tanya/stream     { pertanyaan, tingkat }   (SSE)
 *   POST /api/sederhanakan     { teks, tingkat }
 *   POST /api/verifikasi       { klaim, tingkat }
 */

import { Router } from 'express'

import { config, safeInfo } from './config.js'
import { KenariError, chat, chatStream, cekSehat } from './kenari.js'
import { buatEkstrak } from './ekstrak.js'
import { buatSuara, tentukanBahasa, pilihSuara, daftarSuara, BAHASA_SUARA, JENIS_SUARA } from './suara.js'
import {
  TINGKAT,
  TINGKAT_DEFAULT,
  deteksiSantai,
  promptBerita,
  // `promptTanya`/`promptSederhanakan`/`promptVerifikasi` (tanpa sumber) TIDAK
  // diimpor: seluruh jalur jawaban di rute ini memakai versi `...DenganCari`,
  // karena jawaban tanpa sumber tidak boleh dikirim ke pengguna. Versi tanpa
  // sumber tetap diekspor prompts.js untuk dipakai uji prompt langsung.
  promptSantai,
  promptTanyaDenganCari,
  promptSederhanakanDenganCari,
  promptVerifikasiDenganCari,
  pertanyaanLanjutan,
} from './prompts.js'
import { ambilBeritaKesehatan, menanyakanBerita, ringkasanBerita, jawabanBeritaDarurat } from './berita.js'
import { saringKlaimTanpaSumber, teksSumber } from './klaim.js'
import { cariInternet } from './cari.js'
import { kataKunciPencarian, istilahKesehatan, PETA_MEDLINEPLUS, PETA_MEDLINEPLUS_BIDANG } from './kataKunci.js'
import { batasi } from './batas.js'
import {
  LAJU,
  MAKS_SEDERHANAKAN,
  MAKS_SUARA,
  MAKS_TANYA,
  MAKS_TOKEN,
  MAKS_VERIFIKASI,
  anggaranBerikutnya,
  SIMPANAN_HEALTH_MS,
  teksDari,
} from './batasInput.js'
import { kontenHarianLengkap } from './konten.js'
import { faskesSekitar, daftarKategori, jarakMeter } from './faskes.js'
import { ambilWilayah, cascadeTitik, titikNama, kodeSah, tingkatDariKode } from './wilayah.js'
import { fasilitasSekitarDb, simpanBanyak, ambilFasilitas, cakupanInfo, catatCakupan } from './faskesDb.js'
import { ambilRute, tautanGoogleMaps, COSTING } from './rute-perjalanan.js'
import { cariRsSirs, rsSirsMenurutKode, pilihanFilterSirs, ringkasanSirs } from './rsSirs.js'
import {
  keteranganDb,
  ambilBerita,
  hitungBeritaSegar,
  ambilKonten,
  ambilPengetahuan,
  catatSumberDikutip,
  simpanGiliran,
  ambilGiliran,
  tanya,
} from './db.js'
import { bahasaJawaban } from './bahasa.js'
import { ringkasanStatistik } from './statistikFaskes.js'

/* ---------------------------------------------------------------- util ---- */

/** Ambil JSON dari balasan model, tahan terhadap pagar kode & teks tambahan. */
function ambilJson(teks) {
  if (!teks) return null
  let s = teks.trim()
  // buang pagar kode ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const awal = s.indexOf('{')
  const akhir = s.lastIndexOf('}')
  if (awal === -1 || akhir === -1 || akhir < awal) return null
  try {
    return JSON.parse(s.slice(awal, akhir + 1))
  } catch {
    return null
  }
}

function rapikanTingkat(v) {
  const k = String(v ?? '').trim().toLowerCase()
  return TINGKAT[k] ? k : TINGKAT_DEFAULT
}

/** Normalisasi hasil model jadi bentuk yang dipakai frontend. */
function bentukHasil(mentah, tingkat, { verdictKey = null } = {}) {
  const t = TINGKAT[tingkat]
  if (!mentah) {
    return {
      ok: false,
      code: 'unparsed',
      pesan: 'Model tidak mengembalikan JSON yang bisa dibaca. Coba lagi.',
      jawaban: '',
      poinKunci: [],
      sumber: [],
      tingkat: { kunci: tingkat, label: t.label, usia: t.usia },
    }
  }
  const sumber = Array.isArray(mentah.sumber)
    ? mentah.sumber
        .filter((s) => s && (s.judul || s.penerbit || s.url))
        .map((s) => ({
          judul: String(s.judul ?? '').trim(),
          penerbit: String(s.penerbit ?? '').trim(),
          // hanya terima URL http(s) — jangan biarkan model menyelipkan skema lain
          url: /^https?:\/\//i.test(String(s.url ?? '')) ? String(s.url).trim() : '',
        }))
    : []

  const out = {
    ok: true,
    jawaban: String(mentah.jawaban ?? '').trim(),
    poinKunci: Array.isArray(mentah.poin_kunci) ? mentah.poin_kunci.map((p) => String(p).trim()).filter(Boolean) : [],
    sumber,
    catatan: String(mentah.catatan ?? '').trim(),
    tingkat: { kunci: tingkat, label: t.label, usia: t.usia },
  }
  if (verdictKey) out.verdict = String(mentah[verdictKey] ?? 'tidak_bisa_dipastikan').trim()
  return out
}

/** Bahasa jawaban: 'id' (default) atau 'en'. */
function rapikanBahasa(v) {
  return String(v ?? '').toLowerCase().startsWith('en') ? 'en' : 'id'
}

/**
 * Rapikan penanda sesi percakapan.
 *
 * Batasnya 64 karakter (sama dengan lebar kolom `id_sesi`) dan hanya huruf,
 * angka, titik dua, garis bawah, serta tanda hubung. Penanda ini dibuat
 * peramban pengguna, jadi bentuknya diperiksa — bukan dipercaya begitu saja.
 *
 * @param {unknown} v
 * @returns {string} penanda yang sah, atau '' kalau tidak ada/tidak sah
 */
function rapikanSesi(v) {
  const s = String(v ?? '').trim()
  if (!s || s.length > 64) return ''
  return /^[A-Za-z0-9_:.-]+$/.test(s) ? s : ''
}

/**
 * Terapkan penyaring klaim ke sebuah hasil jawaban.
 *
 * ============================================================================
 * KENAPA DI SINI, BUKAN DI PROMPT
 * ============================================================================
 * Diukur 22 Okt 2026: model menulis "banyak orang dengan satu ginjal tetap
 * hidup normal" padahal tidak satu pun sumber memuatnya, lalu menyebutnya di
 * `catatan` seolah sudah jujur. Aturan prompt sudah dipertegas dan putaran
 * berikutnya melanggar lagi — jadi pengamannya dipindah ke kode, tempat ia
 * tidak bisa "lupa".
 *
 * Yang dibuang HANYA klaim prognosis yang tidak punya dasar (lihat klaim.js).
 * Kalau ada yang dibuang, `catatan` ikut menyebutkannya — pengguna berhak tahu
 * bahwa sebagian jawaban dibuang, bukan menerima jawaban yang tampak utuh.
 *
 * Tidak pernah melempar: penyaring yang gagal tidak boleh menghilangkan
 * jawaban yang sudah benar.
 *
 * @param {object} out - hasil bentukHasil()
 * @param {Array<object>} hasilCari
 * @returns {object} hasil yang sama, mungkin dengan jawaban yang disaring
 */
function saringHasil(out, hasilCari) {
  if (!out?.ok || !out.jawaban) return out
  try {
    const r = saringKlaimTanpaSumber(out.jawaban, teksSumber(hasilCari))
    if (!r.dibuang.length) return out
    const catatanTambahan =
      'Sebagian jawaban dihapus karena menyatakan prognosis yang tidak ada di sumber.'
    return {
      ...out,
      jawaban: r.jawaban,
      catatan: out.catatan ? `${out.catatan} ${catatanTambahan}` : catatanTambahan,
    }
  } catch {
    return out
  }
}

/**
 * Minta jawaban JSON dari model, ULANGI SEKALI kalau balasannya tak terbaca.
 *
 * KENAPA PERLU: `bentukHasil(null)` mengembalikan `ok:false` dengan `jawaban`
 * KOSONG — pengguna melihat gelembung hampa tanpa penjelasan. Satu percobaan
 * ulang jauh lebih murah daripada satu jawaban kosong.
 *
 * `jalur` hanya untuk LOG, dan wajib diisi pemanggil ("berita", "verifikasi",
 * …). Alasannya nyata (diukur 5 Nov 2026): `/api/verifikasi` sekali menjawab
 * `unparsed` padahal empat percobaan berikutnya dengan klaim yang SAMA berhasil.
 * Saat kejadian itu terjadi, log server TIDAK mencatat apa pun — jadi satu-
 * satunya cara menemukan sebabnya adalah menebak dan mengulang manual. Dengan
 * `finish_reason` dan potongan jawaban mentah di log, penyebabnya langsung
 * terlihat: `length` berarti jatah token habis (angka di batasInput.js perlu
 * diukur ulang), selain itu berarti model memang menulis teks di luar JSON.
 * Log TIDAK memuat pertanyaan pengguna — hanya potongan jawaban model.
 *
 * @returns {Promise<{json: object|null, usage: object|null, mentah: string}>}
 */
async function mintaJson({ messages, maxTokens, coba = 2, jalur = 'tidak-diketahui' }) {
  let usage = null
  let mentah = ''
  let selesai = null
  // Anggaran token yang boleh NAIK antar percobaan — lihat anggaranBerikutnya().
  let anggaran = maxTokens
  for (let i = 0; i < coba; i++) {
    let h
    try {
      h = await chat({
        messages:
          i === 0
            ? messages
            : [
                ...messages,
                {
                  role: 'system',
                  content:
                    'Balasan sebelumnya tidak bisa dibaca sebagai JSON. Balas ULANG sekarang: ' +
                    'HANYA satu objek JSON valid, tanpa rencana, tanpa penjelasan, tanpa pagar kode.',
                },
              ],
        ...(anggaran ? { maxTokens: anggaran } : {}),
      })
    } catch (e) {
      /*
       * GALAT JARINGAN / BATAS WAKTU DIULANG SEKALI.
       *
       * Diukur 8 Nov 2026: dua pertanyaan dari 25 gagal HTTP 500 karena
       * panggilan model melewati batas 50 detik (`DOMException TimeoutError`).
       * Satu percobaan ulang jauh lebih murah daripada membuat pengguna
       * menekan tombol lagi — dan jauh lebih baik daripada layar "kesalahan
       * server" di depan juri. Galat 4xx (kunci salah, kuota habis) TIDAK
       * diulang: mengulanginya tidak akan berubah hasilnya.
       */
      const status = Number(e?.status ?? 0)
      if (i + 1 < coba && (status === 0 || status >= 500)) continue
      throw e
    }
    usage = h.usage ?? usage
    mentah = h.text
    selesai = h.finish ?? null
    const json = ambilJson(h.text)
    if (json) return { json, usage, mentah: h.text }

    /*
     * TERPOTONG BUKAN SAMA DENGAN TIDAK BISA DIBACA.
     *
     * `finish_reason: length` berarti model kehabisan jatah token — sering
     * karena ia menulis kalimat penalaran lebih dulu. Mengulang dengan jatah
     * yang sama akan berhenti di tempat yang sama, jadi percobaan berikutnya
     * diberi jatah lebih besar.
     */
    const naik = anggaranBerikutnya(anggaran, selesai)
    if (naik) anggaran = naik
  }
  // Tidak terbaca SETELAH semua percobaan. Selalu dicatat: tanpa ini, satu-
  // satunya jejaknya adalah pesan "Model tidak mengembalikan JSON" di layar.
  console.warn(
    `[mintaJson] ${jalur}: balasan tak terbaca setelah ${coba} percobaan` +
      ` | finish_reason=${selesai ?? 'tidak ada'}` +
      ` | token_keluar=${usage?.completion_tokens ?? '?'}` +
      ` | panjang=${mentah.length}` +
      ` | awal=${JSON.stringify(mentah.slice(0, 160))}`,
  )
  return { json: null, usage, mentah }
}

/**
 * Jawaban berita DARURAT ada di `berita.js` (`jawabanBeritaDarurat`) supaya
 * bisa diuji tanpa server — lihat `uji-berita.mjs`.
 */

/**
 * Bahasa jawaban: ikuti bahasa pesan pengguna; kalau pesannya terlalu
 * pendek/netral untuk dipastikan, baru pakai bahasa antarmuka.
 */
function pilihBahasa(pesan, bahasaUi) {
  const b = bahasaJawaban(pesan, bahasaUi)
  return { nama: b.nama, kodeAsal: b.dariPesan ? 'pesan' : null, kode: b.kode }
}

/**
 * Ringkas daftar hasil pencarian untuk dikirim ke frontend (tanpa isi panjang).
 *
 * Hasil web dan pengetahuan tersimpan diberi jatah masing-masing. Sebelumnya
 * hanya `slice(0, 8)` polos — akibatnya kalau hasil web sudah 8, entri dari
 * database TIDAK PERNAH terlihat di antarmuka walaupun model tetap memakainya.
 */
function ringkasHasilCari(hasil = []) {
  const bentuk = (h) => ({
    judul: String(h.judul ?? '').slice(0, 160),
    url: /^https?:\/\//i.test(String(h.url ?? '')) ? h.url : '',
    resmi: Boolean(h.resmi),
    tersimpan: Boolean(h.tersimpan),
  })
  const web = hasil.filter((h) => !h.tersimpan).slice(0, 6).map(bentuk)
  const simpanan = hasil.filter((h) => h.tersimpan).slice(0, 2).map(bentuk)
  return [...web, ...simpanan]
}

/**
 * Ringkas daftar berita untuk dikirim ke frontend.
 * Berbeda dari ringkasHasilCari: berita punya sumber (nama media) dan tanggal,
 * dan link Google News ditandai karena tidak bisa dibuka dari server.
 */
function ringkasBerita(berita = []) {
  return berita.map((b) => ({
    judul: String(b.judul ?? '').slice(0, 160),
    url: /^https?:\/\//i.test(String(b.link ?? '')) ? b.link : '',
    sumber: String(b.sumber ?? ''),
    tanggal: String(b.tanggal ?? ''),
    umurHari: b.umurHari ?? null,
    linkTidakBisaDibuka: Boolean(b.linkTidakBisaDibuka),
  }))
}

/**
 * Ambil konteks percakapan untuk sebuah permintaan.
 *
 * ============================================================================
 * KENAPA TIDAK PERNAH MELEMPAR GALAT
 * ============================================================================
 * Database OPSIONAL (lihat db.js). Kalau ia mati, fungsi ini mengembalikan
 * riwayat kosong dan aplikasi menjawab seperti sebelum fitur ini ada.
 * Konteks yang hilang membuat jawaban kurang nyambung — BUKAN membuat
 * pengguna menerima galat. Jangan mengubah sifat ini.
 *
 * @param {string} idSesi
 * @returns {Promise<Array<{peran:string, teks:string}>>}
 */
async function konteksSesi(idSesi) {
  if (!idSesi) return []
  try {
    return await ambilGiliran(idSesi)
  } catch {
    return []
  }
}

/**
 * Simpan giliran ke database — tanpa pernah menahan respons.
 *
 * Sengaja TIDAK di-`await` di jalur respons: penyimpanan konteks bukan
 * bagian dari jawaban, dan pengguna tidak boleh menunggu lebih lama hanya
 * karena database lambat. Kegagalannya juga tidak boleh terlihat.
 *
 * @param {string} idSesi
 * @param {'pengguna'|'aplikasi'} peran
 * @param {string} teks
 */
function catatKonteks(idSesi, peran, teks) {
  if (!idSesi || !teks) return
  simpanGiliran({ idSesi, peran, teks }).catch(() => null)
}

/**
 * Topik yang sedang berjalan di percakapan — dipakai sebagai bahan pencarian
 * saat pertanyaannya tidak menyebut topiknya sendiri.
 *
 * Diambil dari giliran PENGGUNA terakhir yang MENYEBUT istilah kesehatan,
 * bukan dari jawaban aplikasi: jawaban panjang memuat banyak istilah, dan
 * memakainya sebagai kata kunci cenderung melebar ke topik lain.
 *
 * @param {Array<{peran:string, teks:string}>} riwayat
 * @returns {string} teks pertanyaan bertopik terakhir, atau ''
 */
function topikTerakhir(riwayat = []) {
  for (let i = riwayat.length - 1; i >= 0; i--) {
    const g = riwayat[i]
    if (g?.peran !== 'pengguna') continue
    try {
      if (istilahKesehatan(g.teks)) return g.teks
    } catch {
      /* riwayat rusak tidak boleh menghentikan jawaban */
    }
  }
  return ''
}

/**
 * Cari sumber untuk sebuah pertanyaan.
 *
 * Bahan pencariannya dipilih oleh kataKunci.js — SATU tempat untuk seluruh
 * aturan (kata ganti orang, pemetaan kata keluhan, istilah kesehatan).
 *
 * Kalimat pengguna TIDAK lagi dipakai sebagai kandidat pencarian. Dulu itu
 * dilakukan sebagai cadangan, dan hasilnya selalu artikel yang tidak nyambung:
 * "...saya sering merasa lemas" menghasilkan "Arjuna" dan "Hantu Longga",
 * "saya menderita gatal-gatal..." menghasilkan "Siproheptadin". Kalau istilah
 * yang dipilih tidak menemukan apa-apa, lebih baik mengembalikan kosong dan
 * membiarkan model berkata jujur bahwa sumbernya belum ditemukan.
 *
 * DUA istilah yang dipakai, dan keduanya perlu:
 *   - `kunci`  -> bahan pencarian Wikipedia Indonesia (istilah hasil pemetaan,
 *                 mis. "rontgen" menjadi "Radiografi").
 *   - `istilah` -> bahan pencarian MedlinePlus (istilah yang dikenali
 *                 pengguna, mis. "rontgen" menjadi "x-ray"). Koleksi
 *                 MedlinePlus berbahasa Inggris, jadi istilah Indonesia tidak
 *                 pernah menemukan apa pun di sana — sudah diukur.
 *
 * @param {string} teks - pertanyaan/teks pengguna apa adanya
 * @returns {Promise<{ hasil: Array, dipakaiKataKunci: string|null }>}
 */
async function cariDenganCadangan(teks) {
  const kunci = kataKunciPencarian(teks)
  if (!kunci) return { hasil: [], dipakaiKataKunci: null }

  // Padanan MedlinePlus diambil dari istilah yang DIKENALI pengguna, bukan dari
  // `kunci` hasil pemetaan. PETA_MEDLINEPLUS berkunci 'rontgen'/'usg', sedangkan
  // `kunci` sudah menjadi 'Radiografi'/'Ultrasonografi medis' — dan tidak ada
  // satu pun padanannya di sana.
  const istilah = istilahKesehatan(teks)
  const istilahMedlinePlus = PETA_MEDLINEPLUS[istilah] ?? null

  // Cadangan yang lebih umum untuk BIDANG topiknya. Dipakai cariInternet()
  // hanya kalau istilah spesifik di atas menghasilkan nol dokumen. Ini yang
  // membuat pertanyaan tentang topik yang belum pernah dipetakan tetap punya
  // bahan, bukan langsung "tidak ada sumber".
  const istilahMedlinePlusBidang = PETA_MEDLINEPLUS_BIDANG[istilah] ?? null

  const { hasil } = await cariInternet(kunci, { istilahMedlinePlus, istilahMedlinePlusBidang })

  // Tambahkan pengetahuan yang sudah tersimpan di database — OPSIONAL dan
  // SELALU di belakang hasil pencarian hidup. Dua alasan:
  //   1. Hasil pencarian hidup lebih baru daripada salinan tersimpan.
  //   2. Kalau database mati, hasilnya null dan tidak mengubah apa pun.
  // Yang disajikan hanya baris yang MASIH BERLAKU (kedaluwarsa > NOW());
  // yang basi tidak pernah ikut — itu ditegakkan di db.js.
  const tersimpan = await bahanTersimpan(istilah, kunci)

  return { hasil: [...hasil, ...tersimpan], dipakaiKataKunci: hasil.length ? kunci : null }
}

/**
 * Ambil pengetahuan tersimpan sebagai bahan tambahan.
 *
 * Diberi penanda `tersimpan: true` supaya jelas bedanya dengan hasil
 * pencarian hidup, dan tetap menyertakan URL sumber aslinya — jadi klaim
 * "ini dari MedlinePlus" tetap bisa diperiksa pengguna.
 *
 * Tidak pernah melempar: database opsional.
 */
async function bahanTersimpan(istilah, kunci) {
  try {
    const cari = istilah || kunci
    if (!cari) return []
    const baris = await ambilPengetahuan(cari, 2)
    if (!baris?.length) return []
    return baris.map((b) => ({
      judul: b.topik,
      url: b.url_sumber,
      sumber: b.sumber,
      isi: b.isi,
      tersimpan: true,
      diambilPada: b.diambil_pada,
    }))
  } catch {
    return []
  }
}

/** Bungkus handler async supaya error-nya tertangkap middleware error. */
const bungkus = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

/* -------------------------------------------------------------- routes ---- */

const rute = Router()

/**
 * Pembatas permintaan.
 *
 * Endpoint di bawah ini memanggil layanan luar yang BERBIAYA atau BERBEBAN:
 * model AI Kenari (berbayar) dan Wikipedia/Kemenkes (berbagi sumber daya).
 * Alamat aplikasi terbuka untuk umum, jadi tanpa pembatas siapa pun bisa
 * menghabiskan kuota akun — termasuk saat lomba berlangsung.
 *
 * Angka batasnya ada di server/batasInput.js (satu sumber kebenaran), bukan
 * ditulis ulang di sini. Sebelumnya setiap rute menulis angkanya sendiri dan
 * akibatnya tidak konsisten — ada yang terlewat sama sekali.
 *
 * Lihat catatan jujur soal sifat per-instance di server/batas.js.
 */
const batasTanya = batasi({ ...LAJU.tanya, nama: 'pertanyaan' })
const batasCari = batasi({ ...LAJU.sederhanakan, nama: 'permintaan' })
const batasVerifikasi = batasi({ ...LAJU.verifikasi, nama: 'permintaan' })
const batasSuara = batasi({ ...LAJU.suara, nama: 'permintaan suara' })
const batasKonten = batasi({ ...LAJU.konten, nama: 'permintaan konten' })
const batasFaskes = batasi({ ...LAJU.faskes, nama: 'pencarian fasilitas' })
const batasHealth = batasi({ ...LAJU.health, nama: 'pemeriksaan kesehatan' })
const batasMeta = batasi({ ...LAJU.meta, nama: 'permintaan meta' })
const batasBerita = batasi({ ...LAJU.berita, nama: 'ringkasan berita' })

/**
 * Tolak masukan yang kepanjangan, dengan pesan yang menyebut batasnya.
 * Dipakai bersama supaya setiap rute berperilaku sama.
 *
 * @returns {boolean} true kalau sudah dijawab (pemanggil harus berhenti)
 */
function tolakKalauPanjang(res, nilai, maks, nama) {
  if (nilai.length <= maks) return false
  res.status(400).json({
    ok: false,
    code: 'input_terlalu_panjang',
    pesan: `${nama} terlalu panjang (maks ${maks.toLocaleString('id-ID')} karakter, terkirim ${nilai.length.toLocaleString('id-ID')}).`,
  })
  return true
}

/**
 * Simpanan hasil pemeriksaan kesehatan.
 *
 * /api/health memanggil /models di Kenari. Tanpa simpanan, setiap permintaan
 * menembak Kenari — diukur ~0,29 detik per panggilan, dan endpoint ini terbuka
 * untuk umum. Dengan simpanan 15 detik, pemantauan tetap dapat jawaban segar
 * sementara hujan permintaan tidak lagi membebani akun.
 */
let simpananHealth = null
/** Janji pengukuran kesehatan yang sedang berjalan — lihat rute /api/health. */
let sedangUkur = null

/**
 * Isi database — untuk membuktikan sambungannya benar-benar bekerja.
 *
 * Sengaja menampilkan HITUNGAN dan contoh baris, bukan seluruh isi tabel.
 * Kalau database mati, endpoint ini menjawab `aktif: false` dengan alasan —
 * bukan error, karena database memang opsional.
 */
rute.get('/api/db', batasHealth, bungkus(async (_req, res) => {
  const ket = await keteranganDb()
  if (!ket.aktif) return res.json({ ok: true, db: ket, tersambung: false })

  const [berita, segar, konten] = await Promise.all([
    ambilBerita(5),
    hitungBeritaSegar(1),
    ambilKonten(5),
  ])

  res.json({
    ok: true,
    db: ket,
    tersambung: true,
    berita: { contoh: berita ?? [], segarHariIni: segar },
    konten: { contoh: konten ?? [] },
  })
}))

/**
 * Jejak sitasi — membuktikan klaim "jawaban ini bersumber dari X" bisa DILACAK.
 *
 * Menampilkan: berapa dokumen tercatat, berapa sitasi, dan rincian terakhir
 * (sumber mana dipakai untuk jenis jawaban apa, kapan). Sengaja TIDAK
 * menampilkan pertanyaan pengguna — itu memang tidak pernah disimpan.
 */
rute.get('/api/sitasi', batasHealth, bungkus(async (_req, res) => {
  const ket = await keteranganDb()
  if (!ket.aktif) return res.json({ ok: true, db: ket, tersambung: false })

  const ringkas = await tanya(
    `SELECT (SELECT COUNT(*) FROM dokumen) AS dokumen,
            (SELECT COUNT(*) FROM sitasi)  AS sitasi,
            (SELECT COUNT(*) FROM dokumen WHERE kedaluwarsa > NOW()) AS dokumen_berlaku`,
  )
  const perJenis = await tanya(
    `SELECT jenis_jawaban, COUNT(*) AS n FROM sitasi GROUP BY jenis_jawaban ORDER BY n DESC`,
  )
  const terakhir = await tanya(
    `SELECT s.jenis_jawaban, d.judul, d.url, s.dipakai_pada, src.nama AS sumber
       FROM sitasi s
       JOIN dokumen d   ON d.id = s.dokumen_id
       JOIN sumber  src ON src.id = d.sumber_id
      ORDER BY s.dipakai_pada DESC
      LIMIT 10`,
  )

  res.json({
    ok: true,
    db: ket,
    tersambung: true,
    ringkas: ringkas?.[0] ?? {},
    perJenis: perJenis ?? [],
    terakhir: terakhir ?? [],
  })
}))

rute.get('/api/health', batasHealth, bungkus(async (_req, res) => {
  const sekarang = Date.now()
  if (simpananHealth && sekarang - simpananHealth.waktu < SIMPANAN_HEALTH_MS) {
    res.set('X-Health-Cache', 'hit')
    return res.json(simpananHealth.isi)
  }

  /*
   * KUNCI PENGUKURAN — bukan sekadar memenuhi aturan lint.
   *
   * Tanpa ini, N permintaan yang datang bersamaan semuanya lolos pemeriksaan
   * simpanan di atas, lalu semuanya memanggil `cekSehat()` dan `keteranganDb()`.
   * Artinya: N kali permintaan jaringan ke layanan model, N kali percobaan
   * sambung database, untuk satu informasi yang sama. Pada pemantauan yang
   * menembak tiap detik, itu justru membebani yang sedang diukur.
   *
   * `sedangUkur` menyimpan JANJI: pemanggil kedua menunggu hasil yang sama,
   * bukan memulai pengukuran baru.
   */
  if (sedangUkur) {
    const isi = await sedangUkur
    res.set('X-Health-Cache', 'tunggu')
    return res.json(isi)
  }

  sedangUkur = (async () => {
    try {
      const sehat = await cekSehat()
      const isi = { server: 'ok', kenari: sehat, db: await keteranganDb(), ...safeInfo() }
      simpananHealth = { waktu: Date.now(), isi }
      return isi
    } finally {
      sedangUkur = null
    }
  })()

  const isi = await sedangUkur
  res.set('X-Health-Cache', 'miss')
  res.json(isi)
}))

/**
 * Konten harian untuk Beranda: topik populer, artikel, dan tips.
 *
 * Isinya diambil dari kanal resmi Kemenkes dan diperbarui sekali sehari
 * (lihat server/konten.js). Frontend memakai ini supaya halaman Beranda
 * tidak menampilkan artikel yang itu-itu saja.
 *
 * SOAL `?paksa=1`
 * Parameter ini memaksa pengambilan ulang dari situs Kemenkes. Dulu terbuka
 * untuk siapa pun, dan itu berbahaya: dengan pembatas 60/menit, satu penyerang
 * bisa memaksa 3.600 permintaan/jam ke server pemerintah — berisiko membuat IP
 * kita diblokir, dan merusak fitur ini untuk semua orang.
 *
 * Sekarang hanya berfungsi kalau RAHASIA_PAKSA diisi di environment DAN
 * nilainya cocok. Di produksi variabel itu tidak diisi, jadi parameter ini
 * tidak berpengaruh apa-apa di sana. Saat menguji di komputer sendiri,
 * jalankan:  RAHASIA_PAKSA=uji npm run server  lalu pakai ?paksa=uji
 */
rute.get('/api/konten', batasKonten, bungkus(async (req, res) => {
  const rahasia = String(process.env.RAHASIA_PAKSA ?? '').trim()
  const diminta = String(req.query?.paksa ?? '')
  const paksa = Boolean(rahasia) && diminta === rahasia
  const data = await kontenHarianLengkap({ paksa })
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
  res.json({ ok: true, ...data })
}))

/**
 * Wilayah administratif untuk pemilihan lokasi bertingkat.
 *
 * Tingkat dan kode induk divalidasi lebih dulu; yang tidak sah ditolak 400
 * SEBELUM menyentuh jaringan. Ini juga yang menutup celah injeksi, karena kode
 * dari sini dipakai sebagai parameter query ber-preparasi.
 */
/**
 * Hitung jumlah per kategori untuk jalur database.
 *
 * Jalur Overpass menghitungnya di `faskes.js`; jalur DB perlu menghitung
 * sendiri supaya bentuk balasannya SAMA dan antarmuka tidak perlu tahu dari
 * mana datanya datang.
 */
function hitungPerKategori(fasilitas) {
  const hasil = {}
  for (const f of fasilitas) hasil[f.kategori] = (hasil[f.kategori] ?? 0) + 1
  return hasil
}

rute.get('/api/wilayah', batasMeta, bungkus(async (req, res) => {
  const tingkat = String(req.query?.tingkat ?? 'provinsi')
  const induk = req.query?.induk ? String(req.query.induk) : null

  if (!['provinsi', 'kabupaten', 'kecamatan', 'desa'].includes(tingkat)) {
    res.status(400).json({ ok: false, code: 'tingkat_tidak_sah', wilayah: [] })
    return
  }
  if (tingkat !== 'provinsi' && !kodeSah(induk, tingkatDariKode(induk ?? ''))) {
    res.status(400).json({ ok: false, code: 'induk_tidak_sah', wilayah: [] })
    return
  }

  try {
    const { data, dariSimpanan } = await ambilWilayah(tingkat, induk)
    res.set('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800')
    res.json({ ok: true, tingkat, induk, jumlah: data.length, wilayah: data, dariSimpanan })
  } catch {
    res.status(503).json({ ok: false, code: 'sumber_gagal', wilayah: [] })
  }
}))

/**
 * Titik referensi sebuah wilayah.
 *
 * PENTING: yang dikembalikan adalah TITIK REFERENSI WILAYAH, bukan posisi
 * pengguna. `presisi` menyebut tingkat yang benar-benar dipakai supaya
 * antarmuka bisa mengatakannya terus terang — titik tengah kecamatan bukan
 * lokasi rumah siapa pun.
 */
rute.get('/api/wilayah/titik', batasFaskes, bungkus(async (req, res) => {
  const kode = String(req.query?.kode ?? '')
  const tingkat = tingkatDariKode(kode)
  if (!tingkat || !kodeSah(kode, tingkat)) {
    res.status(400).json({ ok: false, code: 'kode_tidak_sah' })
    return
  }

  const namaWilayah = {
    provinsi: String(req.query?.provinsi ?? ''),
    kabupaten: String(req.query?.kabupaten ?? ''),
    kecamatan: String(req.query?.kecamatan ?? ''),
    desa: String(req.query?.desa ?? ''),
  }

  try {
    const titik = await cascadeTitik({ kode, tingkat }, namaWilayah, titikNama)
    if (!titik) {
      // Tidak ada titik referensi -> JANGAN mengarang koordinat.
      res.status(404).json({ ok: false, code: 'titik_tidak_ditemukan' })
      return
    }
    res.json({ ok: true, kode, tingkat, titik })
  } catch {
    res.status(503).json({ ok: false, code: 'sumber_gagal' })
  }
}))

/**
 * Fasilitas kesehatan terdekat — data nyata dari OpenStreetMap/Overpass.
 *
 * Koordinat WAJIB dikirim pengguna (dari GPS peramban atau pencarian manual
 * yang dipilihnya sendiri). Server TIDAK pernah mengisi lokasi default: lokasi
 * palsu akan menampilkan fasilitas yang salah dan itu berbahaya di konteks
 * kesehatan.
 */
rute.get('/api/faskes', batasFaskes, bungkus(async (req, res) => {
  const lat = Number(req.query?.lat)
  const lon = Number(req.query?.lon)
  const radius = Number(req.query?.radius) || 5000

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({
      ok: false,
      code: 'koordinat_kosong',
      pesan: 'Koordinat lokasi diperlukan (lat dan lon).',
    })
    return
  }

  try {
    /*
     * Overpass DULU (kalau simpanannya lengkap), DB kalau sebaliknya.
     *
     * CACAT YANG DIPERBAIKI 4 Nov 2026 — inilah penyebab "cuma 3 fasilitas".
     *
     * Versi lama berbunyi "DB dulu, dan kalau DB mengembalikan baris apa pun,
     * pakai itu". Akibatnya terukur: database berisi 3 baris OSM di Cikarang,
     * lalu SETIAP permintaan di radius berapa pun berhenti di 3 baris itu —
     * Overpass tidak pernah dipanggil, sehingga area yang sebenarnya penuh
     * fasilitas tampil nyaris kosong. Pengguna melihat 3 hasil dan menyimpulkan
     * itulah semua yang ada.
     *
     * Aturan yang benar: simpanan di DB hanya dipakai kalau memang LENGKAP
     * untuk area itu. `cakupan` dicatat saat pengambilan; kalau tidak ada
     * catatan cakupan, isi DB tidak bisa dipercaya sebagai jawaban akhir dan
     * Overpass tetap dipanggil.
     */
    const dariDb = await fasilitasSekitarDb(lat, lon, radius)
    const adaIsiDb = Array.isArray(dariDb) && dariDb.length > 0

    if (adaIsiDb) {
      /*
       * Cakupan dicari yang MENCAKUP titik ini, bukan yang titiknya sama persis.
       * Catatan disimpan pada titik yang dibulatkan ~1,1 km, jadi permintaan
       * yang bergeser sedikit dulu dianggap "belum pernah diambil" dan menunggu
       * Overpass puluhan detik padahal datanya sudah ada.
       */
      const cakupan = await cakupanInfo(lat, lon, radius)
      if (cakupan) {
        const fasilitas = dariDb
          .map((b) => ({
            ...b,
            lat: Number(b.lat),
            lon: Number(b.lon),
            jarakM: jarakMeter(lat, lon, Number(b.lat), Number(b.lon)),
          }))
          .sort((a, b) => a.jarakM - b.jarakM)

        res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
        res.json({
          ok: true,
          sumberDb: true,
          pusat: { lat, lon },
          radius,
          jumlah: fasilitas.length,
          dipotong: false,
          fasilitas,
          perKategori: hitungPerKategori(fasilitas),
          sumber: [
            {
              nama: 'OpenStreetMap',
              keterangan:
                'Data fasilitas dari OpenStreetMap lewat Overpass API, disimpan di database aplikasi. Dipetakan sukarela oleh kontributor; kelengkapan berbeda antarwilayah.',
              url: 'https://www.openstreetmap.org/',
              lisensi: 'ODbL 1.0',
            },
          ],
          diambilPada: cakupan.diambil,
          // Jujur soal umur data: `basi` true berarti simpanan lebih tua dari
          // 6 jam. Angkanya tetap disajikan (jauh lebih baik daripada menunggu
          // 40 detik), tetapi antarmuka bisa menyebut kapan data diambil.
          basi: !cakupan.segar,
          cakupanJarakM: cakupan.jarakM,
        })
        /*
         * Segarkan di LATAR BELAKANG kalau simpanannya sudah basi. Pengguna
         * tidak menunggu; permintaan berikutnya mendapat data baru. Batasnya
         * lebih longgar (60 detik) karena tidak ada yang menatap layar.
         */
        if (!cakupan.segar) {
          faskesSekitar({ lat, lon, radius, batasMs: 60_000 })
            .then((baru) => {
              const utuh = !(baru.dipotong > 0)
              return simpanBanyak(baru.fasilitas.map((f) => ({ ...f, kode_osm: f.id }))).then(() =>
                utuh && baru.fasilitas.length
                  ? catatCakupan(lat, lon, radius, baru.fasilitas.length)
                  : null,
              )
            })
            .catch(() => null)
        }
        return
      }
      // Ada isi tapi cakupannya tidak diketahui -> jangan percaya sebagai
      // jawaban akhir; Overpass tetap dicoba di bawah. Kalau Overpass gagal,
      // isi DB dipakai sebagai cadangan (lihat blok catch).
    }

    const data = await faskesSekitar({ lat, lon, radius })
    res.set('Cache-Control', 'public, max-age=120, stale-while-revalidate=600')
    res.json({ ok: true, ...data })

    /*
     * Simpan hasil Overpass ke database di LATAR BELAKANG: pengguna tidak perlu
     * menunggu, dan kegagalan simpan tidak boleh menggagalkan respons yang
     * sudah terkirim.
     *
     * `catatCakupan` HANYA dipanggil kalau tarikan ini benar-benar lengkap.
     *
     * Ini cacat yang terukur 4 Nov 2026: saat hasil terpotong di batas 600,
     * cakupan tetap dicatat "600 = lengkap". Sesudah itu setiap permintaan
     * untuk area tersebut dilayani dari DB dan SELALU 600 — sisanya tidak
     * pernah terlihat dan tidak ada tanda apa pun bahwa ada yang hilang.
     * Mencatat "lengkap" untuk hasil yang terpotong adalah cara paling halus
     * untuk berbohong tentang kelengkapan data.
     */
    const lengkapBenar = !(data.dipotong > 0)
    simpanBanyak(
      data.fasilitas.map((f) => ({
        ...f,
        kode_osm: f.id,
      })),
    )
      .then(() =>
        data.fasilitas.length && lengkapBenar ? catatCakupan(lat, lon, radius, data.fasilitas.length) : null,
      )
      .catch(() => null)
  } catch (e) {
    const code = e?.code === 'koordinat' ? 'koordinat_tidak_sah' : 'sumber_gagal'

    /*
     * CADANGAN DB — benar-benar dipakai, bukan hanya dijanjikan di komentar.
     *
     * Saat Overpass gagal (502/503/timeout, yang sering terjadi pada layanan
     * publik ini), pengguna tidak boleh kehilangan data yang SUDAH ada di
     * database. Yang dikirim adalah isi DB apa adanya, DENGAN penanda jujur
     * `dariSimpanan: true` dan `sebagian: true` supaya antarmuka bisa berkata
     * "ini bukan tarikan terbaru".
     *
     * Syaratnya: hanya untuk kegagalan sumber, bukan koordinat tidak sah, dan
     * hanya kalau memang ada isi.
     */
    if (code === 'sumber_gagal') {
      try {
        const cadangan = await fasilitasSekitarDb(lat, lon, radius)
        if (Array.isArray(cadangan) && cadangan.length) {
          const fasilitas = cadangan
            .map((b) => ({
              ...b,
              lat: Number(b.lat),
              lon: Number(b.lon),
              jarakM: jarakMeter(lat, lon, Number(b.lat), Number(b.lon)),
            }))
            .sort((a, b) => a.jarakM - b.jarakM)

          res.set('Cache-Control', 'no-store')
          res.json({
            ok: true,
            sumberDb: true,
            dariSimpanan: true,
            // Disebut terbuka: ini BUKAN kelengkapan penuh, karena sumber
            // sedang tidak bisa dihubungi.
            sebagian: true,
            pusat: { lat, lon },
            radius,
            jumlah: fasilitas.length,
            dipotong: false,
            fasilitas,
            perKategori: hitungPerKategori(fasilitas),
            sumber: [
              {
                nama: 'OpenStreetMap (simpanan)',
                keterangan:
                  'Sumber sedang tidak dapat dihubungi. Ini data yang tersimpan sebelumnya di database aplikasi, bukan tarikan terbaru — jumlahnya bisa belum lengkap.',
                url: 'https://www.openstreetmap.org/',
                lisensi: 'ODbL 1.0',
              },
            ],
            keadaan: e?.keadaan ?? [],
            diambilPada: new Date().toISOString(),
          })
          return
        }
      } catch {
        // Cadangan gagal juga: jatuh ke galat di bawah, jangan menelan diam-diam.
      }
    }

    res.status(code === 'koordinat_tidak_sah' ? 400 : 503).json({
      ok: false,
      code,
      pesan:
        e?.code === 'koordinat'
          ? 'Koordinat lokasi tidak sah.'
          : 'Data fasilitas kesehatan belum dapat diambil. Coba lagi beberapa saat lagi.',
      keadaan: e?.keadaan ?? [],
    })
  }
}))

rute.get('/api/faskes/kategori', batasMeta, (_req, res) => {
  res.json({ ok: true, kategori: daftarKategori() })
})

/**
 * Statistik fasilitas nasional — angka laporan resmi, bukan hasil pemetaan.
 *
 * Kenapa dibaca dari database lebih dulu: angkanya bisa diperbarui tanpa
 * menyentuh kode (impor-statistik-faskes.mjs). Kalau database mati, dipakai
 * angka dari `server/statistikFaskes.js` — aplikasi tetap menjawab, dan
 * `dari` menyebut sumber mana yang dipakai supaya tidak menyesatkan.
 *
 * Peringatan yang SELALU ikut dikirim: angka Kemenkes hanya mencakup fasilitas
 * yang sudah mengimplementasikan sistem data dan aplikasi kesehatan, bukan
 * seluruh fasilitas nasional.
 */
rute.get('/api/statistik-faskes', batasMeta, bungkus(async (req, res) => {
  const kata = String(req.query?.cari ?? '').trim().toLowerCase()
  const dasar = ringkasanStatistik()
  let dari = 'berkas'
  let kemenkes = dasar.kemenkes
  let bpjs = dasar.bpjs

  const baris = await tanya(
    `SELECT lembaga, periode, jenis, jumlah, cakupan, kode_kategori, catatan
       FROM statistik_faskes
      ORDER BY lembaga, jumlah DESC`,
  )

  // Katalog rujukan juga dibaca dari database supaya penambahan/penggantian
  // sumber tidak menuntut perubahan kode. Gagal -> pakai daftar dari berkas.
  let sumberData = dasar.sumberData
  const rujukan = await tanya(
    `SELECT nama, penerbit, jenis, data, tautan, catatan
       FROM sumber_data_faskes
      ORDER BY id`,
  )
  if (Array.isArray(rujukan) && rujukan.length > 0) sumberData = rujukan

  if (Array.isArray(baris) && baris.length > 0) {
    dari = 'database'
    const rapikan = (b) => ({
      lembaga: b.lembaga,
      jenis: b.jenis,
      jumlah: Number(b.jumlah),
      kodeKategori: b.kode_kategori,
      catatan: b.catatan,
    })
    const km = baris.filter((b) => b.lembaga === 'Kemenkes')
    const bp = baris.filter((b) => b.lembaga === 'BPJS Kesehatan')
    if (km.length > 0) {
      kemenkes = {
        periode: km[0].periode,
        lembaga: 'Kemenkes',
        cakupan: km[0].cakupan,
        baris: km.map(rapikan),
        total: km.reduce((n, b) => n + Number(b.jumlah), 0),
      }
    }
    if (bp.length > 0) {
      bpjs = {
        periode: bp[0].periode,
        lembaga: 'BPJS Kesehatan',
        cakupan: bp[0].cakupan,
        baris: bp.map(rapikan),
        total: bp.reduce((n, b) => n + Number(b.jumlah), 0),
      }
    }
  }

  // Penyaringan sederhana supaya "dicari gampang" juga berlaku di endpoint.
  const cocok = (b) =>
    !kata ||
    b.jenis.toLowerCase().includes(kata) ||
    String(b.kodeKategori ?? '').toLowerCase().includes(kata) ||
    b.lembaga.toLowerCase().includes(kata)

  const saring = (kelompok) => ({ ...kelompok, baris: kelompok.baris.filter(cocok) })

  res.json({
    ok: true,
    dari,
    cari: kata || null,
    kemenkes: saring(kemenkes),
    bpjs: saring(bpjs),
    sumberData,
    peringatan:
      'Angka Kemenkes 2024 hanya mencakup fasilitas yang telah mengimplementasikan sistem data dan aplikasi kesehatan — bukan jumlah seluruh fasilitas kesehatan nasional. Angka BPJS adalah pembanding dengan cara hitung berbeda, jangan dijumlahkan.',
  })
}))

/**
 * Cari lokasi berdasarkan nama tempat — dipakai bila izin GPS ditolak.
 *
 * Diteruskan lewat server karena Nominatim mewajibkan User-Agent yang menyebut
 * aplikasinya, dan peramban tidak bisa mengubah User-Agent. Satu permintaan
 * per pencarian pengguna; tidak ada polling.
 */
rute.get('/api/faskes/cari-lokasi', batasFaskes, bungkus(async (req, res) => {
  const q = String(req.query?.q ?? '').trim()
  if (q.length < 3) {
    res.status(400).json({ ok: false, code: 'kueri_pendek', hasil: [] })
    return
  }
  if (q.length > 120) {
    res.status(400).json({ ok: false, code: 'kueri_panjang', hasil: [] })
    return
  }

  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1' +
      `&countrycodes=id&limit=6&q=${encodeURIComponent(q)}`
    const res2 = await fetch(url, {
      headers: {
        'User-Agent':
          'PahamiSehat/1.0 (pendidikan kesehatan; +https://github.com/Ellbaayy/Pahami-sehat)',
        'Accept-Language': 'id,en;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res2.ok) throw new Error(`HTTP ${res2.status}`)
    const j = await res2.json()
    const hasil = (Array.isArray(j) ? j : []).map((x) => ({
      nama: x.display_name?.split(',')[0] ?? x.name ?? 'Lokasi',
      alamat: x.display_name ?? '',
      lat: Number(x.lat),
      lon: Number(x.lon),
    }))
    res.json({ ok: true, hasil })
  } catch {
    res.status(503).json({ ok: false, code: 'lokasi_gagal', hasil: [] })
  }
}))

/**
 * Detail satu fasilitas menurut id database.
 *
 * DIDAFTARKAN PALING AKHIR, setelah `/api/faskes/kategori` dan
 * `/api/faskes/cari-lokasi`. Kalau `:id` lebih dulu, kedua rute itu
 * tertangkap sebagai id dan membalas 400 — kesalahan yang membingungkan
 * karena jalurnya terlihat benar.
 *
 * Balasannya 404 kalau barisnya sudah kedaluwarsa: menyajikan jam operasional
 * yang basi bukan cacat teknis, itu risiko kesehatan (lihat kepala db.js).
 */
rute.get('/api/faskes/:id', batasMeta, bungkus(async (req, res) => {
  const id = String(req.params.id ?? '')
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ ok: false, code: 'id_tidak_sah' })
    return
  }
  try {
    const f = await ambilFasilitas(Number(id))
    if (!f) {
      res.status(404).json({ ok: false, code: 'tidak_ditemukan' })
      return
    }
    res.json({ ok: true, fasilitas: f })
  } catch {
    res.status(503).json({ ok: false, code: 'database_gagal' })
  }
}))

/**
 * Rute perjalanan multimoda.
 *
 * `moda` WAJIB salah satu dari tiga yang didukung — tidak ada nilai bawaan
 * yang diam-diam memakai mobil untuk semua permintaan. Kalau `moda` tidak
 * dikenal, permintaan ditolak 400 supaya kesalahan pemanggil tidak terlihat
 * seperti "rute tidak ditemukan".
 */
/*
 * Rumah sakit RESMI Kemenkes (SIRS) — 3.325 RS nasional.
 *
 * Dipisah dari /api/faskes dengan sengaja. /api/faskes melayani peta radius dan
 * hanya bisa memuat fasilitas BERKOORDINAT. Data SIRS tidak punya koordinat
 * sama sekali (diukur 4 Nov 2026), jadi mencampurnya akan menampilkan rumah
 * sakit seolah punya titik akurat di peta.
 *
 * Yang dijaga di sini:
 *   - `perHalaman` dibatasi MAKS_HALAMAN agar satu permintaan tidak menarik
 *     seluruh 3.325 baris dan membebani server + peramban.
 *   - Filter diambil dari nilai yang benar-benar ada di database, bukan daftar
 *     tetap di kode.
 *   - Database mati menghasilkan 503 dengan pesan jelas, BUKAN daftar kosong:
 *     "tidak ada rumah sakit" dan "database mati" adalah dua hal berbeda.
 */
rute.get('/api/rs', batasFaskes, bungkus(async (req, res) => {
  const q = req.query ?? {}
  const hasil = await cariRsSirs({
    cari: q.cari ? String(q.cari).slice(0, 120) : null,
    provinsi: q.provinsi ? String(q.provinsi).slice(0, 80) : null,
    kabupaten: q.kabupaten ? String(q.kabupaten).slice(0, 80) : null,
    kelas: q.kelas ? String(q.kelas).slice(0, 20) : null,
    jenis: q.jenis ? String(q.jenis).slice(0, 40) : null,
    kepemilikan: q.kepemilikan ? String(q.kepemilikan).slice(0, 60) : null,
    hanyaKoordinat: String(q.koordinat ?? '') === '1',
    halaman: Number(q.halaman) || 1,
    perHalaman: Number(q.perHalaman) || 50,
  })

  if (!hasil) {
    res.status(503).json({
      ok: false,
      code: 'db_mati',
      pesan:
        'Data rumah sakit resmi tersimpan di MySQL dan database sedang tidak tersambung. Nyalakan XAMPP (MySQL) lalu coba lagi.',
    })
    return
  }

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  res.json({
    ok: true,
    total: hasil.total,
    halaman: hasil.halaman,
    perHalaman: hasil.perHalaman,
    jumlahHalaman: Math.max(1, Math.ceil(hasil.total / hasil.perHalaman)),
    jumlah: hasil.daftar.length,
    daftar: hasil.daftar,
    sumber: {
      nama: 'SIRS Kemenkes RI',
      url: 'https://sirs.kemkes.go.id/fo/home/dashboard_rs',
      keterangan:
        'Daftar Rumah Sakit Nasional dari SIRS Kementerian Kesehatan RI. Data resmi, tanpa koordinat: SIRS tidak menyediakan latitude/longitude, kecamatan, kelurahan, email, maupun website.',
    },
  })
}))

rute.get('/api/rs/filter', batasMeta, bungkus(async (_req, res) => {
  const f = await pilihanFilterSirs()
  if (!f) {
    res.status(503).json({ ok: false, code: 'db_mati', pesan: 'Database tidak tersambung.' })
    return
  }
  res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800')
  res.json({ ok: true, ...f })
}))

rute.get('/api/rs/ringkasan', batasMeta, bungkus(async (_req, res) => {
  const r = await ringkasanSirs()
  if (!r) {
    res.status(503).json({ ok: false, code: 'db_mati', pesan: 'Database tidak tersambung.' })
    return
  }
  res.set('Cache-Control', 'public, max-age=300')
  res.json({ ok: true, ...r })
}))

rute.get('/api/rs/:kode', batasFaskes, bungkus(async (req, res) => {
  const rs = await rsSirsMenurutKode(String(req.params.kode).slice(0, 24))
  if (rs === null) {
    res.status(503).json({ ok: false, code: 'db_mati', pesan: 'Database tidak tersambung.' })
    return
  }
  if (!rs) {
    res.status(404).json({ ok: false, code: 'tidak_ada', pesan: 'Rumah sakit dengan kode itu tidak ada di database.' })
    return
  }
  res.set('Cache-Control', 'public, max-age=300')
  res.json({ ok: true, rs })
}))

rute.get('/api/rute', batasFaskes, bungkus(async (req, res) => {
  const angka = (v) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const latAsal = angka(req.query?.latAsal)
  const lonAsal = angka(req.query?.lonAsal)
  const latTujuan = angka(req.query?.latTujuan)
  const lonTujuan = angka(req.query?.lonTujuan)
  const moda = String(req.query?.moda ?? 'mobil')
  // Hanya 'en' yang dianggap Inggris; selain itu Indonesia.
  const bahasa = String(req.query?.bahasa ?? 'id') === 'en' ? 'en' : 'id'

  if ([latAsal, lonAsal, latTujuan, lonTujuan].some((x) => x === null)) {
    res.status(400).json({ ok: false, code: 'koordinat_kosong' })
    return
  }
  if (!Object.keys(COSTING).includes(moda)) {
    res.status(400).json({ ok: false, code: 'moda_tidak_sah' })
    return
  }

  try {
    const rute = await ambilRute({ latAsal, lonAsal, latTujuan, lonTujuan, moda, bahasa })
    res.json({
      ok: true,
      moda,
      ...rute,
      googleMaps: tautanGoogleMaps({ latAsal, lonAsal, latTujuan, lonTujuan, moda }),
      catatanWaktu:
        'Estimasi waktu dihitung dari profil kecepatan rute, bukan kondisi lalu lintas langsung.',
    })
  } catch (e) {
    // Tautan Google Maps tetap dikirim walau rute gagal: itu jalan keluar
    // terakhir yang berguna bagi pengguna.
    res.status(e?.code === 'sumber_gagal' ? 503 : 400).json({
      ok: false,
      code: e?.code ?? 'gagal',
      pesan: 'Rute belum dapat dihitung. Coba lagi, atau buka tujuan di Google Maps.',
      googleMaps: tautanGoogleMaps({ latAsal, lonAsal, latTujuan, lonTujuan, moda }),
    })
  }
}))

rute.get('/api/meta', batasMeta, (_req, res) => {
  res.json({
    model: config.model,
    tingkat: Object.entries(TINGKAT).map(([kunci, t]) => ({
      kunci,
      label: t.label,
      usia: t.usia,
    })),
    tingkatDefault: TINGKAT_DEFAULT,
    /**
     * Daftar suara yang bisa dipilih pengguna.
     *
     * Diumumkan SERVER, bukan ditulis ulang di frontend, supaya tidak ada dua
     * daftar yang bisa berbeda. Kalau suatu saat suara ditambah/diganti,
     * antarmuka ikut sendiri tanpa perlu diubah.
     */
    suara: {
      daftar: daftarSuara(),
      bahasa: BAHASA_SUARA,
      jenis: JENIS_SUARA,
      bawaan: { bahasa: 'auto', jenis: 'p' },
    },
  })
})

/**
 * Ringkasan berita harian untuk lonceng pemberitahuan.
 *
 * Diminta (15 Okt 2026): berita WAJIB segar minimal sehari sekali, dan
 * lonceng harus berbunyi kalau ada yang baru. Endpoint ini yang dibaca hook
 * `useBerita` di aplikasi: jumlah berita segar (<= 1 hari), 3 judul teratas,
 * tanggal diperbarui, dan sidik jari daftarnya.
 *
 * Murah: fetch RSS-nya di-cache sekali sehari di sisi server (lihat
 * ringkasanBerita di berita.js), jadi endpoint ini hanya membaca simpanan.
 */
rute.get('/api/berita/ringkas', batasBerita, bungkus(async (_req, res) => {
  const d = await ringkasanBerita()
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=86400')
  res.json({ ok: true, ...d })
}))

/**
 * Suara natural untuk jawaban AI.
 *
 * Menerima teks + bahasa, mengembalikan MP3. Dipakai tombol "Dengar" di
 * aplikasi. Nada tiap kalimat mengikuti isinya (lihat server/suara.js).
 *
 * Kalau layanan suara Microsoft tidak bisa dihubungi, balasannya 502 dengan
 * kode `suara_gagal` supaya frontend bisa jatuh ke suara bawaan peramban
 * tanpa menampilkan error yang membingungkan.
 */
rute.post('/api/suara', batasSuara, bungkus(async (req, res) => {
  const teks = teksDari(req.body?.teks)
  if (!teks) {
    return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Teks masih kosong.' })
  }
  // Dulu tidak ada batas sama sekali. Diuji: teks 3000, 4001, dan 20000
  // karakter semuanya menggantung sampai koneksi diputus platform (60 detik)
  // tanpa balasan apa pun. Sekarang ditolak lebih awal dengan pesan jelas.
  if (tolakKalauPanjang(res, teks, MAKS_SUARA, 'Teks yang dibacakan')) return

  // Bahasa & jenis suara.
  //
  // `bahasa` boleh berisi pilihan PENGGUNA ('id'/'jv'/'su'/'en') atau 'auto'.
  // Pilihan pengguna MENANG atas tebakan otomatis — lihat tentukanBahasa().
  // Inilah yang memperbaiki keluhan "dijawab Indonesia tapi dibacakan Jawa":
  // kalau pengguna sudah memilih, tebakan tidak dijalankan sama sekali.
  const diminta = teksDari(req.body?.bahasa).toLowerCase()
  const bahasa = tentukanBahasa(teks, diminta)
  const jenis = teksDari(req.body?.jenis).toLowerCase() === 'l' ? 'l' : 'p'

  try {
    const audio = await buatSuara(teks, { bahasa, jenis })
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': String(audio.length),
      // suara untuk teks yang sama tidak berubah -> boleh disimpan sebentar
      'Cache-Control': 'public, max-age=3600',
    })
    return res.send(audio)
  } catch (e) {
    // Pesan galat dari layanan suara TIDAK dikirim ke klien. Endpoint ini
    // terbuka untuk umum, dan pesan itu bisa memuat alamat internal atau
    // rincian WebSocket. Cukup dicatat di log server.
    console.error('[suara]', e?.message ?? e)
    return res.status(502).json({
      ok: false,
      code: 'suara_gagal',
      pesan: 'Suara natural sedang tidak bisa dibuat. Peramban akan memakai suara bawaannya.',
      suara: pilihSuara(bahasa, jenis),
    })
  }
}))

rute.post('/api/tanya', batasTanya, bungkus(async (req, res) => {
  const pertanyaan = teksDari(req.body?.pertanyaan)
  if (!pertanyaan) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Pertanyaan masih kosong.' })
  if (tolakKalauPanjang(res, pertanyaan, MAKS_TANYA, 'Pertanyaan')) return

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const bhs = pilihBahasa(pertanyaan, rapikanBahasa(req.body?.bahasa))
  const idSesi = rapikanSesi(req.body?.idSesi)

  // Konteks percakapan: dipakai supaya pertanyaan lanjutan ("terus gimana",
  // "kalau yang satu ginjal?") tetap nyambung dengan topik yang sedang dibahas.
  // Kosong kalau ini percakapan baru atau database mati — dan dalam hal itu
  // perilakunya persis seperti sebelum fitur konteks ada.
  const riwayat = await konteksSesi(idSesi)

  // Pertanyaan soal BERITA kesehatan terkini: pakai jalur berita (RSS),
  // bukan Wikipedia — karena yang ditanyakan memang kabar harian, bukan
  // penjelasan medis. Berita tetap harus dicek ke sumber resminya.
  //
  // Diperiksa SEBELUM `deteksiSantai()` (15 Okt 2026): "berita terbaru hari
  // ini" hanya 3 kata tanpa kata tanya, jadi mode santai menangkapnya lebih
  // dulu dan pertanyaannya dijawab sebagai sapaan — jalur berita tidak pernah
  // tercapai. Permintaan berita yang jelas harus menang atas mode santai.
  if (menanyakanBerita(pertanyaan)) {
    const berita = await ambilBeritaKesehatan({ maks: 8 })
    const p = promptBerita({ pertanyaan, tingkat, berita, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal, riwayat })
    const { json, usage } = await mintaJson({
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: p.user },
      ],
      maxTokens: MAKS_TOKEN.berita,
      jalur: 'tanya/berita',
    })

    // Model gagal dua kali? Tetap jawab dari daftar RSS — jangan kirim
    // gelembung kosong ke pengguna.
    if (!json) {
      const darurat = jawabanBeritaDarurat(berita, bhs.kode)
      if (darurat) {
        const out = bentukHasil({ jawaban: darurat, poin_kunci: [], sumber: [] }, tingkat)
        return res.json({
          ...out,
          berita: true,
          ringkasDarurat: true,
          hasilCari: ringkasBerita(berita),
          usage,
        })
      }
      // Tidak ada berita SAMA SEKALI dan model juga gagal: katakan apa adanya,
      // jangan kirim jawaban kosong.
      const kosong =
        bhs.kode === 'en'
          ? 'The health news source could not be reached right now, and no summary could be written. Please try again in a moment.'
          : 'Sumber berita kesehatan sedang tidak bisa diakses, dan ringkasannya juga tidak bisa dibuat. Coba lagi sebentar lagi, ya.'
      const out = bentukHasil({ jawaban: kosong, poin_kunci: [], sumber: [] }, tingkat)
      return res.status(200).json({ ...out, berita: true, hasilCari: [], usage })
    }

    const out = bentukHasil(json, tingkat)
    catatKonteks(idSesi, 'pengguna', pertanyaan)
    catatKonteks(idSesi, 'aplikasi', out.jawaban)
    return res.json({ ...out, berita: true, hasilCari: ringkasBerita(berita), usage })
  }

  // Obrolan biasa (sapaan / basa-basi) tidak perlu dicari di internet dan
  // tidak perlu menampilkan daftar sumber — tidak ada yang diverifikasi.
  //
  // KECUALI kalau ini pertanyaan LANJUTAN di tengah percakapan: "terus gimana"
  // atau "jadi gimana dong" memang tidak memuat istilah kesehatan, tetapi
  // maksudnya merujuk pada topik yang sedang dibahas. Menjawabnya sebagai
  // sapaan adalah persis keluhan "tidak nyambung" yang harus dihindari.
  if (deteksiSantai(pertanyaan) && !pertanyaanLanjutan(pertanyaan, false)) {
    const ps = promptSantai({ pertanyaan, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
    const { json, usage } = await mintaJson({
      messages: [
        { role: 'system', content: ps.system },
        { role: 'user', content: ps.user },
      ],
      maxTokens: MAKS_TOKEN.tanya,
      jalur: 'tanya/santai',
    })
    const santai = bentukHasil(json, tingkat)
    catatKonteks(idSesi, 'pengguna', pertanyaan)
    catatKonteks(idSesi, 'aplikasi', santai.jawaban)
    return res.json({ ...santai, santai: true, hasilCari: [], usage })
  }

  // cari di internet dulu supaya jawabannya berbasis sumber nyata
  //
  // BAHAN PENCARIAN untuk pertanyaan lanjutan: kalau pertanyaannya tidak
  // menyebut topiknya sendiri ("terus gimana udah terlanjur nih"), yang dicari
  // adalah TOPIK TERAKHIR yang sedang dibahas. Tanpa ini, pencarian memakai
  // kata sambung belaka, tidak menemukan apa pun, dan jawabannya jadi generik
  // — persis keluhan "tidak nyambung".
  const topik = pertanyaanLanjutan(pertanyaan, Boolean(istilahKesehatan(pertanyaan)))
    ? topikTerakhir(riwayat)
    : ''
  const bahanCari = topik || pertanyaan

  const { hasil: hasilCari } = await cariDenganCadangan(bahanCari)

  const p = promptTanyaDenganCari({
    pertanyaan,
    tingkat,
    hasilCari,
    bahasa: bhs.nama,
    kodeAsal: bhs.kodeAsal,
    riwayat,
  })
  const { json, usage } = await mintaJson({
    messages: [
      { role: 'system', content: p.system },
      { role: 'user', content: p.user },
    ],
    maxTokens: MAKS_TOKEN.tanya,
    jalur: 'tanya',
  })

  const out = saringHasil(bentukHasil(json, tingkat), hasilCari)
  res.json({ ...out, hasilCari: ringkasHasilCari(hasilCari), usage })

  // Simpan giliran percakapan supaya pertanyaan berikutnya punya konteks.
  // OPSIONAL dan tidak ditunggu — lihat catatKonteks().
  catatKonteks(idSesi, 'pengguna', pertanyaan)
  catatKonteks(idSesi, 'aplikasi', out.jawaban)

  // Catat sumber yang benar-benar DIKUTIP model ke tabel sitasi — OPSIONAL,
  // dan sengaja SETELAH respons dikirim supaya pengguna tidak ikut menunggu.
  // Ini yang membuat klaim "jawaban ini bersumber dari X" bisa DILACAK,
  // bukan cuma ditulis. Tidak pernah melempar: kegagalan di sini tidak boleh
  // terlihat pengguna, dan database memang opsional.
  catatSumberDikutip('tanya', out.sumber).catch(() => null)
}))

rute.post('/api/sederhanakan', batasCari, bungkus(async (req, res) => {
  const teks = teksDari(req.body?.teks)
  if (!teks) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Teks masih kosong.' })
  if (tolakKalauPanjang(res, teks, MAKS_SEDERHANAKAN, 'Teks')) return

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const bhs = pilihBahasa(teks, rapikanBahasa(req.body?.bahasa))

  // pakai 120 karakter pertama sebagai kata kunci pencarian — cukup untuk
  // menemukan istilahnya tanpa membuang waktu pada teks panjang.
  // Kalau teksnya bahasa daerah, pencarian itu kosong, jadi dipakai cadangan
  // istilah Indonesia lewat cariDenganCadangan.
  const { hasil: hasilCari } = await cariDenganCadangan(teks.slice(0, 120))

  const p = promptSederhanakanDenganCari({ teks, tingkat, hasilCari, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
  const { json, usage } = await mintaJson({
    messages: [
      { role: 'system', content: p.system },
      { role: 'user', content: p.user },
    ],
    maxTokens: MAKS_TOKEN.sederhanakan,
    jalur: 'sederhanakan',
  })

  const out = bentukHasil(json, tingkat)
  res.json({ ...out, hasilCari: ringkasHasilCari(hasilCari), usage })
  catatSumberDikutip('sederhanakan', out.sumber).catch(() => null)
}))

rute.post('/api/verifikasi', batasVerifikasi, bungkus(async (req, res) => {
  const klaim = teksDari(req.body?.klaim)
  if (!klaim) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Klaim masih kosong.' })
  if (tolakKalauPanjang(res, klaim, MAKS_VERIFIKASI, 'Klaim')) return

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const bhs = pilihBahasa(klaim, rapikanBahasa(req.body?.bahasa))

  const { hasil: hasilCari } = await cariDenganCadangan(klaim)

  const p = promptVerifikasiDenganCari({ klaim, tingkat, hasilCari, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
  const { json, usage } = await mintaJson({
    messages: [
      { role: 'system', content: p.system },
      { role: 'user', content: p.user },
    ],
    maxTokens: MAKS_TOKEN.verifikasi,
    jalur: 'verifikasi',
  })

  const keluar = bentukHasil(json, tingkat, { verdictKey: 'verdict' })
  res.json({
    ...keluar,
    hasilCari: ringkasHasilCari(hasilCari),
    usage,
  })
  catatSumberDikutip('verifikasi', keluar.sumber).catch(() => null)
}))

/**
 * Streaming SSE — untuk efek "mengetik" di UI.
 * Kirim event: `status`, `delta`, `hasil` (JSON final), atau `error`.
 *
 * BATAS PANJANG: dulu endpoint ini TIDAK punya batas sama sekali — dan itulah
 * yang berbahaya, karena inilah endpoint yang benar-benar dipakai aplikasi.
 * Diuji: 200.000 karakter diterima dan diproses (HTTP 200), padahal /api/tanya
 * menolak masukan yang sama dengan 400. Sekarang batasnya sama dengan
 * /api/tanya.
 *
 * PENTING soal urutan: penolakan harus dikirim sebagai JSON BIASA, bukan
 * sebagai event SSE. Kalau header sudah di-flush sebagai text/event-stream,
 * klien akan mencoba membacanya sebagai stream dan pesan galatnya tidak
 * pernah sampai. Karena itu pemeriksaan input dilakukan SEBELUM header.
 */
rute.post('/api/tanya/stream', batasTanya, bungkus(async (req, res) => {
  const pertanyaan = teksDari(req.body?.pertanyaan)
  if (!pertanyaan) return res.status(400).json({ ok: false, code: 'input_kosong', pesan: 'Pertanyaan masih kosong.' })
  if (tolakKalauPanjang(res, pertanyaan, MAKS_TANYA, 'Pertanyaan')) return

  const tingkat = rapikanTingkat(req.body?.tingkat)
  const bhs = pilihBahasa(pertanyaan, rapikanBahasa(req.body?.bahasa))
  const idSesi = rapikanSesi(req.body?.idSesi)

  // Konteks percakapan diambil SEBELUM header SSE dikirim: kalau database
  // lambat, penundaan itu terjadi sebelum pengguna melihat apa pun — bukan
  // di tengah aliran jawaban. Kalau database mati, hasilnya array kosong dan
  // perilakunya sama seperti sebelum fitur konteks ada.
  const riwayat = await konteksSesi(idSesi)

  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders?.()

  const kirim = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)

  // batalkan panggilan upstream kalau KLIEN memutus koneksi lebih dulu.
  // Catatan: pakai res.on('close'), bukan req.on('close') — di Node modern
  // 'close' pada request menyala begitu body selesai dibaca, sehingga
  // panggilan AI-nya ikut terbatalkan sendiri.
  const ac = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) ac.abort()
  })

  try {
    // Pertanyaan soal BERITA kesehatan terkini: pakai jalur berita (RSS),
    // bukan Wikipedia — yang ditanyakan memang kabar harian, bukan penjelasan medis.
    //
    // Diperiksa SEBELUM `deteksiSantai()` (15 Okt 2026): "berita terbaru hari
    // ini" hanya 3 kata tanpa kata tanya, jadi mode santai menangkapnya lebih
    // dulu dan pertanyaannya dijawab sebagai sapaan — jalur berita tidak pernah
    // tercapai. Permintaan berita yang jelas harus menang atas mode santai.
    if (menanyakanBerita(pertanyaan)) {
      kirim('status', { pesan: 'Mengambil berita kesehatan terbaru…' })
      const berita = await ambilBeritaKesehatan({ maks: 8 })
      kirim('sumber', { hasil: ringkasBerita(berita) })

      kirim('status', { pesan: 'Menyiapkan jawaban…' })
      const p = promptBerita({ pertanyaan, tingkat, berita, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal, riwayat })
      const ekstrakBerita = buatEkstrak('jawaban')

      const hasilBerita = await chatStream({
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user },
        ],
        maxTokens: MAKS_TOKEN.berita,
        signal: ac.signal,
        onDelta: (t) => {
          const bersih = ekstrakBerita.dorong(t)
          if (bersih) kirim('delta', { teks: bersih })
        },
      })

      let finalBerita = bentukHasil(ambilJson(hasilBerita.text), tingkat)
      let usageBerita = hasilBerita.usage

      // Balasan terpotong / bukan JSON -> coba sekali lagi (non-stream),
      // lalu jawab dari daftar RSS kalau masih gagal. Tanpa ini pengguna
      // melihat gelembung KOSONG — kejadian nyata 15 Okt 2026.
      if (!finalBerita.ok) {
        kirim('status', { pesan: 'Menyusun ulang jawaban…' })
        const ulang = await mintaJson({
          messages: [
            { role: 'system', content: p.system },
            { role: 'user', content: p.user },
          ],
          maxTokens: MAKS_TOKEN.berita,
          jalur: 'stream/berita/ulang',
        })
        usageBerita = ulang.usage ?? usageBerita
        if (ulang.json) {
          finalBerita = bentukHasil(ulang.json, tingkat)
        } else {
          const darurat = jawabanBeritaDarurat(berita, bhs.kode)
          if (darurat) {
            finalBerita = {
              ...bentukHasil({ jawaban: darurat, poin_kunci: [], sumber: [] }, tingkat),
              ringkasDarurat: true,
            }
          }
        }
      }

      kirim('hasil', { ...finalBerita, berita: true, hasilCari: ringkasBerita(berita), usage: usageBerita })
      catatKonteks(idSesi, 'pengguna', pertanyaan)
      catatKonteks(idSesi, 'aplikasi', finalBerita.jawaban)
      res.write('event: selesai\ndata: {}\n\n')
      return
    }

    // Obrolan biasa: langsung jawab tanpa mencari dan tanpa daftar sumber.
    // KECUALI pertanyaan lanjutan — lihat penjelasan di /api/tanya.
    if (deteksiSantai(pertanyaan) && !pertanyaanLanjutan(pertanyaan, false)) {
      kirim('status', { pesan: 'Menyiapkan jawaban…' })
      const ps = promptSantai({ pertanyaan, bahasa: bhs.nama, kodeAsal: bhs.kodeAsal })
      const ekstrakSantai = buatEkstrak('jawaban')

      const h = await chatStream({
        messages: [
          { role: 'system', content: ps.system },
          { role: 'user', content: ps.user },
        ],
        signal: ac.signal,
        onDelta: (t) => {
          const bersih = ekstrakSantai.dorong(t)
          if (bersih) kirim('delta', { teks: bersih })
        },
      })

      const santai = bentukHasil(ambilJson(h.text), tingkat)
      const santaiFinal = santai.ok
        ? santai
        : bentukHasil(
            (
              await mintaJson({
                messages: [
                  { role: 'system', content: ps.system },
                  { role: 'user', content: ps.user },
                ],
                maxTokens: MAKS_TOKEN.tanya,
                jalur: 'stream/santai/ulang',
              })
            ).json,
            tingkat,
          )
      kirim('hasil', { ...santaiFinal, santai: true, hasilCari: [], usage: h.usage })
      catatKonteks(idSesi, 'pengguna', pertanyaan)
      catatKonteks(idSesi, 'aplikasi', santaiFinal.jawaban)
      res.write('event: selesai\ndata: {}\n\n')
      return
    }

    // 1) cari di internet dulu
    //
    // Bahan pencarian memakai TOPIK TERAKHIR kalau pertanyaannya tidak
    // menyebut topiknya sendiri — lihat penjelasan di /api/tanya.
    const topik = pertanyaanLanjutan(pertanyaan, Boolean(istilahKesehatan(pertanyaan)))
      ? topikTerakhir(riwayat)
      : ''
    const bahanCari = topik || pertanyaan

    kirim('status', { pesan: 'Mencari sumber terpercaya…' })
    const { hasil: hasilCari } = await cariDenganCadangan(bahanCari)
    kirim('sumber', { hasil: ringkasHasilCari(hasilCari) })

    // 2) baru minta model menyusun jawaban dari hasil itu
    kirim('status', { pesan: 'Menyiapkan jawaban…' })
    const p = promptTanyaDenganCari({
      pertanyaan,
      tingkat,
      hasilCari,
      bahasa: bhs.nama,
      kodeAsal: bhs.kodeAsal,
      riwayat,
    })

    // hanya alirkan isi field "jawaban", bukan JSON mentahnya
    const ekstrak = buatEkstrak('jawaban')

    const hasil = await chatStream({
      messages: [
        { role: 'system', content: p.system },
        { role: 'user', content: p.user },
      ],
      signal: ac.signal,
      onDelta: (t) => {
        const bersih = ekstrak.dorong(t)
        if (bersih) kirim('delta', { teks: bersih })
      },
    })

    let final = saringHasil(bentukHasil(ambilJson(hasil.text), tingkat), hasilCari)
    let usageFinal = hasil.usage

    // Sama seperti jalur berita: balasan terpotong / bukan JSON tidak boleh
    // berakhir sebagai gelembung kosong. Ulangi sekali, non-stream.
    if (!final.ok) {
      kirim('status', { pesan: 'Menyusun ulang jawaban…' })
      const ulang = await mintaJson({
        messages: [
          { role: 'system', content: p.system },
          { role: 'user', content: p.user },
        ],
        maxTokens: MAKS_TOKEN.tanya,
        jalur: 'stream/tanya/ulang',
      })
      usageFinal = ulang.usage ?? usageFinal
      if (ulang.json) final = saringHasil(bentukHasil(ulang.json, tingkat), hasilCari)
    }

    kirim('hasil', { ...final, hasilCari: ringkasHasilCari(hasilCari), usage: usageFinal })
    catatKonteks(idSesi, 'pengguna', pertanyaan)
    catatKonteks(idSesi, 'aplikasi', final.jawaban)
    res.write('event: selesai\ndata: {}\n\n')
    catatSumberDikutip('tanya', final.sumber).catch(() => null)
  } catch (e) {
    if (!ac.signal.aborted) {
      kirim('error', { code: e.code ?? 'upstream_error', pesan: e.message })
    }
  } finally {
    res.end()
  }
}))


/* -------------------------------------------------------------- errors ---- */

rute.use((err, _req, res, _next) => {
  const kenari = err instanceof KenariError
  // Body yang terlalu besar ditangkap express.json() sebagai err.type.
  // Tanpa penanganan ini, pengguna melihat "500 Terjadi kesalahan di server"
  // padahal masalahnya cuma kiriman kepanjangan.
  const terlaluBesar = err?.type === 'entity.too.large'
  const status = terlaluBesar ? 413 : kenari ? (err.status === 401 ? 502 : err.status) : 500
  const isi = {
    ok: false,
    code: terlaluBesar ? 'body_terlalu_besar' : kenari ? err.code : 'server_error',
    pesan: terlaluBesar
      ? 'Kiriman terlalu besar (maks 1 MB).'
      : kenari
        ? err.message
        : 'Terjadi kesalahan di server.',
  }
  if (!kenari && !terlaluBesar) console.error('[server]', err)
  if (res.headersSent) return res.end()
  res.status(status).json(isi)
})

export default rute

/**
 * Sesi obrolan — menyimpan percakapan UTUH, bukan sekadar pertanyaan.
 *
 * Sebelumnya riwayat menyimpan satu pertanyaan per entri dan jawabannya
 * dipotong 96 karakter, jadi tidak ada yang bisa dibuka kembali. Sekarang satu
 * sesi memuat seluruh utasan (pertanyaan, jawaban, poin kunci, sumber) dan bisa
 * dibuka lagi kapan saja, bahkan dilanjutkan.
 *
 * Disimpan di localStorage peramban — tidak ada server yang menyimpannya.
 * Karena itu jumlahnya dibatasi: penyimpanan peramban biasanya hanya memberi
 * sekitar 5 MB, dan satu jawaban lengkap bisa beberapa kilobyte. Yang dibuang
 * saat penuh adalah sesi PALING LAMA, bukan yang baru.
 */

export const KUNCI_SESI = 'pahami-sehat:sesi'
/** Kunci lama (satu pertanyaan per entri) — hanya dibaca sekali untuk dipindahkan. */
export const KUNCI_RIWAYAT_LAMA = 'pahami-sehat:riwayat'

export const MAKS_SESI = 20

/** Panjang judul sesi yang diambil dari pertanyaan pertama. */
const MAKS_JUDUL = 60

/** Judul sesi: pertanyaan pertama, dipadatkan jadi satu baris. */
export function judulDari(teks, maks = MAKS_JUDUL) {
  const s = String(teks ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return ''
  return s.length <= maks ? s : `${s.slice(0, maks).trimEnd()}…`
}

/**
 * Pindahkan riwayat format lama (satu pertanyaan per entri) ke bentuk sesi.
 *
 * Tanpa ini, riwayat yang sudah dimiliki pengguna akan hilang begitu saja saat
 * formatnya berganti. Jawabannya memang sudah terpotong 96 karakter sejak
 * dulu, jadi yang bisa diselamatkan hanya sebatas itu — tapi lebih baik
 * daripada menghapusnya.
 */
function pindahkanRiwayatLama(mentah) {
  if (!Array.isArray(mentah) || !mentah.length) return []
  return mentah
    .filter((h) => h && h.id && h.question)
    .map((h) => {
      const waktu = Date.now()
      const sumber = (h.sources ?? []).map((s) =>
        typeof s === 'string' ? { penerbit: s } : s,
      )
      return {
        id: `s-lama-${h.id}`,
        judul: judulDari(h.question),
        dibuat: waktu,
        diperbarui: waktu,
        pesan: [
          { id: `${h.id}-u`, role: 'user', text: h.question, mode: 'tanya' },
          {
            id: `${h.id}-a`,
            role: 'ai',
            text: h.answer ?? '',
            sources: sumber,
            poinKunci: [],
            catatan: '',
            verdict: 'ok',
          },
        ],
      }
    })
}

/**
 * Baca daftar sesi.
 *
 * Nilai yang tidak sah dibuang satu per satu, bukan dipercaya begitu saja —
 * isi localStorage bisa saja sudah tua atau diubah tangan, dan satu entri rusak
 * tidak boleh membuat seluruh riwayat gagal tampil.
 */
export function bacaSesi() {
  let daftar = []
  try {
    const mentah = localStorage.getItem(KUNCI_SESI)
    if (mentah !== null) {
      const isi = JSON.parse(mentah)
      if (Array.isArray(isi)) daftar = isi
    } else {
      // belum ada format baru — coba pindahkan yang lama, sekali saja
      const lama = localStorage.getItem(KUNCI_RIWAYAT_LAMA)
      if (lama !== null) {
        daftar = pindahkanRiwayatLama(JSON.parse(lama))
        if (daftar.length) simpanSesi(daftar)
      }
    }
  } catch {
    return []
  }

  return daftar
    .filter((s) => s && s.id && Array.isArray(s.pesan) && s.pesan.length)
    .map((s) => ({
      id: String(s.id),
      judul: s.judul || judulDari(s.pesan.find((p) => p?.role === 'user')?.text),
      dibuat: Number(s.dibuat) || Date.now(),
      diperbarui: Number(s.diperbarui) || Number(s.dibuat) || Date.now(),
      pesan: s.pesan.filter((p) => p && p.role && typeof p.text === 'string'),
    }))
    .filter((s) => s.pesan.length)
    .slice(0, MAKS_SESI)
}

export function simpanSesi(daftar) {
  try {
    localStorage.setItem(KUNCI_SESI, JSON.stringify((daftar ?? []).slice(0, MAKS_SESI)))
    return true
  } catch {
    /* penyimpanan penuh / diblokir — sesi tetap jalan untuk sesi ini */
    return false
  }
}

/**
 * Waktu relatif dalam bahasa antarmuka.
 *
 * `t` dipakai untuk satuan waktunya supaya kalimatnya ikut bahasa yang dipilih,
 * bukan selalu Indonesia.
 */
export function waktuRelatif(ms, t = (k) => k, kodeLokal = 'id-ID') {
  const kini = Date.now()
  const selisih = Math.max(0, kini - (Number(ms) || kini))
  const menit = Math.floor(selisih / 60000)

  if (menit < 1) return t('sesi.baruSaja')
  if (menit < 60) return t('sesi.menitLalu', { n: menit })

  const jam = Math.floor(menit / 60)
  if (jam < 24) return t('sesi.jamLalu', { n: jam })

  const hari = Math.floor(jam / 24)
  if (hari === 1) return t('sesi.kemarin')
  if (hari < 7) return t('sesi.hariLalu', { n: hari })

  return new Date(ms).toLocaleDateString(kodeLokal, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Cuplikan jawaban pertama — dipakai sebagai ringkasan di daftar. */
export function ringkasSesi(sesi, maks = 110) {
  const ai = (sesi?.pesan ?? []).find((p) => p.role === 'ai' && p.text)
  if (!ai) return ''
  const s = String(ai.text).replace(/\s+/g, ' ').trim()
  return s.length <= maks ? s : `${s.slice(0, maks).trimEnd()}…`
}

/** Jumlah pertanyaan (peran user) dalam satu sesi. */
export function jumlahTanya(sesi) {
  return (sesi?.pesan ?? []).filter((p) => p.role === 'user').length
}

/**
 * Susun teks bagikan dari satu atau beberapa sesi.
 *
 * Bentuknya teks biasa supaya bisa ditempel ke mana saja (WhatsApp, catatan,
 * surel) tanpa perlu aplikasi ini. Poin kunci dan sumber ikut disertakan karena
 * di aplikasi inilah bukti bahwa jawabannya bisa dicek sendiri — membagikan
 * jawabannya tanpa sumbernya justru menghilangkan bagian yang paling penting.
 */
export function teksBagikan(daftar, t = (k) => k, kodeLokal = 'id-ID') {
  const sesi = (Array.isArray(daftar) ? daftar : [daftar]).filter(Boolean)
  const keluar = []

  keluar.push(`Pahami Sehat — ${t('sesi.bagikanJudul')}`)

  sesi.forEach((s, i) => {
    if (sesi.length > 1) keluar.push(`\n=== ${i + 1}. ${s.judul} ===`)
    else keluar.push(s.judul)
    keluar.push(new Date(s.dibuat).toLocaleString(kodeLokal))
    keluar.push('')

    for (const p of s.pesan ?? []) {
      if (p.role === 'user') {
        keluar.push(`${t('tanya.kamu')}: ${p.text}`)
      } else {
        keluar.push(`Pahami Sehat: ${p.text}`)
        if (p.poinKunci?.length) {
          keluar.push(`${t('umum.poinKunci')}:`)
          for (const k of p.poinKunci) keluar.push(`- ${k}`)
        }
        if (p.sources?.length) {
          const teks = p.sources
            .map((x) =>
              typeof x === 'string'
                ? x
                : [x.penerbit, x.judul].filter(Boolean).join(' — ') || x.url || '',
            )
            .filter(Boolean)
          if (teks.length) keluar.push(`${t('umum.sumber')}: ${teks.join('; ')}`)
        }
        if (p.catatan) keluar.push(`${p.catatan}`)
      }
      keluar.push('')
    }

    if (i < sesi.length - 1) keluar.push('')
  })

  keluar.push(t('sesi.bagikanCatatan'))
  return keluar.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Salin teks ke papan klip.
 *
 * `navigator.clipboard` hanya tersedia di konteks aman (https atau localhost).
 * Aplikasi ini juga dijalankan di localhost saat lomba, tapi tetap ada
 * kemungkinan dibuka lewat http biasa — karena itu ada cara lama sebagai
 * cadangan. Mengembalikan true/false supaya pemanggil bisa jujur melaporkan
 * kalau penyalinan gagal, bukan mengaku berhasil.
 */
export async function salinTeks(teks) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(teks)
      return true
    }
  } catch {
    /* jatuh ke cara lama */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = teks
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '-1000px'
    document.body.appendChild(ta)
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

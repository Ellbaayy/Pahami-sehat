/**
 * Pencarian alamat dengan saran (autocomplete) + deteksi wilayah.
 * ============================================================================
 *
 * Dua mode yang DIPISAH dengan sengaja:
 *   - `saran`  : daftar kandidat saat pengguna mengetik. TIDAK memilih apa pun.
 *   - `pilih()`: pengguna menekan satu kandidat -> titik asal ditetapkan.
 *
 * KENAPA TIDAK OTOMATIS MEMILIH HASIL PERTAMA
 * -------------------------------------------
 * Nominatim mengurutkan menurut kecocokan teks, bukan kebenaran administratif.
 * Terukur: "Cikarang Selatan" mengembalikan "Permata Cikarang Selatan"
 * (perumahan) di urutan pertama. Memilih otomatis berarti menetapkan titik
 * asal pencarian di tempat yang salah tanpa pengguna pernah tahu.
 *
 * DEBOUNCE 400 ms + AbortController: tanpa itu, mengetik "jakarta" mengirim
 * delapan permintaan dan hasil yang datang tidak berurutan — daftar saran
 * berkedip ke hasil lama. Permintaan sebelumnya dibatalkan, bukan diabaikan
 * setelah datang.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const JEDA_KETIK_MS = 400

export function useAlamat() {
  const [kueri, setKueri] = useState('')
  const [saran, setSaran] = useState([])
  const [memuat, setMemuat] = useState(false)
  const [galat, setGalat] = useState(null) // {code, pesan}
  const [perluPilih, setPerluPilih] = useState(false)
  const [dipilih, setDipilih] = useState(null)
  const batalRef = useRef(null)

  /* Saran saat mengetik ------------------------------------------------ */
  useEffect(() => {
    const q = kueri.trim()
    if (q.length < 3) {
      setSaran([])
      setPerluPilih(false)
      setGalat(null)
      return
    }

    const id = setTimeout(async () => {
      batalRef.current?.abort()
      const kendali = new AbortController()
      batalRef.current = kendali
      setMemuat(true)
      setGalat(null)
      try {
        const res = await fetch(`/api/alamat/cari?q=${encodeURIComponent(q)}`, { signal: kendali.signal })
        const j = await res.json()
        if (!res.ok || !j.ok) {
          // Galat layanan BUKAN "alamat tidak ditemukan" — bedanya penting:
          // yang satu salah ketik, yang satu lagi layanan mati.
          setGalat({ code: j?.code ?? `http_${res.status}`, pesan: j?.pesan ?? null })
          setSaran([])
          return
        }
        setSaran(Array.isArray(j.hasil) ? j.hasil : [])
        setPerluPilih(Boolean(j.perluPilih))
        /*
         * Cacat yang terukur 4 Nov 2026: kondisi di sini DULU berbunyi
         * `if (!j.hasil?.length && j.code !== 'tidak_ditemukan')`, sehingga
         * justru kasus "tidak ditemukan" yang TIDAK memberi pesan apa pun.
         * Pengguna mengetik alamat ngawur dan layar tetap diam — tidak ada
         * bedanya dengan belum mengetik.
         *
         * Sekarang hasil kosong SELALU menghasilkan pesan: `tidak_ditemukan`
         * kalau server menyebutnya, atau kode galatnya kalau lain.
         */
        if (!j.hasil?.length) {
          setGalat({ code: j.code ?? 'tidak_ditemukan', pesan: j.pesan ?? null })
        } else {
          setGalat(null)
        }
      } catch (e) {
        if (e?.name === 'AbortError') return
        setGalat({ code: 'jaringan', pesan: null })
        setSaran([])
      } finally {
        if (!kendali.signal.aborted) setMemuat(false)
      }
    }, JEDA_KETIK_MS)

    return () => clearTimeout(id)
  }, [kueri])

  /**
   * Tetapkan titik asal dari satu kandidat yang DIPILIH pengguna.
   *
   * Kandidat dari Photon datang dengan `wilayah.dikenal === false`, karena
   * `state` Photon bukan nama provinsi resmi. Wilayahnya dilengkapi di sini
   * lewat geocoding balik — SATU permintaan per pemilihan, bukan per ketikan.
   * Kalau gagal, wilayah tetap `dikenal:false` dan koordinat tetap dipakai:
   * titiknya sah, hanya wilayahnya yang tidak bisa dipastikan.
   *
   * @returns {Promise<object>} kandidat yang sudah dilengkapi (atau apa adanya)
   */
  const pilih = useCallback(async (h) => {
    let hasil = h
    if (h?.perluWilayah) {
      try {
        const res = await fetch(`/api/alamat/titik?lat=${h.lat}&lon=${h.lon}`)
        const j = await res.json()
        if (res.ok && j.ok) {
          hasil = { ...h, wilayah: j.wilayah ?? h.wilayah, alamat: j.alamat ?? h.alamat }
        }
      } catch {
        // Jaringan gagal: pakai kandidat apa adanya, jangan batalkan pilihan.
      }
    }
    setDipilih(hasil)
    setSaran([])
    setPerluPilih(false)
    setGalat(null)
    return hasil
  }, [])

  const bersihkan = useCallback(() => {
    batalRef.current?.abort()
    setKueri('')
    setSaran([])
    setDipilih(null)
    setPerluPilih(false)
    setGalat(null)
  }, [])

  return {
    kueri,
    setKueri,
    saran,
    memuat,
    galat,
    perluPilih,
    dipilih,
    pilih,
    bersihkan,
  }
}

import { useCallback, useState } from 'react'

/**
 * Pemilihan wilayah administratif bertingkat.
 *
 * ATURAN RESET (disengaja, bukan kerapian): mengganti satu tingkat
 * MENGOSONGKAN semua tingkat di bawahnya. Tanpa itu, pengguna bisa berakhir
 * dengan kombinasi mustahil — mis. Provinsi Jawa Barat + kecamatan yang ada di
 * Jawa Timur — dan pencarian fasilitas akan memakai koordinat yang salah tanpa
 * ada yang menyadarinya.
 *
 * Daftar diambil dari server (`/api/wilayah`), yang mengambilnya dari
 * wilayah.id dan menyimpannya 30 hari. Komponen TIDAK menyimpan daftar
 * wilayah sendiri: satu sumber kebenaran, dan kode wilayah tidak pernah
 * dirakit di peramban.
 */

const URUT = ['provinsi', 'kabupaten', 'kecamatan', 'desa']

const KOSONG = { provinsi: null, kabupaten: null, kecamatan: null, desa: null }
const DAFTAR_KOSONG = { provinsi: [], kabupaten: [], kecamatan: [], desa: [] }

export function useWilayah() {
  const [pilihan, setPilihan] = useState(KOSONG)
  const [daftar, setDaftar] = useState(DAFTAR_KOSONG)
  const [memuat, setMemuat] = useState({})
  const [galat, setGalat] = useState(null)

  const muatTingkat = useCallback(async (tingkat, induk) => {
    setMemuat((m) => ({ ...m, [tingkat]: true }))
    setGalat(null)
    try {
      const q = tingkat === 'provinsi' ? '' : `&induk=${encodeURIComponent(induk)}`
      const res = await fetch(`/api/wilayah?tingkat=${tingkat}${q}`)
      const j = await res.json()
      if (!res.ok || !j.ok) {
        setGalat(j?.code ?? `http_${res.status}`)
        setDaftar((d) => ({ ...d, [tingkat]: [] }))
        return
      }
      setDaftar((d) => ({ ...d, [tingkat]: j.wilayah ?? [] }))
    } catch {
      setGalat('jaringan')
      setDaftar((d) => ({ ...d, [tingkat]: [] }))
    } finally {
      setMemuat((m) => ({ ...m, [tingkat]: false }))
    }
  }, [])

  /** Muat provinsi (dipanggil sekali saat panel dibuka). */
  const muatProvinsi = useCallback(() => muatTingkat('provinsi'), [muatTingkat])

  /** Pilih satu tingkat lalu muat tingkat berikutnya. */
  const pilih = useCallback(
    async (tingkat, wilayah) => {
      const posisi = URUT.indexOf(tingkat)
      if (posisi < 0) return

      // Pertahankan tingkat DI ATAS yang dipilih, kosongkan yang di bawah.
      const baru = { ...KOSONG }
      for (let i = 0; i < posisi; i += 1) baru[URUT[i]] = pilihan[URUT[i]]
      baru[tingkat] = wilayah
      setPilihan(baru)

      setDaftar((d) => {
        const berikut = { ...d }
        for (let i = posisi + 1; i < URUT.length; i += 1) berikut[URUT[i]] = []
        return berikut
      })

      const berikut = URUT[posisi + 1]
      if (berikut && wilayah?.kode) await muatTingkat(berikut, wilayah.kode)
    },
    [pilihan, muatTingkat],
  )

  const aturUlang = useCallback(() => {
    setPilihan(KOSONG)
    setDaftar(DAFTAR_KOSONG)
  }, [])

  // Minimal kecamatan: di bawah itu tidak ada titik referensi yang bisa dipakai
  // (provinsi terlalu luas untuk mencari fasilitas "terdekat").
  const terlengkap = Boolean(pilihan.kecamatan)

  return { pilihan, daftar, memuat, galat, muatProvinsi, pilih, aturUlang, terlengkap }
}

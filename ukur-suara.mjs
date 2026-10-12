/**
 * Ukur berapa lama TTS benar-benar butuh, supaya batasnya bisa dipilih dari
 * pengukuran — bukan ditebak. Ini yang menentukan MAKS_SUARA.
 */
import { buatSuara, pecahKalimat } from './app/server/suara.js'

const KALIMAT = 'Hipertensi adalah kondisi kronis yang ditandai dengan peningkatan tekanan darah arteri secara menetap. Penderita perlu mengontrol pola makan dan rutin memeriksakan tekanan darah. Segera ke dokter bila muncul nyeri dada atau sesak napas.'

for (const jumlah of [3, 6, 12, 24]) {
  const teks = Array.from({ length: jumlah }, () => KALIMAT).join(' ')
  const kalimat = pecahKalimat(teks)
  const mulai = Date.now()
  try {
    const audio = await buatSuara(teks, { bahasa: 'id' })
    const detik = (Date.now() - mulai) / 1000
    console.log(
      `${String(teks.length).padStart(5)} karakter | ${String(kalimat.length).padStart(3)} kalimat | ` +
      `${detik.toFixed(1).padStart(6)} detik | ${(audio.length / 1024).toFixed(0).padStart(5)} KB`,
    )
  } catch (e) {
    console.log(`${String(teks.length).padStart(5)} karakter | GAGAL: ${e.message}`)
  }
}
process.exit(0)

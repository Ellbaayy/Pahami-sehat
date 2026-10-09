/**
 * Pengekstrak nilai satu field string dari JSON yang SEDANG mengalir.
 *
 * Model diminta membalas JSON, jadi kalau token-nya di-stream mentah ke UI
 * yang terlihat user adalah `{"jawaban": "…` — jelek untuk video demo.
 * Kelas ini menunggu sampai kunci `jawaban` muncul, lalu mengeluarkan isinya
 * karakter demi karakter sambil menangani escape JSON yang terpotong
 * antar-chunk (termasuk `\uXXXX`).
 */

const ESCAPE = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }

export function buatEkstrak(kunci = 'jawaban') {
  const pola = new RegExp(`"${kunci}"\\s*:\\s*"`)
  let buf = ''
  let i = 0
  let dalam = false
  let esc = false
  let uni = null
  let selesai = false
  let keluar = ''

  return {
    get teks() {
      return keluar
    },
    get ketemu() {
      return dalam || selesai
    },
    get selesai() {
      return selesai
    },

    /** Umpankan potongan baru; kembalikan teks yang baru saja terurai. */
    dorong(chunk) {
      if (selesai) return '' // sudah ketemu nilai lengkapnya — abaikan sisanya
      buf += chunk
      let hasil = ''

      while (i < buf.length) {
        const c = buf[i]

        if (!dalam) {
          const m = buf.slice(i).match(pola)
          if (!m) {
            // sisakan cukup konteks supaya pola yang terbelah antar-chunk tetap ketemu
            i = Math.max(i, buf.length - 40)
            break
          }
          i += m.index + m[0].length
          dalam = true
          continue
        }

        if (uni !== null) {
          if (i + 4 > buf.length) break // tunggu 4 digit heksadesimal lengkap
          const hex = buf.slice(i, i + 4)
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            // bukan escape unicode yang sah — kembalikan apa adanya
            hasil += 'u'
            uni = null
            continue
          }
          hasil += String.fromCharCode(parseInt(hex, 16))
          i += 4
          uni = null
          continue
        }

        if (esc) {
          if (c === 'u') {
            esc = false
            uni = ''
            i++
            continue
          }
          hasil += ESCAPE[c] ?? c
          esc = false
          i++
          continue
        }

        if (c === '\\') {
          esc = true
          i++
          continue
        }

        if (c === '"') {
          selesai = true
          i++
          break
        }

        hasil += c
        i++
      }

      keluar += hasil
      return hasil
    },
  }
}

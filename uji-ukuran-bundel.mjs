/**
 * Pagar ukuran bundel: mencegah pustaka UI baru masuk tanpa disadari.
 * Batas dinaikkan HANYA dengan alasan yang ditulis di commit.
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIR = 'app/dist/app/assets'
const BATAS_KB = 520
if (!existsSync(DIR)) {
  console.log('dilewati: dist belum dibuild')
  process.exit(0)
}
const js = readdirSync(DIR).filter((f) => f.endsWith('.js'))
let terbesar = 0
let nama = ''
for (const f of js) {
  const kb = statSync(join(DIR, f)).size / 1024
  if (kb > terbesar) { terbesar = kb; nama = f }
}
console.log(`bundel terbesar: ${nama} ${terbesar.toFixed(0)} KB (batas ${BATAS_KB} KB)`)
const lulus = terbesar <= BATAS_KB
console.log(lulus ? 'ok' : 'GAGAL: bundel melewati batas')
process.exit(lulus ? 0 : 1)

#!/usr/bin/env node
/**
 * Uji modul katalog pustaka — TANPA jaringan.
 *
 * Yang dijaga:
 *   1. Sepuluh platform kesehatan yang diminta ada, terbagi 5 nasional +
 *      5 internasional, dan setiap entri punya halaman resmi untuk ditautkan.
 *   2. Enam jurnal ilmiah ada, dan setiap kanal yang dipakai memang lengkap
 *      syaratnya (rss punya url, crossref punya ISSN, pubmed punya kueri).
 *      Kalau salah satu syarat itu hilang, kanal itu akan gagal saat dijalankan
 *      — lebih baik ketahuan di sini.
 *   3. Pengurai RSS/Atom membaca judul CDATA, tautan (dua bentuk), dan tanggal
 *      dari tiga tempat berbeda (pubDate, updated, di dalam isi).
 *   4. Pengurai Crossref membaca tanggal dari `date-parts` dan menyusun tautan
 *      DOI saat `URL` tidak ada.
 *   5. Pengurai PubMed membaca pasangan esearch + esummary, termasuk DOI dari
 *      `elocationid`, dan jatuh ke tautan PubMed bila DOI tidak ada.
 *   6. Tanggal yang tidak terbaca menghasilkan null — TIDAK diganti hari ini.
 *
 * Semua contoh di bawah disalin dari balasan asli yang diukur 1 Nov 2026.
 */

import {
  SUMBER_RESMI,
  JURNAL,
  uraiRss,
  uraiCrossref,
  uraiPubmed,
  keISO,
  buangTag,
} from './app/server/pustaka.js'

let lulus = 0
let gagal = 0
const cek = (nama, syarat, catatan = '') => {
  if (syarat) {
    lulus += 1
    console.log(`  ok    ${nama}`)
  } else {
    gagal += 1
    console.log(`  GAGAL ${nama} ${catatan}`)
  }
}

/* ------------------------------------------------------------- komposisi -- */

console.log('\n== daftar platform kesehatan ==')
cek('jumlah platform = 10', SUMBER_RESMI.length === 10, `dapat ${SUMBER_RESMI.length}`)

const nasional = SUMBER_RESMI.filter((s) => s.kategori === 'nasional')
const internasional = SUMBER_RESMI.filter((s) => s.kategori === 'internasional')
cek('5 platform nasional', nasional.length === 5, `dapat ${nasional.length}`)
cek('5 platform internasional', internasional.length === 5, `dapat ${internasional.length}`)
cek(
  'nama Indonesia lengkap',
  ['Kementerian Kesehatan RI', 'Badan Pengawas Obat dan Makanan', 'Badan Kebijakan Pembangunan Kesehatan', 'Badan Riset dan Inovasi Nasional', 'SATUSEHAT'].every(
    (n) => SUMBER_RESMI.some((s) => s.nama === n),
  ),
  JSON.stringify(SUMBER_RESMI.map((s) => s.nama)),
)
cek(
  'nama internasional lengkap',
  ['WHO', 'CDC', 'NIH', 'ECDC', 'NHS'].every((singkat) =>
    SUMBER_RESMI.some((s) => s.singkat === singkat || s.nama.includes(singkat)),
  ),
)
cek('setiap platform punya situs resmi', SUMBER_RESMI.every((s) => /^https?:\/\//.test(s.situs)))
cek('id platform unik', new Set(SUMBER_RESMI.map((s) => s.id)).size === SUMBER_RESMI.length)
cek(
  'kanal yang butuh url pasti punya url',
  SUMBER_RESMI.filter((s) => ['rss', 'kemkes'].includes(s.kanal)).every((s) => /^https?:\/\//.test(s.url ?? '')),
)
cek(
  'sumber berkanal "tautan" wajib punya catatan sebabnya',
  SUMBER_RESMI.filter((s) => s.kanal === 'tautan').every((s) => (s.catatan ?? '').length > 40),
  JSON.stringify(SUMBER_RESMI.filter((s) => s.kanal === 'tautan' && (s.catatan ?? '').length <= 40).map((s) => s.id)),
)

console.log('\n== daftar jurnal ilmiah ==')
cek('jumlah jurnal = 6', JURNAL.length === 6, `dapat ${JURNAL.length}`)
cek(
  'enam jurnal yang diminta ada',
  ['PubMed', 'The Lancet', 'Nature Medicine', 'The BMJ', 'JAMA Network', 'Cochrane Library'].every((n) =>
    JURNAL.some((j) => j.nama === n),
  ),
  JSON.stringify(JURNAL.map((j) => j.nama)),
)
cek('setiap jurnal punya situs resmi', JURNAL.every((j) => /^https?:\/\//.test(j.situs)))
cek(
  'kanal crossref punya ISSN berbentuk 4-4',
  JURNAL.filter((j) => j.kanal === 'crossref').every((j) => /^\d{4}-\d{3}[\dX]$/.test(j.issn ?? '')),
)
cek(
  'kanal rss punya url',
  JURNAL.filter((j) => j.kanal === 'rss').every((j) => /^https?:\/\//.test(j.url ?? '')),
)
cek('kanal pubmed punya kueri', JURNAL.filter((j) => j.kanal === 'pubmed').every((j) => (j.kueri ?? '').length > 3))

/* ------------------------------------------------------------- pengurai -- */

console.log('\n== pengurai RSS ==')
// Bentuk asli umpan BMJ (RSS 2.0, judul CDATA).
const rssBmj = `<?xml version="1.0"?><rss><channel>
  <item rdf:about="http://www.bmj.com/content/395/bmj-2026-101301.short">
    <title><![CDATA[Thousands of patients deleted from referral service]]></title>
    <link>https://www.bmj.com/content/395/bmj-2026-101301</link>
    <description><![CDATA[<p>Patients waiting for care were dropped.</p>]]></description>
    <pubDate>Fri, 30 Oct 2026 09:00:00 GMT</pubDate>
  </item>
  <item><title>Tanpa judul?</title></item>
</channel></rss>`
const hasilBmj = uraiRss(rssBmj)
cek('judul CDATA bersih', hasilBmj[0]?.judul === 'Thousands of patients deleted from referral service', hasilBmj[0]?.judul)
cek('tautan RSS terbaca', hasilBmj[0]?.tautan === 'https://www.bmj.com/content/395/bmj-2026-101301', hasilBmj[0]?.tautan)
cek('tanggal RFC822 jadi ISO', hasilBmj[0]?.tanggal === '2026-10-30', hasilBmj[0]?.tanggal)
cek('ringkasan tanpa tag', !/[<>]/.test(hasilBmj[0]?.ringkas ?? '<'), hasilBmj[0]?.ringkas)

// Bentuk asli umpan Nature: tanggal hanya ada di dalam <content:encoded>.
const rssNature = `<rss><channel><item>
  <title><![CDATA[Climate change threatens malaria elimination]]></title>
  <link>https://www.nature.com/articles/s41591-026-04722-x</link>
  <content:encoded><![CDATA[<p>Nature Medicine, Published online: 30 October 2026; <a href="x">doi:10.1038/s41591-026-04722-x</a></p>]]></content:encoded>
</item></channel></rss>`
cek('tanggal dari dalam isi terbaca', uraiRss(rssNature)[0]?.tanggal === '2026-10-30', uraiRss(rssNature)[0]?.tanggal)

// Bentuk Atom: <link href="..."/>
const atom = `<feed><entry>
  <title>Judul Atom</title>
  <link href="https://contoh.test/a"/>
  <updated>2026-10-29T10:00:00Z</updated>
</entry></feed>`
const hasilAtom = uraiRss(atom)
cek('tautan bentuk Atom terbaca', hasilAtom[0]?.tautan === 'https://contoh.test/a', hasilAtom[0]?.tautan)
cek('tanggal ISO dari <updated>', hasilAtom[0]?.tanggal === '2026-10-29', hasilAtom[0]?.tanggal)
cek('batas jumlah butir dihormati', uraiRss(rssBmj, 1).length === 1)

console.log('\n== pengurai Crossref ==')
const crossref = {
  message: {
    items: [
      {
        title: ['WHO should adjust its cervical cancer plan'],
        published: { 'date-parts': [[2026, 10]] },
        DOI: '10.1016/s0140-6736(26)02045-3',
        'container-title': ['The Lancet'],
        author: [{ family: 'Kang' }, { family: 'Nauck' }],
      },
      { title: ['Tanpa tanggal'], DOI: '10.1/x' },
    ],
  },
}
const hasilCr = uraiCrossref(crossref)
cek('judul Crossref terbaca', hasilCr[0]?.judul === 'WHO should adjust its cervical cancer plan', hasilCr[0]?.judul)
cek('tanggal tanpa hari jadi tanggal 1', hasilCr[0]?.tanggal === '2026-10-01', hasilCr[0]?.tanggal)
cek('tautan DOI disusun saat URL tidak ada', hasilCr[0]?.tautan === 'https://doi.org/10.1016/s0140-6736(26)02045-3', hasilCr[0]?.tautan)
cek('penulis digabung', hasilCr[0]?.penulis === 'Kang, Nauck', hasilCr[0]?.penulis)
cek('jurnal terbaca', hasilCr[0]?.jurnal === 'The Lancet', hasilCr[0]?.jurnal)
cek('butir tanpa tanggal -> null, bukan hari ini', hasilCr[1]?.tanggal === null, hasilCr[1]?.tanggal)
cek('balasan rusak tidak melempar', uraiCrossref('{bukan json').length === 0)

console.log('\n== pengurai PubMed ==')
const esearch = { esearchresult: { idlist: ['42960860', '42954433'] } }
const esummary = {
  result: {
    42960860: {
      title: 'Living evidence map of the global climate and health literature.',
      pubdate: '2026 Oct 30',
      source: 'Cochrane Database Syst Rev',
      elocationid: 'doi: 10.1002/14651858.CD016408',
      authors: [{ name: 'Metzendorf MI' }, { name: 'Callaghan M' }],
    },
    42954433: {
      title: 'Tanpa DOI',
      pubdate: '2026 Oct 29',
      source: 'Cochrane Database Syst Rev',
      elocationid: '',
      authors: [],
    },
  },
}
const hasilPm = uraiPubmed(esearch, esummary)
cek('judul PubMed terbaca', hasilPm[0]?.judul === 'Living evidence map of the global climate and health literature', hasilPm[0]?.judul)
cek('tanggal "2026 Oct 30" jadi ISO', hasilPm[0]?.tanggal === '2026-10-30', hasilPm[0]?.tanggal)
cek('DOI diambil dari elocationid', hasilPm[0]?.tautan === 'https://doi.org/10.1002/14651858.CD016408', hasilPm[0]?.tautan)
cek('tanpa DOI jatuh ke tautan PubMed', hasilPm[1]?.tautan === 'https://pubmed.ncbi.nlm.nih.gov/42954433/', hasilPm[1]?.tautan)
cek('jurnal PubMed terbaca', hasilPm[0]?.jurnal === 'Cochrane Database Syst Rev', hasilPm[0]?.jurnal)
cek('balasan rusak tidak melempar', uraiPubmed('x', 'y').length === 0)

console.log('\n== util tanggal & teks ==')
cek('ISO tetap ISO', keISO('2026-11-01') === '2026-11-01')
cek('tanggal Indonesia panjang terbaca', keISO('30 Oktober 2026') === '2026-10-30', keISO('30 Oktober 2026'))
cek('teks ngawur -> null', keISO('kemarin sore') === null)
cek('kosong -> null', keISO('') === null)
cek('buangTag membersihkan entitas', buangTag('a &amp; b <b>c</b>') === 'a & b c', buangTag('a &amp; b <b>c</b>'))

console.log('')
console.log(gagal === 0 ? `SEMUA LULUS — ${lulus} pemeriksaan` : `${lulus} lulus, ${gagal} GAGAL`)
process.exit(gagal === 0 ? 0 : 1)

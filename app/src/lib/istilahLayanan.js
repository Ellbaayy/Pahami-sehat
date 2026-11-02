/**
 * Istilah layanan medis dari tag OpenStreetMap -> istilah Indonesia.
 *
 * KENAPA PERLU: `healthcare:speciality` di OSM berisi istilah Inggris
 * berhierarki, mis. "acupuncture;allergology;anaesthetics;...". Ditampilkan
 * mentah, kolom "Layanan" jadi tembok kata asing yang tidak berguna bagi
 * pengguna Indonesia — padahal itu justru informasi yang dicari.
 *
 * ATURAN:
 *   - Istilah yang tidak ada di peta DITAMPILKAN APA ADANYA, bukan dibuang.
 *     Membuangnya menyembunyikan layanan yang mungkin penting (mis. subspesialis
 *     langka); menerjemahkan dengan tebakan malah mengarang.
 *   - Hanya diterjemahkan bila padanannya jelas. "anatomy" bukan "bedah".
 */

const PETA = {
  acupuncture: 'Akupunktur',
  allergology: 'Alergi & Imunologi',
  anaesthetics: 'Anestesi',
  anaesthesiology: 'Anestesi',
  anatomy: 'Anatomi',
  andrology: 'Andrologi',
  'anti-aging-medicine': 'Anti Penuaan',
  audiology: 'Audiologi',
  'bariatric-surgery': 'Bedah Bariatrik',
  'biological-hematology': 'Hematologi',
  cardiology: 'Jantung',
  'cardiothoracic-surgery': 'Bedah Jantung & Toraks',
  'clinical-chemistry': 'Kimia Klinik',
  'clinical-genetics': 'Genetika Klinik',
  'clinical-microbiology': 'Mikrobiologi Klinik',
  'clinical-pharmacology': 'Farmakologi Klinik',
  'colorectal-surgery': 'Bedah Kolorektal',
  'community-health': 'Kesehatan Masyarakat',
  'community-medicine': 'Kedokteran Komunitas',
  'critical-care': 'Perawatan Intensif',
  'craniofacial-surgery': 'Bedah Kraniofasial',
  cytology: 'Sitologi',
  'dental-oral-and-maxillofacial-surgery': 'Bedah Mulut & Maksilofasial',
  dermatology: 'Kulit & Kelamin',
  diabetology: 'Diabetes',
  'diagnostic-radiology': 'Radiologi Diagnostik',
  dietetics: 'Dietetik',
  'emergency-medicine': 'Kedokteran Gawat Darurat',
  endocrinology: 'Endokrinologi',
  'endocrinology-and-metabolism': 'Endokrinologi & Metabolisme',
  'family-medicine': 'Kedokteran Keluarga',
  gastroenterology: 'Gastroenterologi',
  'general-medicine': 'Penyakit Dalam Umum',
  'general-surgery': 'Bedah Umum',
  geriatrics: 'Geriatri',
  gynaecology: 'Ginekologi',
  gynaecology_and_obstetrics: 'Obstetri & Ginekologi',
  haematology: 'Hematologi',
  'hand-surgery': 'Bedah Tangan',
  hepatology: 'Hepatologi',
  immunology: 'Imunologi',
  'infectious-diseases': 'Penyakit Infeksi',
  'internal-medicine': 'Penyakit Dalam',
  'interventional-radiology': 'Radiologi Intervensi',
  'maxillofacial-surgery': 'Bedah Maksilofasial',
  'medical-genetics': 'Genetika Medis',
  'medical-microbiology': 'Mikrobiologi Medis',
  'medical-oncology': 'Onkologi Medis',
  'medical-physics': 'Fisika Medis',
  neonatology: 'Neonatologi',
  nephrology: 'Nefrologi',
  neurology: 'Saraf',
  neuropsychiatry: 'Neuropsikiatri',
  'neurosurgery': 'Bedah Saraf',
  'nuclear-medicine': 'Kedokteran Nuklir',
  nursing: 'Keperawatan',
  nutrition: 'Gizi',
  obstetrics: 'Obstetri',
  'occupational-medicine': 'Kedokteran Kerja',
  oncology: 'Onkologi',
  ophthalmology: 'Mata',
  orthodontics: 'Ortodonti',
  orthopaedics: 'Ortopedi',
  'oral-and-maxillofacial-surgery': 'Bedah Mulut & Maksilofasial',
  otolaryngology: 'THT',
  'otorhinolaryngology': 'THT',
  paediatrics: 'Anak',
  paediatric_surgery: 'Bedah Anak',
  'pain-medicine': 'Manajemen Nyeri',
  palliative: 'Paliatif',
  pathology: 'Patologi',
  'physical-therapy': 'Fisioterapi',
  physiotherapy: 'Fisioterapi',
  'plastic-surgery': 'Bedah Plastik',
  psychiatry: 'Jiwa',
  'public-health': 'Kesehatan Masyarakat',
  'radiation-oncology': 'Onkologi Radiasi',
  radiotherapy: 'Radioterapi',
  'reconstructive-surgery': 'Bedah Rekonstruksi',
  rehabilitation: 'Rehabilitasi Medis',
  'respiratory-medicine': 'Paru',
  pulmonology: 'Paru',
  rheumatology: 'Reumatologi',
  'sports-medicine': 'Kedokteran Olahraga',
  'thoracic-surgery': 'Bedah Toraks',
  'tropical-medicine': 'Kedokteran Tropis',
  'urology': 'Urologi',
  'vascular-surgery': 'Bedah Vaskular',
  'veterinary': 'Kedokteran Hewan',
  dentistry: 'Kedokteran Gigi',
  'dental-hygiene': 'Kebersihan Gigi',
  periodontics: 'Periodonsia',
  prosthodontics: 'Prostodonsia',
  endodontics: 'Konservasi Gigi',
  'oral-surgery': 'Bedah Mulut',
  'pediatric-dentistry': 'Kedokteran Gigi Anak',
  'general-practice': 'Praktik Umum',
  'general-practitioner': 'Dokter Umum',
  midwifery: 'Kebidanan',
}

/**
 * Terjemahkan satu istilah OSM. `null` bila tidak ada padanan yang jelas —
 * pemanggil yang memutuskan menampilkannya apa adanya.
 */
export function terjemahkanLayanan(istilah) {
  const k = String(istilah ?? '').trim().toLowerCase().replace(/\s+/g, '-')
  if (!k) return null
  return PETA[k] ?? null
}

/**
 * Ubah nilai `layanan` dari server (dipisah koma) menjadi kalimat Indonesia.
 *
 * Istilah yang tidak dikenal tetap ditampilkan, dalam bentuk aslinya, di
 * ujung daftar — pengguna lebih baik melihat istilah asing daripada layanan
 * yang hilang tanpa penjelasan.
 */
export function rapikanLayanan(nilai) {
  if (!nilai) return null
  const bagian = String(nilai)
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  if (!bagian.length) return null
  const dikenal = []
  const asing = []
  for (const b of bagian) {
    const t = terjemahkanLayanan(b)
    if (t) dikenal.push(t)
    else asing.push(b)
  }
  const semua = [...new Set([...dikenal, ...asing])]
  return semua.join(', ')
}

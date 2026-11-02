/**
 * Warna per kategori fasilitas.
 *
 * Dipisah dari komponen peta karena dua alasan: dipakai di DUA tempat (penanda
 * peta dan titik warna di daftar), dan berkas komponen hanya boleh mengekspor
 * komponen supaya Fast Refresh tidak membuang keadaan saat disunting.
 *
 * Warna dipilih dari palet yang kontrasnya lolos WCAG AA di atas putih, dan
 * cukup berbeda untuk dibedakan tanpa membaca label.
 */
export const WARNA_KATEGORI = {
  'rumah-sakit': '#b91c1c',
  puskesmas: '#0e7490',
  klinik: '#1d4ed8',
  'praktik-mandiri': '#6d28d9',
  farmasi: '#15803d',
  laboratorium: '#b45309',
  'penunjang-medis': '#7c3aed',
  'kesehatan-masyarakat': '#0f766e',
  tradisional: '#4d7c0f',
  khusus: '#be185d',
}

export const WARNA_LOKASI = '#0f766e'

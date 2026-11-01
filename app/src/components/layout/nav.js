import { Home, Sparkles, ShieldCheck, History, ClipboardList, Settings } from 'lucide-react'

/**
 * Konfigurasi menu — satu sumber kebenaran untuk rail dan drawer.
 *
 * "Sederhanakan", "Suara", dan "Pindai Foto" TIDAK lagi di sini: ketiganya
 * sekarang jadi bagian dari Tanya AI (mode di komposer, tombol mikrofon, dan
 * tombol kamera), supaya pengguna tidak perlu berpindah halaman untuk memakai
 * kemampuan yang sama-sama berujung pada teks.
 */
export const NAV_ITEMS = [
  { id: 'beranda', kunci: 'nav.beranda', label: 'Beranda', icon: Home },
  { id: 'tanya', kunci: 'nav.tanya', label: 'Tanya AI', icon: Sparkles },
  { id: 'verifikasi', kunci: 'nav.verifikasi', label: 'Cek Klaim', icon: ShieldCheck },
  { id: 'riwayat', kunci: 'nav.riwayat', label: 'Riwayat', icon: History },
  { id: 'kuesioner', kunci: 'nav.kuesioner', label: 'Kuesioner', icon: ClipboardList },
  { id: 'pengaturan', kunci: 'nav.pengaturan', label: 'Pengaturan', icon: Settings },
]

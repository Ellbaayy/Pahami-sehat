import { Home, Sparkles, Wand2, ShieldCheck, Mic, History, ClipboardList, Settings } from 'lucide-react'

/** Konfigurasi menu — satu sumber kebenaran untuk rail, drawer, dan bottom nav. */
export const NAV_ITEMS = [
  { id: 'beranda', kunci: 'nav.beranda', label: 'Beranda', icon: Home },
  { id: 'tanya', kunci: 'nav.tanya', label: 'Tanya AI', icon: Sparkles },
  { id: 'sederhanakan', kunci: 'nav.sederhanakan', label: 'Sederhanakan', icon: Wand2 },
  { id: 'verifikasi', kunci: 'nav.verifikasi', label: 'Cek Klaim', icon: ShieldCheck },
  { id: 'suara', kunci: 'nav.suara', label: 'Suara', icon: Mic },
  { id: 'riwayat', kunci: 'nav.riwayat', label: 'Riwayat', icon: History },
  { id: 'kuesioner', kunci: 'nav.kuesioner', label: 'Kuesioner', icon: ClipboardList },
  { id: 'pengaturan', kunci: 'nav.pengaturan', label: 'Pengaturan', icon: Settings },
]

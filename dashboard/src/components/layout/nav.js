import { Home, Sparkles, Mic, History, ClipboardList, Settings } from 'lucide-react'

/** Konfigurasi menu — satu sumber kebenaran untuk rail, drawer, dan bottom nav. */
export const NAV_ITEMS = [
  { id: 'beranda', label: 'Beranda', icon: Home },
  { id: 'tanya', label: 'Tanya AI', icon: Sparkles },
  { id: 'suara', label: 'Suara', icon: Mic },
  { id: 'riwayat', label: 'Riwayat', icon: History },
  { id: 'kuesioner', label: 'Kuesioner', icon: ClipboardList },
  { id: 'pengaturan', label: 'Pengaturan', icon: Settings },
]

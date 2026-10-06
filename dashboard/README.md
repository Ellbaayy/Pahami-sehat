# Dashboard — Pahami Sehat

Frontend dashboard untuk platform edukasi kesehatan **Pahami Sehat**.
Seluruh data adalah **dummy/static**; tidak ada backend, database, API, atau autentikasi.

## Stack

- React 19 + Vite 8
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Lucide React (ikon)
- Arsitektur komponen reusable, tanpa dependensi UI lain

## Menjalankan

```bash
npm install          # pakai --include=dev bila NODE_ENV=production
npm run dev          # dev server
npm run build        # hasil build -> dist/
npm run preview      # pratinjau hasil build
```

## Struktur

```
src/
├── App.jsx                        state global + routing antar panel
├── index.css                      design token (@theme) + utilitas global
├── data/dummy.js                  seluruh data statis
├── components/
│   ├── layout/                    Sidebar, TopBar, MobileDrawer, nav
│   ├── ui/primitives.jsx          Card, Button, SectionHeading, Skeleton,
│   │                              EmptyState, SourcePills
│   └── dashboard/                 Greeting, AskAI, TopicChips, ArticleGrid,
│                                  HealthTip, RecentHistory, VoicePanel,
│                                  QuizPanel, SettingsPanel, ThreadPanel
└── assets/                        logo + font lokal (tanpa CDN)
```

## Catatan responsive

- `<768px`  : top header + navigation drawer, konten satu kolom
- `768–1023`: sidebar rail icon-only
- `≥1024`   : sidebar penuh 240px
- Grid artikel & panel memakai `auto-fit + minmax`, jadi jumlah kolom
  mengikuti ruang yang tersedia, bukan breakpoint kaku
- Tipografi, padding, dan gap memakai `clamp()`
- Konten dibatasi `max-width: 86rem` agar tidak melebar berlebihan
  di monitor ultrawide

## Aksesibilitas

Semantic HTML, skip link, keyboard navigation dengan focus ring,
`aria-current` / `aria-pressed` / `aria-expanded` / `role=switch` /
`role=radiogroup`, drawer dengan focus trap + Escape, kontras teks ≥ 4.5:1,
target sentuh ≥ 40px di layar sentuh, dan dukungan `prefers-reduced-motion`.

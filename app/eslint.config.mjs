/**
 * Konfigurasi ESLint — gerbang mutu kode.
 *
 * ============================================================================
 * KENAPA ATURANNYA SEDIKIT, DAN BUKAN "recommended" SEMUA
 * ============================================================================
 *
 * Tujuan konfigurasi ini BUKAN membuat kode tampak rapi, melainkan menangkap
 * kesalahan yang tidak terlihat dari build hijau dan tidak tertangkap uji.
 * Dua contoh nyata dari riwayat proyek ini:
 *
 *   - `ThreadPanel` pernah menulis `sumber={[]}` sehingga seluruh sumber
 *     dilabeli "ditemukan, belum dikutip" walaupun model mengembalikannya.
 *     Variabel yang ditulis tetapi tidak pernah dibaca adalah pola awalnya.
 *   - `document.querySelector('main')` bisa null saat halaman masih memuat,
 *     dan itu hanya ketahuan saat pengukuran tata letak menghasilkan angka
 *     palsu.
 *
 * Aturan GAYA (indentasi, tanda kutip, urutan impor) sengaja TIDAK dipasang:
 * proyek ini belum punya gaya baku, dan menambahkan ratusan pelanggaran gaya
 * sekaligus akan membuat gerbang ini dimatikan orang — gerbang yang dimatikan
 * lebih buruk daripada tidak ada gerbang. Kalau nanti mau, tambahkan Prettier
 * terpisah dan jalankan sekali untuk merapikan seluruh berkas.
 *
 * Pemakaian:  npm run lint
 *             npm run lint:perbaiki   (memperbaiki yang bisa diperbaiki sendiri)
 */

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  /* ------------------------------------------------------------- abaikan -- */
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      // berkas OCR pihak ketiga yang disalin apa adanya
      'public/ocr/**',
      // hasil salinan halaman penjelasan saat build
      'public/prototipe/**',
    ],
  },

  /* ------------------------------------------------------------ bersama -- */
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...js.configs.recommended.rules,

      // --- kesalahan yang benar-benar berbahaya -------------------------
      // Variabel/fungsi yang ditulis tetapi tidak pernah dibaca. Ini pola
      // awal dari `sumber={[]}` yang pernah membuat fitur sumber jawaban
      // menampilkan label yang salah.
      'no-unused-vars': [
        'error',
        {
          args: 'after-used',
          // argumen yang sengaja tidak dipakai boleh diawali garis bawah
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          // `const { rahasia, ...sisa } = objek` adalah pola SAH untuk membuang
          // field sebelum objeknya dikirim ke pengguna (lihat `konten.js`:
          // `sidik`, `sumberHalaman`, dan `geser` sengaja dibuang). Tanpa opsi
          // ini, ketiganya dilaporkan sebagai variabel mati padahal justru
          // pembuangannya yang penting.
          ignoreRestSiblings: true,
        },
      ],

      // Perbandingan longgar (== bukan ===) menyembunyikan bug tipe.
      eqeqeq: ['error', 'smart'],

      // `console.log` yang tertinggal di kode peramban ikut terkirim ke
      // pengguna. Di sisi server, log memang dipakai — lihat blok di bawah.
      'no-console': 'warn',

      // Pola yang hampir selalu bug, bukan pilihan gaya.
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-duplicate-case': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-constant-binary-expression': 'error',
      'no-template-curly-in-string': 'error',
      'no-unmodified-loop-condition': 'error',
      'require-atomic-updates': 'error',

      // Promise yang tidak ditunggu = galat yang hilang diam-diam.
      'no-async-promise-executor': 'error',
      'no-promise-executor-return': 'error',
    },
  },

  /* ------------------------------------------------------- kode peramban -- */
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Dua aturan React yang menangkap bug nyata, bukan selera:
      //  - rules-of-hooks: hook dipanggil bersyarat -> urutan state kacau
      //  - exhaustive-deps: efek memakai nilai yang tidak ada di daftar
      //    dependensi -> efek berjalan dengan nilai basi
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Berkas komponen hanya boleh mengekspor komponen, supaya hot-reload
      // Vite tidak kehilangan status saat menyunting.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // di peramban tidak ada `process`/`require`
      'no-restricted-globals': [
        'error',
        { name: 'process', message: 'Kode peramban tidak punya `process`. Pakai import.meta.env.' },
      ],
    },
  },

  /* ------------------------------- hook berbahasa Indonesia (proyek ini) -- */
  {
    /**
     * `lib/useBahasa.js` dan `lib/useSuara.js` mengekspor hook sah dengan nama
     * berbahasa Indonesia: `gunakanBahasa`, `gunakanSuara`.
     *
     * `rules-of-hooks` hanya mengenali fungsi yang diawali "use". Hook yang
     * benar dilaporkan sebagai "Hook called in function that is neither a
     * component nor a custom hook" — 13 pelanggaran palsu.
     *
     * Kenapa TIDAK diganti nama: seluruh antarmuka, komentar, dan nama berkas
     * proyek ini berbahasa Indonesia, dan mengganti nama berarti menyentuh
     * setiap pemanggil hanya demi konvensi penamaan berbahasa Inggris. Yang
     * dipilih: aturan itu dimatikan HANYA di dua berkas ini, dengan alasan
     * tertulis. Di berkas lain aturan tetap hidup, jadi hook yang dipanggil
     * bersyarat di dalam komponen tetap tertangkap.
     *
     * Kalau nanti nama hook-nya diganti menjadi `use*`, blok ini harus DIHAPUS
     * — bukan dibiarkan, supaya kelonggarannya tidak menular tanpa sadar.
     */
    files: ['src/lib/useBahasa.js', 'src/lib/useSuara.js'],
    rules: {
      'react-hooks/rules-of-hooks': 'off',
    },
  },

  /* --------------------------------------------------------- kode server -- */
  {
    files: ['server/**/*.js', 'api/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Di server, log memang alat kerja — yang dilarang hanya `console.debug`
      // dan `console.trace` yang biasanya tertinggal dari proses menelusuri.
      'no-console': ['error', { allow: ['log', 'warn', 'error', 'info'] }],
    },
  },

  /* --------------------------- penulisan state setelah await (server) ---- */
  {
    /**
     * `require-atomic-updates` dimatikan untuk EMPAT berkas server, masing-
     * masing dengan penjaga yang bisa diperiksa di berkasnya sendiri:
     *
     *   - `konten.js`      : `sedangMengambil` (janji) — badan IIFE jalan sekali
     *   - `berita.js`      : `ringkasBerjalan` (janji) — sama
     *   - `cari.js`        : `lewatAntrean()` — SEMUA pemanggilan lewat rantai
     *                        `antrean` yang sama, jadi `terakhirPanggil` hanya
     *                        disentuh satu tugas pada satu waktu
     *   - `db.js` (tutupDb): hanya dipanggil saat proses berhenti, satu kali
     *
     * Penanda boolean (`bisaTulisBerkas`, `ringkasBisaTulis`) idempoten —
     * menulis nilai yang sama dua kali tidak mengubah apa pun.
     *
     * `rute.js` dan `db()` TIDAK ikut di sini: keduanya sudah dibereskan dengan
     * kunci janji sungguhan (`sedangUkur`, `menyambung`), karena di situ
     * balapannya nyata — health bisa memanggil layanan model berkali-kali, dan
     * `db()` bisa meninggalkan pool menggantung.
     *
     * Kalau salah satu penjaga di atas dihapus, HAPUS berkas itu dari daftar
     * ini dan pasang kunci yang benar. Jangan biarkan kelonggarannya menutupi
     * bug sungguhan.
     */
    files: ['server/konten.js', 'server/berita.js', 'server/cari.js', 'server/db.js'],
    rules: {
      'require-atomic-updates': 'off',
    },
  },

  /* --------------------------------------------- berkas uji di akar repo -- */
  {
    files: ['../uji-*.mjs', '../ukur-*.mjs', '../periksa-*.mjs', '../verifikasi-*.mjs', '../panen-*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Skrip uji memang mencetak hasilnya ke layar.
      'no-console': 'off',
    },
  },
]

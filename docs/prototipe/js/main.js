/* =========================================================
   Pahami Sehat — interaksi frontend (semuanya simulasi lokal)
   Tanpa backend, tanpa database, tanpa API.
   ========================================================= */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ---------------- navbar: stuck + hamburger + scroll-spy ---------------- */
  const navbar = $('#navbar');
  const navToggle = $('#navToggle');
  const navLinks = $('#navLinks');

  const onScroll = () => {
    navbar.classList.toggle('is-stuck', window.scrollY > 8);
    const toTop = $('#toTop');
    if (toTop) toTop.classList.toggle('is-show', window.scrollY > 600);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
  });
  navLinks.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      navLinks.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    }
  });

  const sections = $$('main section[id]');
  const navAnchors = $$('.nav-links a[href^="#"]');
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navAnchors.forEach((a) =>
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id)
        );
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sections.forEach((s) => spy.observe(s));

  /* ---------------- reveal on scroll ---------------- */
  const revealer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-in');
          obs.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  $$('.reveal').forEach((el) => revealer.observe(el));

  $('#toTop').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  $$('[data-scroll]').forEach((b) =>
    b.addEventListener('click', () => {
      const t = $(b.dataset.scroll);
      if (t) t.scrollIntoView({ behavior: 'smooth' });
    })
  );

  /* ---------------- 1. penerjemah bahasa medis ---------------- */
  const medText = $('#medText');
  const gradePill = $('#gradePill');
  const translateOut = $('#translateOut');
  const translateResult = $('#translateResult');
  let level = 'anak';
  const TARGET = { anak: 6, remaja: 9, dewasa: 12, lansia: 8 };
  const TARGET_LABEL = {
    anak: 'kelas 6 (anak-anak)',
    remaja: 'kelas 9 (remaja)',
    dewasa: 'kelas 12 (dewasa)',
    lansia: 'kelas 8 (lansia)'
  };

  /* ukur tingkat baca — Flesch-Kincaid, dikalibrasi untuk bahasa Indonesia:
     skala Inggris ±1,5 suku/kata vs Indonesia ±2,4 → faktor 0,6,
     supaya teks medis (setara "kelas 12,8" pada data SKI 2023) jatuh di rentang wajar.
     Catatan: Flesch-grade mengukur KERUMITAN teks, bukan usia pembaca — karena itu
     tingkat "lansia" ditargetkan lebih sederhana (≈ kelas 8), bukan lebih rumit. */
  const FAKTOR_ID = 0.6;
  function hitungSukuKata(kata) {
    const m = kata.toLowerCase().match(/[aiueo]+/g);
    return m ? m.length : 1;
  }
  function fleschGrade(teks) {
    const kalimat = teks.split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
    const kata = (teks.match(/\S+/g) || [])
      .map((w) => w.replace(/[^0-9a-zA-Z]+/g, ''))
      .filter(Boolean);
    if (!kalimat.length || kata.length < 5) return null;
    const suku = kata.reduce((s, w) => s + hitungSukuKata(w), 0);
    const raw = 0.39 * (kata.length / kalimat.length) + 11.8 * (suku / kata.length) - 15.59;
    return Math.max(1, raw * FAKTOR_ID);
  }

  const PETA = {
    anak: {
      grade: 'Tingkat baca anak-anak (= 5.2)',
      hasil:
        'Tekanan darah tinggi artinya darah menekan dinding pembuluh darah terlalu kuat. Kalau dibiarkan, jantung jadi capek bekerja.',
      flesch: 'Flesch-grade: 5.2'
    },
    remaja: {
      grade: 'Tingkat baca remaja (= 8.1)',
      hasil:
        'Hipertensi adalah kondisi saat tekanan darah di arteri terus-menerus lebih tinggi dari batas normal. Tanpa penanganan, jantung dan pembuluh darah dipaksa bekerja lebih keras.',
      flesch: 'Flesch-grade: 8.1'
    },
    dewasa: {
      grade: 'Tingkat baca dewasa (= 10.7)',
      hasil:
        'Hipertensi merupakan kondisi kronis yang ditandai tekanan darah arteri persisten di atas ambang batas normal, sehingga meningkatkan beban kerja jantung dan dinding pembuluh darah.',
      flesch: 'Flesch-grade: 10.7'
    },
    lansia: {
      grade: 'Tingkat baca lansia (= 7.4)',
      hasil:
        'Darah tinggi adalah kondisi saat tekanan darah di pembuluh darah terus berada di atas batas normal. Bila dibiarkan, jantung dan pembuluh darah bekerja lebih berat dari seharusnya.',
      flesch: 'Flesch-grade: 7.4'
    }
  };

  /* pilih tingkat baca — berlaku untuk panel "Langkah 1" & demo penerjemah */
  function setLevel(lv, jalankanUlang) {
    level = lv;
    $$('.seg-btn[data-level]').forEach((b) => b.classList.toggle('is-active', b.dataset.level === lv));
    if (jalankanUlang && !translateResult.hidden) runTranslate();
  }
  $$('.seg-btn[data-level]').forEach((b) =>
    b.addEventListener('click', () => setLevel(b.dataset.level, true))
  );

  const decChip = $('#decChip');
  const decNote = $('#decNote');

  async function runTranslate() {
    const teks = medText.value.trim();
    const btn = $('#translateBtn');
    if (!teks) {
      medText.focus();
      medText.placeholder = 'Isi dulu teksnya ya…';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Memproses…';
    translateResult.hidden = false;
    decChip.className = 'decision-chip is-wait';
    decChip.textContent = '⏳ cek…';
    decNote.textContent = 'Mengukur tingkat baca teks input…';
    translateOut.textContent = 'Menerapkan rubric prompting…';
    await wait(650);

    const p = PETA[level];
    const target = TARGET[level];
    const awal = fleschGrade(teks);
    const lolos = awal !== null && awal <= target;

    if (!lolos) {
      /* titik keputusan: keterbacaan ≤ target? TIDAK → loop balik */
      decChip.className = 'decision-chip is-no';
      decChip.textContent = 'Tidak';
      decNote.textContent =
        awal === null
          ? 'Teks terlalu pendek untuk diukur → proses ulang dengan rubric prompting…'
          : 'Perkiraan tingkat input: kelas ' + awal.toFixed(1) + ' > target ' + TARGET_LABEL[level] + ' → proses ulang…';
      translateOut.textContent = 'Belum memenuhi target tingkat baca — memproses ulang…';
      await wait(750);
    }

    translateOut.textContent = p.hasil;
    gradePill.textContent = p.grade;
    decChip.className = 'decision-chip is-yes';
    decChip.textContent = lolos ? 'Ya ✓' : 'Ya ✓ (1× loop)';
    decNote.textContent = lolos
      ? 'Tingkat input: kelas ' + awal.toFixed(1) + ' ≤ target ' + TARGET_LABEL[level] + ' — langsung lolos.'
      : 'Hasil (simulasi): ' + p.grade + ' ≤ target ' + TARGET_LABEL[level] + ' — loop balik selesai.';

    btn.disabled = false;
    btn.textContent = 'Sederhanakan';
  }
  $('#translateBtn').addEventListener('click', runTranslate);

  /* --- tombol DENGAR (TTS) pada hasil terjemahan --- */
  const hearBtn = $('#hearBtn');
  hearBtn.addEventListener('click', () => {
    const isi = translateOut.textContent.trim();
    if (!isi) return;
    if (!('speechSynthesis' in window)) {
      hearBtn.textContent = '🔊 TTS tidak tersedia';
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      hearBtn.textContent = '🔊 Dengar hasil';
      return;
    }
    try {
      const u = new SpeechSynthesisUtterance(isi);
      u.lang = 'id-ID';
      u.onend = () => (hearBtn.textContent = '🔊 Dengar hasil');
      window.speechSynthesis.speak(u);
      hearBtn.textContent = '⏹ Hentikan';
    } catch (e) {
      hearBtn.textContent = '🔊 TTS tidak tersedia';
    }
  });

  /* --- input foto (OCR simulasi) & rekam suara --- */
  const CONTOH_OCR =
    'Hasil laboratorium: kolesterol total 245 mg/dL (normal < 200), LDL 160 mg/dL, HDL 38 mg/dL, trigliserida 210 mg/dL.';
  const CONTOH_SUARA = 'Dok, tekanan darah saya 150/95. Perlu minum obat terus tidak ya?';
  const inputToolNote = $('#inputToolNote');
  const voiceToolBtn = $('#voiceToolBtn');
  let recAktif = null;

  $('#ocrInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    medText.value = CONTOH_OCR;
    inputToolNote.textContent = 'Foto "' + f.name + '" → teks hasil OCR (simulasi) dimasukkan.';
  });

  voiceToolBtn.addEventListener('click', () => {
    if (recAktif) {
      try {
        recAktif.stop();
      } catch (err) {
        inputToolNote.textContent = 'Perekaman sudah berhenti.';
      }
      recAktif = null;
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      medText.value = CONTOH_SUARA;
      inputToolNote.textContent = 'Peramban tanpa SpeechRecognition — contoh teks suara (simulasi) dimasukkan.';
      return;
    }
    try {
      const rec = new SR();
      recAktif = rec;
      rec.lang = 'id-ID';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (ev) => {
        medText.value = ev.results[0][0].transcript;
        inputToolNote.textContent = 'Teks dari suara diterima.';
      };
      rec.onerror = () => {
        medText.value = CONTOH_SUARA;
        inputToolNote.textContent = 'Suara tidak terdeteksi/ditolak — contoh teks suara (simulasi) dimasukkan.';
      };
      rec.onend = () => {
        recAktif = null;
        voiceToolBtn.textContent = '🎤 Rekam suara';
      };
      voiceToolBtn.textContent = '● Berhenti';
      inputToolNote.textContent = 'Mendengarkan… bicara sekarang (klik lagi untuk berhenti).';
      rec.start();
    } catch (err) {
      recAktif = null;
      medText.value = CONTOH_SUARA;
      inputToolNote.textContent = 'SpeechRecognition gagal — contoh teks suara (simulasi) dimasukkan.';
    }
  });

  /* ---------------- 2. mode suara ---------------- */
  const micBtn = $('#micBtn');
  const waveform = $('#waveform');
  const voiceStatus = $('#voiceStatus');
  const voiceAnswer = $('#voiceAnswer');
  let listening = false;

  micBtn.addEventListener('click', async () => {
    if (listening) return;
    listening = true;
    micBtn.classList.add('is-live');
    micBtn.setAttribute('aria-pressed', 'true');
    waveform.classList.add('is-live');
    voiceStatus.textContent = 'Mendengarkan… (simulasi)';
    voiceAnswer.hidden = true;
    await wait(2200);
    waveform.classList.remove('is-live');
    micBtn.classList.remove('is-live');
    micBtn.setAttribute('aria-pressed', 'false');
    listening = false;
    voiceStatus.textContent = 'Selesai mendengarkan — jawaban siap dibacakan.';
    voiceAnswer.hidden = false;
  });

  $('#playBtn').addEventListener('click', () => {
    const kalimat =
      'Demam berdarah adalah infeksi yang dibawa nyamuk dan bisa menurunkan angka sel darah. Bila demam tinggi lebih dari tiga hari, segera periksa ke fasilitas kesehatan.';
    voiceStatus.textContent = 'Membacakan jawaban… (simulasi TTS)';
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(kalimat);
        u.lang = 'id-ID';
        u.onend = () => (voiceStatus.textContent = 'Selesai dibacakan.');
        window.speechSynthesis.speak(u);
      } catch (e) {
        voiceStatus.textContent = 'TTS tidak tersedia di peramban ini — teks tetap ditampilkan.';
      }
    } else {
      voiceStatus.textContent = 'TTS tidak tersedia di peramban ini — teks tetap ditampilkan.';
    }
  });

  $('#voiceLang').addEventListener('change', (e) => {
    voiceStatus.textContent = 'Bahasa: ' + e.target.value + ' (simulasi istilah lokal)';
  });

  /* ---------------- 3. mode hemat sinyal + titik keputusan sinyal ---------------- */
  const offSwitch = $('#offlineSwitch');

  function renderSignal() {
    const hemat = offSwitch.getAttribute('aria-checked') === 'true';
    const online = navigator.onLine !== false;
    const pakaiCache = hemat || !online;
    $('#branchOff').classList.toggle('is-active', pakaiCache);
    $('#branchOn').classList.toggle('is-active', !pakaiCache);
    $('#signalNow').innerHTML =
      'Status perangkat: <strong>' +
      (online ? 'ada sinyal' : 'tidak ada sinyal') +
      '</strong> · mode hemat sinyal: <strong>' +
      (hemat ? 'aktif' : 'mati') +
      '</strong> → konten diambil <strong>' +
      (pakaiCache ? 'dari cache' : 'versi terbaru') +
      '</strong>.';
  }
  window.addEventListener('online', renderSignal);
  window.addEventListener('offline', renderSignal);

  offSwitch.addEventListener('click', () => {
    const on = offSwitch.getAttribute('aria-checked') !== 'true';
    offSwitch.setAttribute('aria-checked', String(on));
    $$('#offlineList li').forEach((li, i) => {
      setTimeout(() => {
        li.classList.toggle('is-on', on);
        if (on) li.setAttribute('data-tip', li.dataset.on);
      }, i * 160);
    });
    $('#offlineVisual').classList.toggle('is-off', !on);
    $('#offlineVisual').querySelector('span:last-child').textContent = on
      ? 'Mode hemat sinyal aktif — konten tersimpan di perangkat'
      : 'Tetap bisa diakses tanpa internet';
    renderSignal();
  });
  renderSignal();

  /* ---------------- 4. verifikasi sumber (cabang SESUAI / TIDAK DITEMUKAN) ---------------- */
  const TOPIK_RESMI = [
    'imunisasi', 'vaksin', 'dbd', 'demam berdarah', 'polio', 'campak',
    'hipertensi', 'tekanan darah', 'diabetes', 'gizi', 'obat', 'kolesterol',
    'flu', 'ispa', 'diare', 'asma', 'tbc', 'jantung'
  ];
  const PENANDA_HOAKS = [
    'menyembuhkan semua', 'ajaib', '100%', 'tanpa efek samping', 'bikin steril',
    'konspirasi', 'khasiat mujarab', 'dilarang dokter', 'rahasia dokter', 'big pharma'
  ];
  const JUDUL_SUMBER = {
    imunisasi: 'Kemenkes RI — Imunisasi',
    vaksin: 'Kemenkes RI — Imunisasi',
    dbd: 'Kemenkes RI — Demam Berdarah',
    'demam berdarah': 'Kemenkes RI — Demam Berdarah',
    polio: 'Kemenkes RI — Polio',
    campak: 'Kemenkes RI — Campak',
    hipertensi: 'Kemenkes RI — Hipertensi',
    'tekanan darah': 'Kemenkes RI — Hipertensi',
    diabetes: 'Kemenkes RI — Diabetes Melitus',
    gizi: 'Kemenkes RI — Gizi',
    kolesterol: 'Kemenkes RI — Kolesterol',
    flu: 'Kemenkes RI — ISPA & Flu',
    ispa: 'Kemenkes RI — ISPA & Flu',
    diare: 'Kemenkes RI — Diare',
    asma: 'Kemenkes RI — Asma',
    tbc: 'Kemenkes RI — TBC',
    jantung: 'Kemenkes RI — Penyakit Jantung',
    obat: 'BPOM — Informasi Obat'
  };

  function potongTeks(s, n) {
    return s.length > n ? s.slice(0, n).trim() + '…' : s;
  }

  $('#verifyBtn').addEventListener('click', async () => {
    const btn = $('#verifyBtn');
    const res = $('#verifyResult');
    const teks = $('#verifyText').value.trim();
    if (!teks) {
      $('#verifyText').focus();
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Memeriksa…';
    res.hidden = false;
    res.classList.remove('is-not');
    $('#vrYes').hidden = true;
    $('#vrNo').hidden = true;
    res.style.opacity = '.5';
    await wait(750);

    const t = teks.toLowerCase();
    const adaResmi = TOPIK_RESMI.some((k) => t.includes(k));
    const adaHoaks = PENANDA_HOAKS.some((k) => t.includes(k));

    if (adaResmi && !adaHoaks) {
      /* VERDICT: SESUAI + kutipan sumber */
      const kunci = TOPIK_RESMI.find((k) => t.includes(k));
      const url = kunci === 'obat' ? 'https://www.pom.go.id' : 'https://www.kemkes.go.id';
      $('#vrSrcTitle').textContent = JUDUL_SUMBER[kunci] || 'Kemenkes RI — Dokumen resmi';
      $('#vrSrcCard').setAttribute('href', url);
      $('#vrSrcUrl').textContent = url.replace('https://www.', '');
      $('#vrYesNote').textContent =
        'Kutipan: "' + potongTeks(teks, 80) + '" · Confidence 0.94 · 3 dokumen acuan (simulasi RAG).';
      $('#vrYes').hidden = false;
    } else {
      /* VERDICT: TIDAK DITEMUKAN + arahkan ke sumber resmi */
      $('#vrNoNote').textContent = adaHoaks
        ? 'Kalimat ini mengandung klaim tanpa bukti di dokumen resmi — tidak bisa dipastikan. Arahkan ke sumber resmi:'
        : 'Informasi tidak ditemukan di indeks dokumen Kemenkes / WHO / BPOM. Arahkan ke sumber resmi:';
      $('#vrNo').hidden = false;
      res.classList.add('is-not');
    }

    res.style.opacity = '1';
    btn.disabled = false;
    btn.textContent = 'Cek Info Ini';
  });

  /* ---------------- dasbor mockup: topik + navigasi ---------------- */
  const JAWABAN = {
    Demam: 'Demam adalah tanda tubuh sedang melawan infeksi. Minum cukup air, istirahat, dan periksa ke fasilitas kesehatan bila di atas 38,5°C atau berlangsung lebih dari 3 hari.',
    Hipertensi: 'Tekanan darah normal dewasa sekitar 120/80 mmHg. Angka 130/85 ke atas perlu dipantau, dan 140/90 ke atas termasuk hipertensi.',
    Diabetes: 'Diabetes membuat gula darah terlalu tinggi. Pola mola seimbang, gerak rutin, dan kontrol gula berkala membantu mengendalikannya.',
    Obat: 'Ikuti anjuran pada label atau resep dokter. Sebagian obat lebih aman diminum sesudah makan untuk menghindari gangguan lambung.',
    Imunisasi: 'Imunisasi melindungi anak dari penyakit berat. Jadwal lengkap ada pada buku KIA dan dapat diperiksa di puskesmas terdekat.',
    Gizi: 'Isi piring seimbang: karbohidrat, protein, sayur, buah, dan air putih yang cukup. Kurangi gula, garam, dan minuman manis.',
    'Kesehatan Mental': 'Kesehatan mental sama pentingnya dengan fisik. Bila suasana hati terus menurun atau sulit tidur, bicarakan dengan tenaga kesehatan.'
  };

  const appAnswer = $('#appAnswer');
  function tanya(topic) {
    appAnswer.hidden = false;
    appAnswer.innerHTML =
      '<strong>' +
      topic +
      '</strong> — ' +
      (JAWABAN[topic] || JAWABAN.Demam) +
      '<span class="aa-src">Sumber: Kemenkes RI · WHO · BPOM (simulasi RAG)</span>';
  }

  $$('#topicChips .chip').forEach((c) =>
    c.addEventListener('click', () => {
      $$('#topicChips .chip').forEach((x) => x.classList.remove('is-active'));
      c.classList.add('is-active');
      tanya(c.dataset.topic);
    })
  );

  $('#askForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('#askInput').value.trim();
    appAnswer.hidden = false;
    appAnswer.innerHTML = v
      ? '<strong>Simulasi AI:</strong> "' +
        v +
        '" — jawaban sederhana sedang disusun dari dokumen resmi, lengkap dengan kutipan sumbernya.'
      : 'Tulis pertanyaan dulu, atau pilih salah satu topik populer di bawah.';
  });

  $$('#appNav button').forEach((b) =>
    b.addEventListener('click', () => {
      $$('#appNav button').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
    })
  );

  /* ---------------- mockup mobile: tahan untuk bicara ---------------- */
  const phMic = $('#phMic');
  const phStatus = $('#phStatus');
  const phAnswer = $('#phAnswer');
  let phBusy = false;
  phMic.addEventListener('click', async () => {
    if (phBusy) return;
    phBusy = true;
    phMic.classList.add('is-live');
    phStatus.textContent = 'Mendengarkan…';
    phAnswer.hidden = true;
    await wait(2000);
    phMic.classList.remove('is-live');
    phStatus.textContent = 'Suara diterima (simulasi)';
    phAnswer.hidden = false;
    phAnswer.textContent =
      'Jawaban dibacakan dengan suara: ‘Tekan untuk bicara’ bekerja tanpa server, memakai Web Speech API perangkat.';
    phBusy = false;
  });

  $$('#quickChips .chip').forEach((c) =>
    c.addEventListener('click', () => {
      $$('#quickChips .chip').forEach((x) => x.classList.remove('is-active'));
      c.classList.add('is-active');
      phStatus.textContent = 'Pertanyaan cepat terkirim';
      phAnswer.hidden = false;
      phAnswer.textContent = JAWABAN[c.dataset.topic] || JAWABAN.Demam;
    })
  );

  /* hero card chips → scroll ke fitur + isi teks */
  $$('.hero-card-chips .chip').forEach((c) =>
    c.addEventListener('click', () => {
      $('#fitur').scrollIntoView({ behavior: 'smooth' });
      medText.value =
        'Saya sering mengalami ' +
        c.dataset.topic.toLowerCase() +
        ', apakah perlu periksa ke dokter?';
      setTimeout(runTranslate, 700);
    })
  );

  /* ---------------- panel alur: sinkron bahasa + pilihan bantuan ---------------- */
  const startLang = $('#startLang');
  const voiceLangSel = $('#voiceLang');

  startLang.addEventListener('change', () => {
    voiceLangSel.value = startLang.value;
    voiceStatus.textContent = 'Bahasa: ' + startLang.value + ' (dipilih di langkah 1 alur)';
  });
  voiceLangSel.addEventListener('change', () => {
    startLang.value = voiceLangSel.value;
  });

  $$('.start-choice').forEach((b) =>
    b.addEventListener('click', () => {
      $$('.start-choice').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      const target = $(b.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => {
        if (b.dataset.tool === 'translate') medText.focus({ preventScroll: true });
        if (b.dataset.tool === 'verify') $('#verifyText').focus({ preventScroll: true });
      }, 700);
    })
  );

  /* ---------------- kuesioner HLS-SF12 (simulasi) ---------------- */
  const SOAL = [
    { q: 'Seberapa mudah Anda memahami informasi kesehatan yang Anda baca?', a: ['Sangat mudah', 'Mudah', 'Agak sulit', 'Sulit'] },
    { q: 'Seberapa sering Anda menemukan informasi kesehatan yang bisa dipercaya?', a: ['Selalu', 'Sering', 'Kadang-kadang', 'Jarang'] },
    { q: 'Bila butuh info kesehatan, seberapa mudah menemukannya?', a: ['Sangat mudah', 'Mudah', 'Agak sulit', 'Sulit'] },
    { q: 'Seberapa mudah memahami saran dari tenaga kesehatan?', a: ['Sangat mudah', 'Mudah', 'Agak sulit', 'Sulit'] },
    { q: 'Seberapa yakin Anda bisa mengecek kebenaran suatu info kesehatan?', a: ['Sangat yakin', 'Yakin', 'Kurang yakin', 'Tidak yakin'] }
  ];
  const SKOR = [4, 3, 2, 1]; // indeks jawaban → poin
  let idx = 0;
  const jawaban = new Array(SOAL.length).fill(null);

  const quizQ = $('#quizQ');
  const quizOpts = $('#quizOpts');
  const quizCount = $('#quizCount');
  const quizProgress = $('#quizProgress');
  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');

  function renderSoal() {
    const s = SOAL[idx];
    quizQ.textContent = s.q;
    quizCount.textContent = 'Soal ' + (idx + 1) + ' dari ' + SOAL.length;
    quizProgress.style.width = ((idx + 1) / SOAL.length) * 100 + '%';
    quizOpts.innerHTML = '';
    s.a.forEach((teks, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = teks;
      if (jawaban[idx] === i) b.classList.add('is-picked');
      b.addEventListener('click', () => {
        jawaban[idx] = i;
        $$('#quizOpts button').forEach((x) => x.classList.remove('is-picked'));
        b.classList.add('is-picked');
      });
      quizOpts.appendChild(b);
    });
    prevBtn.disabled = idx === 0;
    nextBtn.textContent = idx === SOAL.length - 1 ? 'Lihat hasil' : 'Berikutnya →';
  }

  prevBtn.addEventListener('click', () => {
    if (idx > 0) {
      idx--;
      renderSoal();
    }
  });

  nextBtn.addEventListener('click', async () => {
    if (jawaban[idx] === null) {
      quizOpts.firstElementChild.focus();
      quizQ.textContent = SOAL[idx].q + '  (pilih salah satu jawaban dulu)';
      return;
    }
    if (idx < SOAL.length - 1) {
      idx++;
      renderSoal();
      return;
    }
    // selesai → hitung skor simulasi
    const total = jawaban.reduce((s, v, i) => s + (v === null ? 0 : SKOR[v]), 0);
    const pct = Math.round((total / (SOAL.length * 4)) * 100);
    // skala demo: jawaban "sedang" (pilihan ke-2) menghasilkan 72% → "Sedang"
    const hasil = Math.max(45, Math.min(95, Math.round(pct * 0.6 + 27)));
    const result = $('#quizResult');
    result.hidden = false;
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    const donut = $('#donut');
    let n = 0;
    donut.style.setProperty('--p', 0);
    await wait(120);
    const step = setInterval(() => {
      n += 3;
      if (n >= hasil) {
        n = hasil;
        clearInterval(step);
      }
      donut.style.setProperty('--p', n);
      $('#donutVal').textContent = n + '%';
    }, 24);

    const label = hasil >= 80 ? 'Baik' : hasil >= 60 ? 'Sedang' : 'Perlu dukungan';
    $('#donutLabel').innerHTML = 'Literasi Kesehatan Anda: <strong>' + label + '</strong>';
    const SARAN = {
      Baik: 'Pertahankan! Tetap verifikasi setiap info ke sumber resmi (Kemenkes, WHO, BPOM) sebelum dibagikan.',
      Sedang:
        'Sudah cukup baik. Coba fitur Terjemahkan & Cek Info untuk berita kesehatan yang rumit, dan gunakan tombol Dengar agar lebih mudah dipahami.',
      'Perlu dukungan':
        'Mulai dari tingkat baca anak-anak dan mode suara agar hasil dibacakan untuk Anda. Ulangi kuesioner ini sebulan lagi untuk melihat perkembangan.'
    };
    const saranText = $('#saranText');
    saranText.hidden = false;
    saranText.innerHTML = '<strong>Saran:</strong> ' + SARAN[label];
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  $('#retryBtn').addEventListener('click', () => {
    idx = 0;
    jawaban.fill(null);
    nextBtn.disabled = false;
    prevBtn.disabled = false;
    $('#quizResult').hidden = true;
    $('#saranText').hidden = true;
    $('#donutVal').textContent = '0%';
    renderSoal();
    $('.quiz').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  renderSoal();
})();

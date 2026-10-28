/* Cari Jawaban Soal — aplikasi statis untuk GitHub Pages (tanpa server). */
(function () {
  'use strict';
  const C = window.CSCrypto, IMP = window.CSImport;
  const $ = (id) => document.getElementById(id);
  const show = (el, on) => el.classList.toggle('hidden', !on);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ====================== KONFIGURASI ====================== */
  const MIN_SCORE = 0.70, SHOW_FIRST = 8, MAX_PARTS = 50, SESSION_MS = 2 * 60 * 60 * 1000;
  const MSG_OK = 'ONOK IKI JAWABANE DI WOCO SEK YA WEDI SALAH';
  const MSG_BAD = 'GAK ENEK OJOK MOKSO PICEK TA MATAMU WKWKWK!!!!MAKANE BELAJAR!! BEN PINTER';
  const NEGATION = new Set(['tidak', 'bukan', 'kecuali', 'tanpa', 'jangan', 'belum', 'salah', 'not', 'no']);
  const ADMIN_CONTACT = ['hasanbasribalqisshanumdiandrab@gmail.com', 'putrarafian01@gmail.com'];
  const AI_DEFAULT = { gemini: 'gemini-2.5-flash', claude: 'claude-haiku-5-5' };

  /* ====================== PENYIMPANAN BROWSER (aman bila diblokir) ====================== */
  const mk = (kind) => ({
    get(k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window[kind].setItem(k, v); } catch (e) { /* diblokir */ } },
    del(k) { try { window[kind].removeItem(k); } catch (e) { /* diblokir */ } },
  });
  const ls = mk('localStorage'), ss = mk('sessionStorage');

  /* ====================== STATE ====================== */
  let KEYS = null, DEK = null, SESS = null;
  let META = null, ENT = [], exactMap = new Map(), LOCAL_ADDED = 0;
  let tickT = null, LAST = null;

  const tokenize = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean);
  const sortedKey = (t) => [...t].sort().join(' ');
  const normA = (s) => tokenize(s).join(' ');

  /* ====================== PENYIMPANAN LOKAL (tambahan Excel di perangkat ini) ====================== */
  function idb() {
    return new Promise((res, rej) => {
      if (typeof indexedDB === 'undefined') return rej(new Error('no idb'));
      const r = indexedDB.open('cari-soal-github', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idbGet() { try { const d = await idb(); return await new Promise((res) => { const q = d.transaction('kv').objectStore('kv').get('user'); q.onsuccess = () => res(q.result || []); q.onerror = () => res([]); }); } catch (e) { return []; } }
  async function idbSet(v) { try { const d = await idb(); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, 'user'); t.oncomplete = res; t.onerror = () => rej(t.error); }); return true; } catch (e) { return false; } }

  /* ====================== BANK SOAL ====================== */
  function indexBank(entries) {
    ENT = []; exactMap = new Map();
    for (const e of entries) {
      const tk = tokenize(e[0]); const x = { id: ENT.length, q: e[0], answers: e.slice(1), tk, key: sortedKey(tk) };
      ENT.push(x); const l = exactMap.get(x.key); if (l) l.push(x); else exactMap.set(x.key, [x]);
    }
  }
  /** Tambah pasangan baru. Soal yang SUDAH ADA dilewati (isi data lama tidak diubah). */
  function addPairs(pairs) {
    let added = 0, skipped = 0; const fresh = [];
    for (const [q0, a0] of pairs) {
      const q = String(q0).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(), a = String(a0).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      if (!q || !a || /^soal$/i.test(q) || /^jawaban$/i.test(a)) continue;
      if (/^question\s*\d+$/i.test(q) || /^right answer\s*\d+$/i.test(a)) continue;
      const tk = tokenize(q); if (tk.length < 2) continue;
      const key = sortedKey(tk), ex = exactMap.get(key);
      if (ex) {
        if (ex[0].fromUpload && !ex[0].answers.some((x) => normA(x) === normA(a))) ex[0].answers.push(a);   // jawaban lain dari unggahan yang sama
        else skipped++;
      } else {
        const e = { id: ENT.length, q, answers: [a], tk, key, fromUpload: true };
        ENT.push(e); exactMap.set(key, [e]); added++; fresh.push([q, a]);
      }
    }
    return { added, skipped, fresh };
  }
  function updateCounts() {
    $('statusTxt').textContent = 'Siap · ' + ENT.length.toLocaleString('id-ID') + ' soal';
    $('srcN').textContent = ENT.length.toLocaleString('id-ID');
    $('srcLocal').textContent = LOCAL_ADDED.toLocaleString('id-ID');
    if (META) { $('srcName').textContent = META.source; $('srcDate').textContent = META.built; }
  }
  async function loadBank() {
    show($('prog'), true); $('progBar').style.width = '15%';
    $('status').className = 'chip'; $('statusTxt').textContent = 'Membuka bank soal…';
    if (!window.CS_BANK) throw new Error('File data/bank.js tidak ditemukan di hosting.');
    await new Promise((r) => setTimeout(r, 20));
    $('progBar').style.width = '40%';
    const D = await C.decryptBank(C.unb64(window.CS_BANK), DEK);
    $('progBar').style.width = '80%';
    META = D.meta; indexBank(D.e);
    const st = await idbGet(); LOCAL_ADDED = 0;
    if (st.length) LOCAL_ADDED = addPairs(st).added;
    $('progBar').style.width = '100%'; setTimeout(() => show($('prog'), false), 300);
    $('status').className = 'chip ready'; updateCounts();
  }

  /* ====================== PEMBERSIH & PEMECAH SOAL ====================== */
  function cleanQuery(t) {
    t = t.replace(/\r/g, '').replace(/\u00a0/g, ' ');
    t = t.replace(/(the\s+correct\s+answers?\s+(is|are)|jawaban\s+(yang\s+)?(benar|tepat)\s+(adalah|ialah)|right\s+answers?\s*:|correct\s+answer\s*:|kunci\s+jawaban)[\s\S]*$/i, ' ');
    t = t.replace(/clear my choice|hapus pilihan saya/gi, ' ');
    t = t.replace(/(^|\n)[ \t]*question text[ \t]*(?=\n|$)/gi, '\n');
    t = t.replace(/(^|\s)(question|pertanyaan)\s*\d+/gi, ' ');
    t = t.replace(/not yet answered|belum dijawab|answer saved|marked out of\s*[\d.,]+|points? out of\s*[\d.,]+|flag question|remove flag|tandai pertanyaan|nilai maksimal\s*[\d.,]+/gi, ' ');
    t = t.replace(/select one( or more)?\s*:?|pilih satu( atau lebih)?\s*:?|pilih salah satu\s*:?/gi, ' ');
    t = t.replace(/(^|\n)\s*[a-eA-E][\.\)]\s+/g, '\n');
    return t;
  }
  function splitQuestions(raw) {
    const t = raw.replace(/\r/g, '').replace(/\u00a0/g, ' ');
    const seg = t.split(/clear my choice|hapus pilihan saya/i).map((x) => x.trim()).filter((x) => x.length >= 10);
    if (seg.length >= 2) return seg.slice(0, MAX_PARTS);
    const re = /(?:^|\n)[ \t]*(?:question|pertanyaan|soal)[ \t]*(\d+)/gi, marks = []; let m, last = null;
    while ((m = re.exec(t))) { if (m[1] !== last) { marks.push(m.index); last = m[1]; } }
    if (marks.length >= 2) {
      if (marks[0] > 25 && /^\s*(question|pertanyaan|soal)\s*\d+\s*select one/i.test(t.slice(marks[0]))) marks[0] = 0;
      return marks.map((s, i) => t.slice(s, marks[i + 1] ?? t.length).trim()).filter((x) => x.length > 5).slice(0, MAX_PARTS);
    }
    const lines = t.split('\n'), starts = []; let expect = 1;
    lines.forEach((ln, i) => { const mm = ln.match(/^\s*(\d{1,3})\s*[\.\)]\s+\S/); if (mm && +mm[1] === expect && ln.trim().length >= 25) { starts.push(i); expect++; } });
    if (starts.length >= 2) return starts.map((s, i) => lines.slice(s, starts[i + 1] ?? lines.length).join('\n').trim()).slice(0, MAX_PARTS);
    const blocks = t.split(/\n\s*\n+/).map((x) => x.trim()).filter(Boolean);
    if (blocks.length >= 2 && blocks.filter((b) => b.length >= 25).length >= 2) return blocks.slice(0, MAX_PARTS);
    return [t.trim()];
  }

  /* ====================== PENCARIAN ====================== */
  function features(toks) {
    const nums = new Map(), neg = new Map();
    for (const t of toks) { if (/^\d+$/.test(t)) nums.set(t, (nums.get(t) || 0) + 1); if (NEGATION.has(t)) neg.set(t, (neg.get(t) || 0) + 1); }
    return { nums, neg };
  }
  const sameMap = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
  function scoreOf(qTok, eTok, qf) {
    const m = new Map(); for (const t of eTok) m.set(t, (m.get(t) || 0) + 1);
    let inter = 0;
    for (const t of qTok) { const c = m.get(t); if (c) { inter++; m.set(t, c - 1); } }
    const nq = qTok.length, ne = eTok.length, dice = 2 * inter / (nq + ne), cont = inter / nq;
    let score = Math.max(dice, cont * (nq >= 8 ? 0.99 : nq >= 4 ? 0.9 : 0.75));
    const ef = features(eTok);
    if (!sameMap(qf.nums, ef.nums)) score = Math.min(score * 0.88, 0.97);   // angka beda → bisa berlawanan makna
    if (!sameMap(qf.neg, ef.neg)) score = Math.min(score * 0.85, 0.97);     // kata negasi beda
    return { score, dice };
  }
  function searchText(raw) {
    const qTok = tokenize(cleanQuery(raw));
    if (!qTok.length) return { mode: 'empty', items: [] };
    const ex = exactMap.get(sortedKey(qTok));
    if (ex) return { mode: 'exact', items: ex.map((e) => ({ ...e, score: 1 })), total: ex.length };
    const qf = features(qTok), scored = [];
    for (const e of ENT) { const s = scoreOf(qTok, e.tk, qf); if (s.score >= MIN_SCORE) scored.push({ ...e, ...s }); }
    scored.sort((a, b) => b.score - a.score || b.dice - a.dice);
    return scored.length ? { mode: 'similar', items: scored, total: scored.length } : { mode: 'none', items: [], total: 0 };
  }

  /* ====================== TAMPILAN HASIL ====================== */
  function splitQ(q) {
    const semi = q.indexOf('; ');
    if (semi > 0) { const col = q.lastIndexOf(': ', semi); if (col > 0) return { stem: q.slice(0, col + 1), opts: q.slice(col + 2).split('; ') }; }
    return { stem: q, opts: [] };
  }
  const pctOf = (s) => (s >= 0.9999 ? 100 : Math.min(99, Math.floor(s * 100)));
  const topAnswerText = (it) => it.answers.join(' / ');
  const ansBlock = (answers, label) => answers.map((a, i) => '<div class="ans"><div class="grow"><div class="lbl">' + (label || 'Jawaban') + (answers.length > 1 ? ' ' + (i + 1) : '') + '</div><div class="val">' + esc(a) + '</div></div><button class="copy" data-copy="' + esc(a) + '">Salin</button></div>').join('');
  function card(it, idx) {
    const { stem, opts } = splitQ(it.q), ansN = new Set(it.answers.map(normA)), p = pctOf(it.score);
    const optsHtml = opts.length ? '<div class="sec">Pilihan</div><ul class="opts">' + opts.map((o) => '<li class="' + (ansN.has(normA(o)) ? 'ok' : '') + '">' + esc(o) + '</li>').join('') + '</ul>' : '';
    return '<article class="card res' + (idx === 0 ? ' top' : '') + '"><div class="badges"><span class="pill' + (p === 100 ? ' p100' : '') + '">' + p + '% mirip teks</span>' +
      (idx === 0 ? '<span class="tag">⭐ paling mirip</span>' : '<span class="tag">#' + (idx + 1) + '</span>') + '</div>' +
      ansBlock(it.answers) + '<div class="sec">Soal</div><p class="q">' + esc(stem) + '</p>' + optsHtml +
      (idx === 0 ? '<div class="warnbox">Persentase = kemiripan teks, bukan jaminan jawabannya benar. Cek kembali bila soal tampak sedikit berbeda.</div>' : '') + '</article>';
  }
  const shortText = (text, n) => { const c = cleanQuery(text).replace(/\s+/g, ' ').trim(); return c.length > n ? c.slice(0, n) + '…' : c; };
  const noneCard = (i, text) => '<article class="card res none"><div class="badges"><span class="pill bad">Tidak ada di bank soal</span></div><p class="q">' + esc(shortText(text, 220)) + '</p><button class="btn btn-sm" data-ai="' + i + '">🤖 Tanya Referensi AI</button><div data-aibox="' + i + '"></div></article>';

  function renderAll() {
    const out = $('out');
    if (!LAST || !LAST.parts.length) { out.innerHTML = ''; return; }
    const { parts, multi } = LAST; let html = '';
    if (multi) {
      const found = parts.filter((p) => p.res.items.length).length;
      html += '<div class="info-line">Terbaca <b>' + parts.length + '</b> soal · ditemukan <b>' + found + '</b>' + (found < parts.length ? ' · tidak ada <b>' + (parts.length - found) + '</b>' : '') + ' · jawaban diurut sesuai soal yang dikirim</div>';
      const plain = parts.map((p, i) => (i + 1) + '. ' + (p.res.items.length ? topAnswerText(p.res.items[0]) : '(tidak ada di bank soal)')).join('\n');
      html += '<article class="card res top sum"><div class="badges"><span class="pill p100">📋 Ringkasan jawaban</span><button class="copy" data-copy="' + esc(plain) + '">Salin semua</button></div><ol>' +
        parts.map((p, i) => '<li class="' + (p.res.items.length ? '' : 'miss') + '"><span class="n">' + (i + 1) + '.</span><span class="t">' + (p.res.items.length ? esc(topAnswerText(p.res.items[0])) + ' <small class="tag">(' + pctOf(p.res.items[0].score) + '%)</small>' : 'tidak ada di bank soal') + '</span></li>').join('') + '</ol></article>';
    }
    parts.forEach((p, i) => {
      html += '<div class="group">';
      if (multi) html += '<div class="ghead"><b>Soal ' + (i + 1) + '</b><span class="qs">' + esc(shortText(p.text, 110)) + '</span></div>';
      const r = p.res;
      if (!r.items.length) html += noneCard(i, p.text);
      else {
        if (!multi) html += '<div class="info-line">' + (r.mode === 'exact' ? '✅ Isi kata <b>sama persis</b> — hanya jawaban yang cocok ditampilkan.' : '🟢 Tidak ada yang persis. Menampilkan <b>' + r.total + '</b> soal paling mirip (tertinggi di atas).') + '</div>';
        const limit = multi ? 1 : SHOW_FIRST;
        html += r.items.slice(0, p.showAll ? r.items.length : limit).map(card).join('');
        if (!p.showAll && r.items.length > limit) html += '<button class="btn btn-sm more" data-more="' + i + '">Lihat ' + (r.items.length - limit) + ' yang mirip lainnya</button>';
        html += '<div data-aibox="' + i + '"></div>';
      }
      html += '</div>';
    });
    out.innerHTML = html;
    out.querySelectorAll('[data-more]').forEach((b) => { b.onclick = () => { LAST.parts[+b.dataset.more].showAll = true; renderAll(); }; });
    out.querySelectorAll('[data-ai]').forEach((b) => { b.onclick = () => runAI(+b.dataset.ai); });
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    (navigator.clipboard ? navigator.clipboard.writeText(b.dataset.copy) : Promise.resolve()).then(() => { const t = b.textContent; b.textContent = 'Tersalin ✓'; setTimeout(() => { b.textContent = t; }, 1200); }).catch(() => {});
  });

  /* ====================== POP-UP (tidak menutup sendiri) ====================== */
  function popup(found, answerHtml, sub) {
    $('pop').className = 'pop ' + (found ? 'good' : 'bad');
    $('popIco').textContent = found ? '✅' : '❌';
    $('popTxt').textContent = found ? MSG_OK : MSG_BAD;
    show($('popAns'), !!answerHtml); $('popAns').innerHTML = answerHtml || '';
    $('popSub').textContent = sub || '';
    $('ov').classList.add('show');
  }
  const closePop = () => $('ov').classList.remove('show');
  $('popOk').onclick = closePop;
  $('ov').addEventListener('click', (e) => { if (e.target === $('ov')) closePop(); });
  function popupFor(L) {
    const found = L.parts.filter((p) => p.res.items.length);
    if (!found.length) return popup(false, '', '');
    const disc = 'Persentase = kemiripan teks, bukan jaminan jawaban benar.';
    if (!L.multi) { const t = found[0].res.items[0]; return popup(true, esc(topAnswerText(t)) + '<small>' + pctOf(t.score) + '% mirip teks' + (pctOf(t.score) === 100 ? ' (isi kata sama persis)' : '') + '</small>', disc); }
    const lines = L.parts.map((p, i) => p.res.items.length ? (i + 1) + '. ' + esc(topAnswerText(p.res.items[0])) + ' <small style="display:inline">(' + pctOf(p.res.items[0].score) + '%)</small>' : (i + 1) + '. <small style="display:inline">tidak ada</small>').join('<br>');
    popup(true, lines, 'Ditemukan ' + found.length + ' dari ' + L.parts.length + ' soal. ' + disc);
  }

  /* ====================== AI (API key milik pengguna, dari browser) ====================== */
  const getAi = () => { try { return JSON.parse(ls.get('cs_ai') || 'null'); } catch (e) { return null; } };
  const refreshAi = () => { const c = getAi(); $('aiState').textContent = c && c.key ? (c.provider === 'claude' ? 'Claude' : 'Gemini') + ' · aktif' : 'belum aktif'; };
  $('aiBtn').onclick = () => { const c = getAi() || { provider: 'gemini', key: '', model: '' }; $('aiProv').value = c.provider; $('aiKey').value = c.key; $('aiModel').value = c.model || ''; $('aiModel').placeholder = AI_DEFAULT[c.provider]; $('ovAi').classList.add('show'); };
  $('aiProv').onchange = () => { $('aiModel').placeholder = AI_DEFAULT[$('aiProv').value]; };
  $('aiClose').onclick = () => $('ovAi').classList.remove('show');
  $('aiSave').onclick = () => { ls.set('cs_ai', JSON.stringify({ provider: $('aiProv').value, key: $('aiKey').value.trim(), model: $('aiModel').value.trim() })); refreshAi(); $('ovAi').classList.remove('show'); };
  $('aiOff').onclick = () => { ls.del('cs_ai'); refreshAi(); $('ovAi').classList.remove('show'); };

  async function callAI(system, parts) {            // parts: [{text}] atau [{image:{mime,data}},{text}]
    const c = getAi(); if (!c || !c.key) throw new Error('NOKEY');
    const model = c.model || AI_DEFAULT[c.provider];
    if (c.provider === 'claude') {
      const content = parts.map((p) => p.image ? { type: 'image', source: { type: 'base64', media_type: p.image.mime, data: p.image.data } } : { type: 'text', text: p.text });
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': c.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model, max_tokens: 1500, system, messages: [{ role: 'user', content }] }) });
      const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
      return j.content.map((x) => x.text || '').join('').trim();
    }
    const gp = parts.map((p) => p.image ? { inline_data: { mime_type: p.image.mime, data: p.image.data } } : { text: p.text });
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': c.key }, body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: gp }] }) });
    const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || 'HTTP ' + r.status);
    return ((j.candidates || [])[0].content.parts || []).map((x) => x.text || '').join('').trim();
  }
  const AI_SYS = 'Kamu asisten yang menjawab soal pilihan ganda / benar-salah untuk pelatihan karyawan minimarket (Alfamart/Alfamidi). Pilih jawaban paling tepat. Balas HANYA JSON valid: {"jawaban":"teks jawaban yang dipilih","penjelasan":"alasan singkat 1-3 kalimat"}. Jika ragu isi jawaban "Tidak yakin". Bahasa Indonesia.';
  async function runAI(i) {
    const p = LAST && LAST.parts[i]; if (!p) return;
    const box = document.querySelector('[data-aibox="' + i + '"]'); if (!box) return;
    if (!getAi() || !getAi().key) { box.innerHTML = '<div class="card empty"><p>Referensi AI belum diaktifkan (butuh API key Anda sendiri).</p><button class="btn btn-acc" id="openAi">🤖 Aktifkan sekarang</button></div>'; $('openAi').onclick = () => $('aiBtn').click(); return; }
    box.innerHTML = '<article class="card res ai"><span class="spin"></span>AI sedang berpikir…</article>';
    try {
      const q = cleanQuery(p.text).replace(/\n{2,}/g, '\n').trim(), qTok = tokenize(q), qf = features(qTok), hints = [];
      if (qTok.length) ENT.map((e) => ({ e, s: scoreOf(qTok, e.tk, qf).dice })).filter((x) => x.s >= 0.35).sort((a, b) => b.s - a.s).slice(0, 3).forEach((x) => hints.push('- ' + x.e.q + '  => jawaban di database: ' + x.e.answers.join(' | ')));
      const txt = await callAI(AI_SYS, [{ text: 'Soal:\n' + q + (hints.length ? '\n\nSoal mirip di database (hanya petunjuk, bisa berbeda):\n' + hints.join('\n') : '') }]);
      let out; try { const m = txt.match(/\{[\s\S]*\}/); out = JSON.parse(m ? m[0] : txt); } catch (e) { out = { jawaban: txt.slice(0, 300), penjelasan: '' }; }
      box.innerHTML = '<article class="card res ai"><div class="badges"><span class="pill ai">🤖 Referensi AI</span><span class="tag">bukan dari bank soal — cek lagi sebelum dipakai</span></div>' + ansBlock([String(out.jawaban || 'Tidak yakin')], 'Jawaban AI') + (out.penjelasan ? '<div class="sec">Penjelasan</div><p class="expl">' + esc(String(out.penjelasan)) + '</p>' : '') + '</article>';
    } catch (e) { box.innerHTML = '<article class="card res none"><p class="q">AI tidak tersedia: ' + esc(e.message) + '</p></article>'; }
  }

  /* ====================== KONTROL PENCARIAN ====================== */
  let runId = 0, liveT;
  async function run(explicit) {
    const id = ++runId, raw = $('q').value;
    if (!raw.trim()) { LAST = null; renderAll(); return; }
    if (!ENT.length) return;
    $('go').disabled = true; await new Promise((r) => setTimeout(r));
    if (id !== runId) { $('go').disabled = false; return; }
    const whole = searchText(raw); let parts;
    if (whole.items.length && whole.items[0].score >= 0.9) parts = [{ text: raw.trim(), res: whole }];
    else { const texts = splitQuestions(raw); parts = texts.length > 1 ? texts.map((t) => ({ text: t, res: searchText(t) })) : [{ text: raw.trim(), res: whole }]; }
    $('go').disabled = false; LAST = { parts, multi: parts.length > 1 }; renderAll();
    if (explicit) { popupFor(LAST); if (!LAST.multi && !parts[0].res.items.length && getAi() && getAi().key) runAI(0); }
  }
  $('go').onclick = () => run(true);
  $('clr').onclick = () => { $('q').value = ''; LAST = null; renderAll(); runId++; $('ocrNote').textContent = ''; $('q').focus(); };
  $('q').addEventListener('input', () => { clearTimeout(liveT); liveT = setTimeout(() => run(false), 350); });
  $('q').addEventListener('paste', () => setTimeout(() => { if ($('q').value.trim().length > 15) { clearTimeout(liveT); run(true); } }, 30));
  $('q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(true); } });

  /* ====================== GAMBAR → TEKS ====================== */
  async function shrinkImage(file) {
    try {
      if (file.size <= 1.5 * 1024 * 1024 || typeof createImageBitmap === 'undefined') return file;
      const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.88));
      return blob && blob.size < file.size ? blob : file;
    } catch (e) { return file; }
  }
  async function ocrAI(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    return callAI('Kamu mesin OCR. Salin SELURUH teks soal pada gambar apa adanya (soal + semua pilihan jawaban, satu pilihan per baris). Jangan menjawab, jangan menambah komentar.', [{ image: { mime: file.type || 'image/jpeg', data: C.b64(buf) } }, { text: 'Salin teks pada gambar ini.' }]);
  }
  async function ocrLocal(file) {
    if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('OCR di browser gagal dimuat (butuh internet)')); document.head.appendChild(s); });
    return (await window.Tesseract.recognize(file, 'ind+eng')).data.text;
  }
  $('imgBtn').onclick = () => $('imgFile').click();
  $('imgFile').onchange = async (e) => {
    const f0 = e.target.files[0]; e.target.value = ''; if (!f0) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f0.type)) return alert('Gambar harus JPG, PNG, atau WebP.');
    const old = $('imgBtn').textContent; $('imgBtn').disabled = true; $('imgBtn').innerHTML = '<span class="spin"></span>Membaca gambar…';
    try {
      const f = await shrinkImage(f0); let text = '', via = 'AI';
      try { if (!getAi() || !getAi().key) throw new Error('NOKEY'); text = await ocrAI(f); }
      catch (aiErr) { $('imgBtn').innerHTML = '<span class="spin"></span>Membaca di browser…'; via = 'OCR browser'; text = await ocrLocal(f); }
      if (!text || !text.trim()) throw new Error('Tidak ada teks yang terbaca pada gambar.');
      $('q').value = text.trim(); run(true);
      $('ocrNote').textContent = 'Teks gambar dibaca via ' + via + ' — periksa/koreksi di kotak soal, lalu klik Cari lagi bila perlu.';
    } catch (err) { alert('Gagal membaca gambar: ' + err.message); }
    $('imgBtn').disabled = false; $('imgBtn').textContent = old;
  };

  /* ====================== UNGGAH EXCEL (di browser) ====================== */
  function renderReport(items) {
    let html = '';
    for (const it of items) {
      html += '<div class="f">📄 ' + esc(it.upload) + (it.error ? ' <span class="bad">— ' + esc(it.error) + '</span>' : '') + '</div>';
      if (it.error) continue;
      html += '<div>Terbaca ' + it.pairsRead.toLocaleString('id-ID') + ' pasangan · <b>baru ' + it.added.toLocaleString('id-ID') + '</b> · sudah ada (dilewati) ' + it.skipped.toLocaleString('id-ID') + '</div>';
      for (const f of it.files) {
        html += '<div class="f" style="font-weight:600">• ' + esc(f.file) + (f.error ? ' <span class="bad">' + esc(f.error) + '</span>' : ' (' + f.totalPairs + ' pasangan)') + '</div>';
        if (!f.sheets.length) continue;
        html += '<table><tr><th>Sheet</th><th>Cara baca</th><th>Baris</th><th>Pasangan</th><th>Tanpa pasangan</th></tr>' + f.sheets.map((s) => '<tr><td>' + esc(s.sheet) + '</td><td>' + esc(s.mode) + '</td><td>' + s.rows + '</td><td>' + s.pairs + '</td><td>' + (s.unpaired ? '<span class="bad">' + s.unpaired + '</span>' : '0') + '</td></tr>').join('') + '</table>';
        for (const s of f.sheets) if (s.unpairedSample.length) html += '<details><summary>' + esc(s.sheet) + ': ' + s.unpaired + ' baris belum lengkap (contoh ' + s.unpairedSample.length + ')</summary>' + s.unpairedSample.map((u) => '<div>baris ' + u.baris + ': ' + esc(u.teks) + '</div>').join('') + '</details>';
      }
    }
    $('rep').innerHTML = html;
  }
  async function handleFiles(list) {
    const results = [], fresh = [];
    for (const f of list) {
      if (!/\.(xlsx|xls|xlsm|xlsb|csv|ods|zip)$/i.test(f.name)) { results.push({ upload: f.name, error: 'Format tidak didukung (XLSX, XLS, XLSM, XLSB, CSV, ODS, ZIP).' }); continue; }
      if (f.size > IMP.MAX_UPLOAD) { results.push({ upload: f.name, error: 'Lebih dari 50 MB. Pecah jadi beberapa file.' }); continue; }
      $('rep').innerHTML = '<span class="spin"></span>Membaca ' + esc(f.name) + '…'; await new Promise((r) => setTimeout(r, 30));
      try {
        const r = IMP.importFile(f.name, new Uint8Array(await f.arrayBuffer()));
        const a = addPairs(r.pairs.map((p) => [p[0], p[1]])); fresh.push(...a.fresh); LOCAL_ADDED += a.added;
        results.push({ upload: f.name, files: r.files, pairsRead: r.pairs.length, added: a.added, skipped: a.skipped });
      } catch (e) { results.push({ upload: f.name, error: e.message }); }
    }
    if (fresh.length) { const old = await idbGet(); await idbSet(old.concat(fresh)); }
    renderReport(results); updateCounts();
    if ($('q').value.trim()) run(false);
  }
  $('drop').onclick = () => $('file').click();
  $('file').onchange = (e) => { handleFiles([...e.target.files]); e.target.value = ''; };
  ['dragenter', 'dragover'].forEach((ev) => $('drop').addEventListener(ev, (e) => { e.preventDefault(); $('drop').classList.add('on'); }));
  ['dragleave', 'drop'].forEach((ev) => $('drop').addEventListener(ev, (e) => { e.preventDefault(); $('drop').classList.remove('on'); }));
  $('drop').addEventListener('drop', (e) => handleFiles([...e.dataTransfer.files]));

  /* ====================== LOGIN & SESI (maks 2 jam) ====================== */
  const msg = (id, t, ok) => { const m = $(id); m.textContent = t || ''; m.className = 'msg' + (ok ? ' ok' : ''); };
  const toggle = (admin) => { $('lg').classList.toggle('active', admin); msg('msgTeam', ''); msg('msgAdmin', ''); };
  $('toAdmin').onclick = () => toggle(true); $('toTeam').onclick = () => toggle(false);

  async function startSession(info, dek) {
    DEK = dek; SESS = { ...info, exp: Date.now() + SESSION_MS };
    ss.set('cs_session', JSON.stringify({ ...SESS, dek: C.b64(dek) }));
    await enter();
  }
  async function enter() {
    show($('login'), false); show($('app'), true);
    $('whoName').textContent = SESS.role === 'admin' ? 'Admin · ' + SESS.email : SESS.name;
    show($('btnAdminPanel'), SESS.role === 'admin');
    clearInterval(tickT); tick(); tickT = setInterval(tick, 1000);
    try { await loadBank(); } catch (e) { console.error(e); $('status').className = 'chip err'; $('statusTxt').textContent = 'Gagal membuka data: ' + (e.message || e); }
  }
  function loggedOut(note) {
    clearInterval(tickT); DEK = null; SESS = null; LAST = null; ENT = []; exactMap = new Map(); META = null;
    ss.del('cs_session'); ss.del('cs_gh_token');
    $('out').innerHTML = ''; $('q').value = ''; $('rep').innerHTML = ''; closePop(); $('ovAdmin').classList.remove('show'); $('ovAi').classList.remove('show');
    show($('app'), false); show($('login'), true); $('lgPw').value = ''; $('adPw').value = ''; toggle(false);
    if (note) msg('msgTeam', note);
    show($('lgWarn'), location.protocol === 'file:');
  }
  function tick() {
    const left = Math.floor((SESS.exp - Date.now()) / 1000);
    if (left <= 0) return loggedOut('Sesi 2 jam sudah habis. Silakan login lagi.');
    const h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
    $('timer').textContent = h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    $('timer').classList.toggle('low', left < 300);
  }
  const normInvite = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const usedInv = () => { try { return JSON.parse(ls.get('cs_used_inv') || '[]'); } catch (e) { return []; } };
  async function loginTeam() {
    const raw = $('lgUser').value.trim(), pwRaw = $('lgPw').value, pw = C.normTeam(pwRaw);
    if (!pwRaw.trim()) return msg('msgTeam', 'Isi password dulu.');
    if (raw.includes('@')) return loginAdminWith(raw.toLowerCase(), pwRaw, 'msgTeam');     // email diketik di kolom username → login admin
    const u = raw.toLowerCase();
    $('btnLogin').disabled = true; msg('msgTeam', 'Memeriksa…', true);
    try {
      for (const a of KEYS.accounts.filter((x) => !u || x.id === u || x.name.toLowerCase() === u)) {
        const dek = await C.unwrapDek(a, pw, KEYS.iter);
        if (dek) { $('lgPw').value = ''; msg('msgTeam', ''); return await startSession({ role: 'team', name: a.name }, dek); }
      }
      // kode undangan (pengguna baru): belum kedaluwarsa & belum dipakai di perangkat ini
      const code = normInvite(pwRaw), used = usedInv();
      if (code.length >= 8) for (const inv of (KEYS.invites || []).filter((x) => x.exp > Date.now() && !used.includes(x.id))) {
        const dek = await C.unwrapDek(inv, 'inv|' + code, KEYS.iter);
        if (dek) {
          ls.set('cs_used_inv', JSON.stringify([...used, inv.id]));
          $('lgPw').value = ''; msg('msgTeam', '');
          return await startSession({ role: 'team', name: inv.name + ' (undangan)' }, dek);
        }
      }
      const expired = (KEYS.invites || []).some((x) => x.exp <= Date.now());
      msg('msgTeam', u ? 'Username atau password salah.' : (code.length >= 8 && expired ? 'Password/kode salah atau kode sudah kedaluwarsa/terpakai. Minta kode baru ke admin.' : 'Password atau kode salah.'));
    } finally { $('btnLogin').disabled = false; }
  }
  async function loginAdminWith(em, pw, msgId) {
    if (!em || !pw) return msg(msgId, 'Isi email dan password admin.');
    const btn = msgId === 'msgAdmin' ? $('btnAdmin') : $('btnLogin'); btn.disabled = true; msg(msgId, 'Memeriksa…', true);
    try {
      const h = await C.sha256hex(em), entry = KEYS.admins.find((x) => x.h === h);
      if (!entry) return msg(msgId, 'Email ini bukan admin. Anggota tim: kosongkan username atau isi nama akun, bukan email.');
      const dek = await C.unwrapDek(entry, C.adminSecret(em, pw), KEYS.iter);
      if (!dek) return msg(msgId, 'Password admin salah.');
      $('adPw').value = ''; $('lgPw').value = ''; msg(msgId, '');
      await startSession({ role: 'admin', name: 'Admin', email: em, h }, dek);
    } finally { btn.disabled = false; }
  }
  const loginAdmin = () => loginAdminWith($('adEmail').value.trim().toLowerCase(), $('adPw').value, 'msgAdmin');
  $('btnLogin').onclick = loginTeam; $('btnAdmin').onclick = loginAdmin;
  $('mailAdmin').href = 'mailto:' + ADMIN_CONTACT.join(',') + '?subject=' + encodeURIComponent('Minta akses Cari Jawaban Soal') + '&body=' + encodeURIComponent('Halo Admin,\n\nSaya ingin minta akses ke Cari Jawaban Soal.\nNama: \nToko/Area: \n\nTerima kasih.');
  $('lgPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') loginTeam(); });
  $('lgUser').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('lgPw').focus(); });
  $('adPw').addEventListener('keydown', (e) => { if (e.key === 'Enter') loginAdmin(); });
  $('adEmail').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('adPw').focus(); });
  $('btnLogout').onclick = () => loggedOut('Anda sudah keluar.');
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closePop(); $('ovAi').classList.remove('show'); } });

  /* ====================== PANEL ADMIN ====================== */
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const keysText = () => { KEYS.updated = new Date().toISOString(); KEYS.invites = (KEYS.invites || []).filter((v) => v.exp > Date.now()); return 'window.CS_KEYS=' + JSON.stringify(KEYS) + ';\n'; };
  const adMsg = (html, cls) => { $('pubMsg').innerHTML = html ? '<div class="alert ' + (cls || 'ok') + '">' + html + '</div>' : ''; };
  let adminDirty = false;

  function renderAcc() {
    $('accTbl').innerHTML = '<tr><th>Akun</th><th>Password baru</th><th></th></tr>' + KEYS.accounts.map((a) =>
      '<tr><td><b>' + esc(a.name) + '</b></td><td><input class="inp" data-pw="' + esc(a.id) + '" type="text" placeholder="ketik password baru"></td><td style="white-space:nowrap"><button class="btn btn-sm btn-acc" data-set="' + esc(a.id) + '">Ganti</button> <button class="btn btn-sm btn-danger" data-del="' + esc(a.id) + '">Hapus</button></td></tr>').join('');
    $('rotList').innerHTML = KEYS.accounts.map((a) => '<label class="lab">Password baru untuk ' + esc(a.name) + '</label><input class="inp" data-rot="' + esc(a.id) + '" type="text" placeholder="minimal 6 karakter">').join('');
  }
  async function setAccPassword(id, pw) {
    if (pw.trim().length < 6) return adMsg('Password minimal 6 karakter.', 'err');
    const i = KEYS.accounts.findIndex((a) => a.id === id); if (i < 0) return;
    KEYS.accounts[i] = { id, name: KEYS.accounts[i].name, ...(await C.wrapDek(DEK, C.normTeam(pw), KEYS.iter)) };
    adminDirty = true; adMsg('Password <b>' + esc(KEYS.accounts[i].name) + '</b> diganti. Buka tab “Terbitkan ke GitHub” lalu klik <b>Terbitkan akun &amp; password</b> agar berlaku untuk semua.', 'ok');
  }
  $('accTbl').addEventListener('click', async (e) => {
    const s = e.target.closest('[data-set]'), d = e.target.closest('[data-del]');
    if (s) { const inp = $('accTbl').querySelector('[data-pw="' + s.dataset.set + '"]'); await setAccPassword(s.dataset.set, inp.value); inp.value = ''; showTab('pub-hint'); }
    if (d) {
      if (KEYS.accounts.length <= 1) return adMsg('Minimal harus ada 1 akun tim.', 'err');
      if (!confirm('Hapus akun ' + d.dataset.del + '?')) return;
      KEYS.accounts = KEYS.accounts.filter((a) => a.id !== d.dataset.del); adminDirty = true; renderAcc();
      adMsg('Akun dihapus (lokal). Terbitkan agar berlaku. Catatan: yang pernah mengunduh file kunci lama masih bisa membuka data — gunakan “Rotasi penuh” untuk mencabut total.', 'warn');
    }
  });
  $('addAcc').onclick = async () => {
    const name = $('newName').value.trim(), pw = $('newPw').value, id = slug(name);
    if (!id) return adMsg('Isi nama akun.', 'err');
    if (KEYS.accounts.some((a) => a.id === id)) return adMsg('Nama akun sudah dipakai.', 'err');
    if (pw.trim().length < 6) return adMsg('Password minimal 6 karakter.', 'err');
    KEYS.accounts.push({ id, name: name.toUpperCase(), ...(await C.wrapDek(DEK, C.normTeam(pw), KEYS.iter)) });
    adminDirty = true; $('newName').value = ''; $('newPw').value = ''; renderAcc();
    adMsg('Akun <b>' + esc(name.toUpperCase()) + '</b> ditambahkan (lokal). Terbitkan agar bisa dipakai.', 'ok');
  };
  $('mePwSave').onclick = async () => {
    const pw = $('mePw').value; if (pw.length < 8) return adMsg('Password admin minimal 8 karakter.', 'err');
    const i = KEYS.admins.findIndex((x) => x.h === SESS.h); if (i < 0) return adMsg('Entri admin tidak ditemukan.', 'err');
    KEYS.admins[i] = { h: SESS.h, ...(await C.wrapDek(DEK, C.adminSecret(SESS.email, pw), KEYS.iter)) };
    adminDirty = true; $('mePw').value = ''; adMsg('Password admin untuk <b>' + esc(SESS.email) + '</b> diganti (lokal). Terbitkan agar berlaku.', 'ok');
  };
  const INV_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const fmtCode = (c) => c.slice(0, 5) + '-' + c.slice(5);
  const newInviteCode = () => { const r = C.rnd(10); let s = ''; for (const x of r) s += INV_ALPHA[x % INV_ALPHA.length]; return s; };
  const fmtDate = (t) => new Date(t).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
  function renderInv() {
    KEYS.invites = (KEYS.invites || []);
    $('invTbl').innerHTML = KEYS.invites.length ? '<tr><th>Nama</th><th>Berlaku sampai</th><th>Status</th><th></th></tr>' + KEYS.invites.map((v) =>
      '<tr><td><b>' + esc(v.name) + '</b></td><td>' + fmtDate(v.exp) + '</td><td>' + (v.exp > Date.now() ? 'aktif' : 'kedaluwarsa') + '</td><td><button class="btn btn-sm btn-danger" data-invdel="' + esc(v.id) + '">Hapus</button></td></tr>').join('') : '<tr><td class="note">Belum ada kode undangan.</td></tr>';
  }
  $('invMake').onclick = async () => {
    const name = $('invName').value.trim(); if (!name) return adMsg('Isi nama pengguna dulu.', 'err');
    KEYS.invites = (KEYS.invites || []).filter((v) => v.exp > Date.now());
    if (KEYS.invites.length >= 20) return adMsg('Maksimal 20 kode aktif. Hapus yang tidak dipakai dulu.', 'err');
    const code = newInviteCode(), ttl = +$('invTtl').value, exp = Date.now() + ttl * 3600 * 1000;
    const id = 'i' + Date.now().toString(36) + C.b64(C.rnd(3)).replace(/[^A-Za-z0-9]/g, '');
    KEYS.invites.push({ id, name, exp, ...(await C.wrapDek(DEK, 'inv|' + code, KEYS.iter)) });
    adminDirty = true; renderInv();
    const em = $('invEmail').value.trim();
    const body = 'Halo ' + name + ',\n\nKode login sekali pakai Cari Jawaban Soal: ' + fmtCode(code) + '\nBerlaku sampai ' + fmtDate(exp) + '.\nMasukkan kode ini di kolom Password pada halaman login.\n\nSesi aktif maksimal 2 jam.';
    $('invNew').innerHTML = '<div class="alert ok">Kode untuk <b>' + esc(name) + '</b>: <span style="font-size:22px;font-weight:800;letter-spacing:2px;user-select:all">' + fmtCode(code) + '</span><br>Berlaku sampai ' + fmtDate(exp) + '. Kode ini hanya ditampilkan sekarang. <b>Klik Terbitkan agar aktif</b> (tab Terbitkan ke GitHub).<div class="actions"><button class="btn btn-sm" data-copy="' + fmtCode(code) + '">Salin kode</button> <a class="btn btn-sm" style="text-decoration:none;display:inline-block" href="mailto:' + encodeURIComponent(em) + '?subject=' + encodeURIComponent('Kode login Cari Jawaban Soal') + '&body=' + encodeURIComponent(body.replace(/\\n/g, '\n')) + '">✉️ Kirim lewat email</a></div></div>';
    $('invName').value = '';
  };
  $('invTbl').addEventListener('click', (e) => { const d = e.target.closest('[data-invdel]'); if (!d) return; KEYS.invites = KEYS.invites.filter((v) => v.id !== d.dataset.invdel); adminDirty = true; renderInv(); adMsg('Kode dihapus (lokal). Terbitkan agar berlaku.', 'warn'); });
  $('admAdd').onclick = async () => {
    const em = $('admNewEmail').value.trim().toLowerCase(), pw = $('admNewPw').value;
    if (!/^\S+@\S+\.\S+$/.test(em)) return adMsg('Email admin tidak valid.', 'err');
    if (pw.length < 8) return adMsg('Password admin minimal 8 karakter.', 'err');
    if (KEYS.admins.length >= 6) return adMsg('Maksimal 6 admin.', 'err');
    const h = await C.sha256hex(em), entry = { h, ...(await C.wrapDek(DEK, C.adminSecret(em, pw), KEYS.iter)) };
    const i = KEYS.admins.findIndex((x) => x.h === h); if (i >= 0) KEYS.admins[i] = entry; else KEYS.admins.push(entry);
    adminDirty = true; $('admNewEmail').value = ''; $('admNewPw').value = ''; adMsg('Admin <b>' + esc(em) + '</b> ditambahkan (lokal). Terbitkan agar berlaku.', 'ok');
  };
  function showTab(t) {
    if (t === 'pub-hint') t = 'acc';
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    show($('tab-acc'), t === 'acc'); show($('tab-inv'), t === 'inv'); show($('tab-me'), t === 'me'); show($('tab-pub'), t === 'pub');
  }
  document.querySelectorAll('.tab').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  $('btnAdminPanel').onclick = () => {
    KEYS = JSON.parse(JSON.stringify(KEYS)); renderAcc(); renderInv(); $('invNew').innerHTML = ''; $('meEmail').textContent = SESS.email; $('rotAdmin').value = ''; $('rotEmails').value = SESS.email;
    const h = location.hostname, seg = location.pathname.split('/').filter(Boolean)[0];
    const owner = ls.get('cs_gh_owner') || (h.endsWith('.github.io') ? h.split('.')[0] : '');
    $('ghOwner').value = owner; $('ghRepo').value = ls.get('cs_gh_repo') || (h.endsWith('.github.io') ? (seg && !/\.html?$/.test(seg) ? seg : owner + '.github.io') : '');
    $('ghBranch').value = ls.get('cs_gh_branch') || 'main'; $('ghToken').value = ss.get('cs_gh_token') || '';
    adMsg(''); showTab('acc'); $('ovAdmin').classList.add('show');
  };
  $('adClose').onclick = () => $('ovAdmin').classList.remove('show');

  const download = (name, text) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/javascript' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); };
  async function bankText(dek) {
    const e = ENT.map((x) => [x.q, ...x.answers]);
    const meta = { n: e.length, source: (META && META.source || 'Bank soal').replace(/ \+ unggahan admin$/, '') + (LOCAL_ADDED ? ' + unggahan admin' : ''), built: new Date().toISOString().slice(0, 16).replace('T', ' ') };
    return 'window.CS_BANK="' + C.b64(await C.encryptBank({ meta, e }, dek)) + '";\n';
  }
  const ghCfg = () => {
    const c = { owner: $('ghOwner').value.trim(), repo: $('ghRepo').value.trim(), branch: $('ghBranch').value.trim() || 'main', token: $('ghToken').value.trim() };
    if (!c.owner || !c.repo || !c.token) throw new Error('Isi pemilik, nama repo, dan token GitHub dulu.');
    ls.set('cs_gh_owner', c.owner); ls.set('cs_gh_repo', c.repo); ls.set('cs_gh_branch', c.branch); ss.set('cs_gh_token', c.token);
    return c;
  };
  async function ghPut(cfg, path, text, message) {
    const url = 'https://api.github.com/repos/' + encodeURIComponent(cfg.owner) + '/' + encodeURIComponent(cfg.repo) + '/contents/' + path;
    const h = { Authorization: 'Bearer ' + cfg.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    let sha; const g = await fetch(url + '?ref=' + encodeURIComponent(cfg.branch), { headers: h });
    if (g.ok) sha = (await g.json()).sha; else if (g.status !== 404) throw new Error('GitHub menolak (' + g.status + '). Cek token, nama repo, dan izin Contents: Read & write.');
    const content = C.b64(new TextEncoder().encode(text));
    const r = await fetch(url, { method: 'PUT', headers: { ...h, 'content-type': 'application/json' }, body: JSON.stringify({ message, content, branch: cfg.branch, ...(sha ? { sha } : {}) }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error('Gagal menyimpan ' + path + ': ' + (j.message || r.status)); }
  }
  const busy = (btn, on) => { btn.disabled = on; };
  $('pubKeys').onclick = async () => {
    busy($('pubKeys'), true); adMsg('<span class="spin"></span>Menyimpan akun ke GitHub…', 'warn');
    try { await ghPut(ghCfg(), 'data/keys.js', keysText(), 'Admin: perbarui akun & password tim'); adminDirty = false; adMsg('✅ Tersimpan di GitHub. GitHub Pages memperbarui situs dalam ±1 menit; setelah itu password baru berlaku, password lama mati. Yang sedang login tetap aktif sampai sesi 2 jam habis.', 'ok'); }
    catch (e) { adMsg('❌ ' + esc(e.message), 'err'); } finally { busy($('pubKeys'), false); }
  };
  $('pubBank').onclick = async () => {
    busy($('pubBank'), true); adMsg('<span class="spin"></span>Mengenkripsi dan menyimpan data soal…', 'warn');
    try { const text = await bankText(DEK); await ghPut(ghCfg(), 'data/bank.js', text, 'Admin: perbarui data soal (' + ENT.length + ' soal)'); adMsg('✅ Data soal (' + ENT.length.toLocaleString('id-ID') + ') tersimpan di GitHub. Terlihat oleh semua pengguna setelah ±1 menit.', 'ok'); }
    catch (e) { adMsg('❌ ' + esc(e.message), 'err'); } finally { busy($('pubBank'), false); }
  };
  $('dlKeys').onclick = () => { download('keys.js', keysText()); adMsg('keys.js terunduh. Ganti file <code>data/keys.js</code> di repo GitHub dengan file ini.', 'ok'); };
  $('dlBank').onclick = async () => { download('bank.js', await bankText(DEK)); adMsg('bank.js terunduh. Ganti file <code>data/bank.js</code> di repo GitHub dengan file ini.', 'ok'); };
  $('rotGo').onclick = async () => {
    const pws = {}; let bad = false;
    $('rotList').querySelectorAll('[data-rot]').forEach((i) => { if (i.value.trim().length < 6) bad = true; pws[i.dataset.rot] = i.value; });
    const adm = $('rotAdmin').value;
    if (bad || adm.length < 8) return adMsg('Isi password baru semua akun (min 6 karakter) dan password admin (min 8 karakter).', 'err');
    if (!confirm('Rotasi penuh: semua password lama dicabut dan bank soal dienkripsi ulang. Lanjutkan?')) return;
    busy($('rotGo'), true); adMsg('<span class="spin"></span>Rotasi kunci & menerbitkan…', 'warn');
    try {
      const cfg = ghCfg(), nd = C.rnd(32), emails = $('rotEmails').value.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^\S+@\S+\.\S+$/.test(x));
      if (!emails.includes(SESS.email)) throw new Error('Email admin yang sedang masuk harus ada di daftar.');
      const nk = { v: 1, iter: KEYS.iter, updated: '', accounts: [], admins: [], invites: [] };
      for (const a of KEYS.accounts) nk.accounts.push({ id: a.id, name: a.name, ...(await C.wrapDek(nd, C.normTeam(pws[a.id]), KEYS.iter)) });
      for (const em of [...new Set(emails)]) nk.admins.push({ h: await C.sha256hex(em), ...(await C.wrapDek(nd, C.adminSecret(em, adm), KEYS.iter)) });
      const btext = await bankText(nd);
      await ghPut(cfg, 'data/bank.js', btext, 'Admin: rotasi kunci (bank terenkripsi ulang)');
      KEYS = nk; DEK = nd; await ghPut(cfg, 'data/keys.js', keysText(), 'Admin: rotasi kunci (akun & password baru)');
      SESS.exp = Math.min(SESS.exp, Date.now() + SESSION_MS); ss.set('cs_session', JSON.stringify({ ...SESS, dek: C.b64(nd) }));
      adMsg('✅ Rotasi selesai: kunci data baru, password tim & admin baru sudah diterbitkan. Situs diperbarui dalam ±1 menit; password lama tidak bisa lagi membuka data baru.', 'ok');
    } catch (e) { adMsg('❌ ' + esc(e.message), 'err'); } finally { busy($('rotGo'), false); }
  };

  /* ====================== BOOT ====================== */
  refreshAi();
  KEYS = window.CS_KEYS ? JSON.parse(JSON.stringify(window.CS_KEYS)) : null;
  show($('lgWarn'), location.protocol === 'file:');
  (async function boot() {
    if (!KEYS) { msg('msgTeam', 'File data/keys.js tidak ditemukan di hosting.'); return; }
    try {
      const s = JSON.parse(ss.get('cs_session') || 'null');
      if (s && s.exp > Date.now() && s.dek) { SESS = { role: s.role, name: s.name, email: s.email, h: s.h, exp: s.exp }; DEK = C.unb64(s.dek); await enter(); }
    } catch (e) { /* sesi tidak valid → tetap di layar login */ }
  })();

  window.CS = { get ENT() { return ENT; }, get KEYS() { return KEYS; }, get DEK() { return DEK; }, get LOCAL_ADDED() { return LOCAL_ADDED; }, searchText, splitQuestions, cleanQuery, addPairs, handleFiles };
})();

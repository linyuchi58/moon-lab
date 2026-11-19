// =====================================================================
// 🏆 日地月 3D 實驗室 v12 ── 挑戰測驗＋教師後台（第二階段）
// ・題目每次隨機產生、選項打亂；要動手操作 3D 宇宙、先預測再觀察
// ・兩段式題目（答案＋理由）診斷迷思；教師後台依「概念」與「迷思」統計
// ・後端：萬用遊戲端 Code.gs v3.3（GET 加 &t=、POST 用 text/plain；網址固定在程式碼）
// =====================================================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbyGWBQptYfpDfLFLspn9EtX8AkO81pEWEVBOW5VyJ2WoJN21uGy9SLXgx-DR2-nhEA/exec";
function getGasUrl() { return GAS_URL; }

// ---------------- 小工具 ----------------
const QM = () => window.__moon;
const $ = id => document.getElementById(id);
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function qToast(msg) { const t = $('toast'); if (!t) return; t.textContent = msg; t.style.display = 'block'; clearTimeout(qToast._h); qToast._h = setTimeout(() => t.style.display = 'none', 3200); }
function showOverlay(id) { const el = $(id); if (el) { el.classList.add('show'); el.style.display = 'flex'; } }
function closeOverlay(id) { const el = $(id); if (el) { el.classList.remove('show'); el.style.display = 'none'; } }
async function gasGet(params) {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${getGasUrl()}?${qs}&t=${Date.now()}`, { method: 'GET', credentials: 'omit', redirect: 'follow' });
  return res.json();
}
async function gasPost(body) {
  const res = await fetch(getGasUrl(), { method: 'POST', credentials: 'omit', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  return res.json();
}
function showConnError(note) { const n = $('conn-error-note'); if (n) n.textContent = note || ''; showOverlay('conn-error-modal'); }
function openInNewFullTab() { closeOverlay('conn-error-modal'); const c = (($('login-code') || {}).value || '').trim(); const u = location.href.split('?')[0] + (/^\d{5}$/.test(c) ? `?code=${c}` : ''); window.open(u, '_blank'); }
function unpackLogRecord(r) {
  let rawRank = String(r.rankTitle || ''), topic = String(r.topicSummary || ''), wrong = String(r.wrongDetails || '');
  if (rawRank.includes('||')) { const p = rawRank.split('||'); rawRank = p[0] || ''; if (!topic) topic = p[1] || ''; if (!wrong || wrong === '無') wrong = p[2] || '無'; }
  return Object.assign({}, r, { rankTitle: rawRank || '🌱 見習探索者', topicSummary: topic || '日地月觀測挑戰', wrongDetails: wrong || '全對無失誤' });
}
function fmtClock(T) { T = ((T % 24) + 24) % 24; const m = Math.round(T * 12) * 5 % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function speak(text) {
  if (!qcfg.voice || !('speechSynthesis' in window)) return;
  try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(String(text).replace(/<[^>]+>/g, '').replace(/[🌙🔭✊🚀👀☀️🌕🌓🌗🌒🌘🌔🌖🌑]/gu, '')); u.lang = 'zh-TW'; u.rate = 1; speechSynthesis.speak(u); } catch (e) {}
}

// ---------------- 概念與迷思 ----------------
const DIMS = {
  phase: { name: '月相辨識', icon: '🌓' },
  time: { name: '月相與時刻', icon: '⏰' },
  motion: { name: '東升西落・每天晚約50分', icon: '🔄' },
  height: { name: '方位與高度角', icon: '✊' },
  cause: { name: '月相成因', icon: '☀️' }
};
const TAGS = {
  litSide: { name: '亮面左右弄反', tip: '亮的一邊永遠朝向太陽：上半個月（盈）亮在右邊（西邊），下半個月（虧）亮在左邊（東邊）。' },
  phaseShape: { name: '月相形狀不熟', tip: '先看亮的部分有多大：細細一彎＝眉月／殘月，一半＝弦月，比一半多＝凸月，全亮＝滿月。' },
  phaseOrder: { name: '月相順序混淆', tip: '順序是：新月→眉月→上弦月→盈凸月→滿月→虧凸月→下弦月→殘月，大約一個月一輪。' },
  dirFlip: { name: '東西方向弄反', tip: '面向南方時，左手是東、右手是西；地球由西向東自轉，所以日月都是東升西落。' },
  nightOnly: { name: '以為月亮只在晚上出現', tip: '月亮有一半的時間是在白天出現！例如上弦月中午就從東方升起了。' },
  visibility: { name: '看不看得到判斷錯', tip: '月亮在地平線下就看不到；新月和太陽同方向、被陽光掩蓋也看不到。' },
  sameRise: { name: '以為月亮每天同時升起', tip: '月亮每天約晚 50 分鐘升起，所以每天同一時間看，月亮會往東移一點。' },
  riseEarlier: { name: '以為月亮每天提早升起', tip: '月亮繞地球的方向和地球自轉相同，所以地球要多轉一點才「追上」月亮：每天晚約 50 分鐘。' },
  bigJump: { name: '每天延遲時間估錯', tip: '一天約晚 50 分鐘（月亮每天在軌道上移動約 12°，地球多轉 12° 約需 50 分鐘）。' },
  nsMove: { name: '移動方向想成南北', tip: '月亮在天空中的移動主要是東→西（自轉造成），不是南北方向。' },
  staticMoon: { name: '以為月亮不會移動', tip: '地球一直在自轉，所以月亮和太陽一樣會在天空中由東往西移動。' },
  altitude: { name: '高度角估計不準', tip: '伸直手臂、握拳，一個拳頭約 10°；從地平線往上一個一個疊到月亮。' },
  direction: { name: '方位判斷不熟', tip: '先找到南方，左手邊是東、右手邊是西；介於中間的是東南、西南。' },
  shadow: { name: '以為月相是地球影子造成', tip: '月相是「被太陽照亮的那一半」我們看到多少；地球影子遮住月亮是「月食」，很少發生。' },
  cloud: { name: '以為月相是雲遮住', tip: '雲遮住只是暫時看不到，月相的亮暗分界每天規律變化，和雲無關。' },
  selfLight: { name: '以為月亮自己會發光', tip: '月亮不會發光，是反射太陽光，所以亮的一邊總是朝向太陽。' },
  distance: { name: '以為月相跟遠近有關', tip: '月相和地月距離無關，只和日、地、月的相對位置有關。' },
  phaseTime: { name: '月相出現時刻不熟', tip: '上弦月傍晚在正南、滿月半夜在正南、下弦月清晨在正南——差 90° 就差 6 小時。' },
  angle: { name: '月日夾角概念不熟', tip: '新月 0°、上弦 90°、滿月 180°、下弦 270°（月亮在太陽東邊的角度）。' },
  eclipse: { name: '月食與月相混淆', tip: '月食要太陽、地球、月亮剛好排成一直線，只發生在部分滿月；月相每天都在變。' }
};
const PHASES = ['眉月', '上弦月', '盈凸月', '滿月', '虧凸月', '下弦月', '殘月'];
const PH_EMOJI = { 新月: '🌑', 眉月: '🌒', 上弦月: '🌓', 盈凸月: '🌔', 滿月: '🌕', 虧凸月: '🌖', 下弦月: '🌗', 殘月: '🌘' };
const PH_PAIR = { 眉月: '殘月', 殘月: '眉月', 上弦月: '下弦月', 下弦月: '上弦月', 盈凸月: '虧凸月', 虧凸月: '盈凸月', 滿月: '盈凸月' };
const PH_DESC = {
  眉月: '細細一彎、亮在右邊（朝西邊的太陽），農曆初三、初四前後，傍晚在西方低空。',
  上弦月: '右半邊亮，農曆初七、初八前後，傍晚在正南方。',
  盈凸月: '比一半多、亮在右邊，農曆十一、十二前後。',
  滿月: '整個圓都亮，農曆十五、十六前後，傍晚從東方升起、整夜可見。',
  虧凸月: '比一半多、亮在左邊，農曆十八、十九前後，晚上才升起。',
  下弦月: '左半邊亮，農曆廿二、廿三前後，清晨在正南方。',
  殘月: '細細一彎、亮在左邊（朝東邊的太陽），農曆廿六前後，清晨在東方低空。'
};

// ---------------- 模型計算 ----------------
function moonAt(D, T) { const M = QM(); return M.horiz(M.moonDir(D, T), M.basis(T)); }
function sunAt(T) { const M = QM(); return M.horiz(new (M.moonDir(1, 0).constructor)(1, 0, 0), M.basis(T)); }
function phaseAt(D, T) { const M = QM(); return M.phaseOf(M.elong(D, T)).short; }
function transitT(D) { let best = 0, bt = 0; for (let i = 0; i < 24 * 12; i++) { const T = i / 12, a = moonAt(D, T).alt; if (a > best) { best = a; bt = T; } } return bt; }
function nameOf(D) { return QM().lunarName(D); }

// ---------------- 題目產生器 ----------------
// 每一題：{ id, dim, type:'mc'|'two'|'manip'|'order', prompt, setup, opts:[{t, ok, tag}], tier2, observe, check, hint1, hint2, explain }
const GEN = {
  phaseId() {
    const D = pick([3, 4, 5, 8, 11, 12, 15, 19, 20, 23, 26, 27]), T = transitT(D), ph = phaseAt(D, T);
    const others = shuffle(PHASES.filter(p => p !== ph && p !== PH_PAIR[ph])).slice(0, 2);
    const opts = shuffle([{ t: ph, ok: true }, { t: PH_PAIR[ph], tag: 'litSide' }, ...others.map(o => ({ t: o, tag: 'phaseShape' }))]);
    return { dim: 'phase', type: 'mc', prompt: '🔭 望遠鏡裡看到的月亮，是什麼月相？', opts,
      setup: { main: 'scope', D, T, mask: { day: 1, phase: 1, info: 1 }, lock: { day: 1, time: 1 }, opt: { maria: false } },
      hint1: '先看亮的部分有多大：細細一彎、一半、還是比一半多？', hint2: '再看亮在哪一邊：亮在右邊是上半個月（盈），亮在左邊是下半個月（虧）。',
      explain: `這是「${ph}」：${PH_DESC[ph] || ''}`, observe: { main: 'scope', D, T } };
  },
  where() {
    const sc = pick([
      { D: 8, T: 18, a: 'S' }, { D: 8, T: 12.5, a: 'E' }, { D: 8, T: 23.6, a: 'W' }, { D: 8, T: 6, a: 'N' },
      { D: 15, T: 18.3, a: 'E' }, { D: 15, T: 24, a: 'S' }, { D: 15, T: 4.6, a: 'W' }, { D: 15, T: 12, a: 'N' },
      { D: 23, T: 6, a: 'S' }, { D: 23, T: 0.6, a: 'E' }, { D: 23, T: 11.5, a: 'W' }, { D: 23, T: 19, a: 'N' }
    ]);
    const ph = phaseAt(sc.D, sc.T), mh = moonAt(sc.D, sc.T), sh = sunAt(sc.T);
    const isDay = sh.alt > 0;
    const OPT = { E: '東方，剛升起不久', S: '南方的高空', W: '西方，快要落下', N: '在地平線下，看不到' };
    const tagFor = k => { if (sc.a === 'N') return 'visibility'; if (k === 'N') return isDay ? 'nightOnly' : 'visibility'; if ((sc.a === 'E' && k === 'W') || (sc.a === 'W' && k === 'E')) return 'dirFlip'; return 'phaseTime'; };
    const opts = shuffle(['E', 'S', 'W', 'N'].map(k => ({ t: OPT[k], ok: k === sc.a, tag: tagFor(k) })));
    const tm = sc.T === 24 ? '半夜 24:00' : `${QM().fmtT(sc.T)}`;
    const why = sc.a === 'N' ? `這時月亮在地平線下（高度角 ${Math.round(mh.alt)}°），被地球擋住了。` : `這時月亮在${QM().dir8(mh.az)}方、高度角約 ${Math.round(mh.alt)}°${isDay ? '，白天也看得到月亮！' : '。'}`;
    return { dim: 'time', type: 'mc', prompt: `🔮 先預測：農曆${nameOf(sc.D)}（${ph}）${tm}，月亮大約在天空的哪裡？`, opts,
      setup: { main: 'ground', D: sc.D, T: sc.T, hideMoon: true, look: { az: 180, alt: 30 }, mask: { phase: 1, info: 1, alt: 1 }, lock: { day: 1, time: 1 }, opt: { path: false, ghosts: false } },
      hint1: '想一想：這個月相時，月亮在太陽的東邊多少度？太陽現在在哪裡？', hint2: '上弦月傍晚在正南、滿月半夜在正南、下弦月清晨在正南；月亮也是東升西落。',
      explain: why, observe: { main: 'ground', D: sc.D, T: sc.T, follow: true, hideMoon: false } };
  },
  riseDelay() {
    let D, r1, r2;
    for (let k = 0; k < 30; k++) { D = 3 + Math.floor(Math.random() * 22); r1 = QM().riseSet(D - 1).rise; r2 = QM().riseSet(D).rise; if (r1 !== null && r2 !== null && r2 > r1 && r1 < 22.5) break; }
    const t1 = fmtClock(r1);
    const opts = shuffle([
      { t: fmtClock(r1 + 50 / 60), ok: true }, { t: t1, tag: 'sameRise' }, { t: fmtClock(r1 - 50 / 60), tag: 'riseEarlier' }, { t: fmtClock(r1 + 2.5), tag: 'bigJump' }
    ]);
    return { dim: 'motion', type: 'mc', prompt: `⏰ 昨天（農曆${nameOf(D - 1)}）月亮在 ${t1} 從東方升起，今天（農曆${nameOf(D)}）大約幾點升起？`, opts,
      setup: { main: 'ground', D, T: r2 - 0.4, look: { az: 95, alt: 18 }, mask: { time: 1, info: 1, alt: 1 }, lock: { day: 1, time: 1 }, opt: { path: false } },
      hint1: '月亮每天升起的時間不一樣喔！', hint2: '月亮每天在軌道上往東走約 12°，地球要多轉一點（約 50 分鐘）才看得到它升起。',
      explain: `月亮每天大約晚 50 分鐘升起，所以今天約 ${fmtClock(r1 + 50 / 60)} 升起。`, observe: { main: 'ground', D, T: r2 + 0.15, look: { az: 95, alt: 18 } } };
  },
  skyMove() {
    if (Math.random() < 0.5) {
      const opts = shuffle([{ t: '從東邊升起，往西邊落下', ok: true }, { t: '從西邊升起，往東邊落下', tag: 'dirFlip' }, { t: '一直停在同一個位置', tag: 'staticMoon' }, { t: '從北邊慢慢移到南邊', tag: 'nsMove' }]);
      return { dim: 'motion', type: 'mc', prompt: '🔄 同一個晚上，月亮在天空中會怎麼移動？', opts,
        setup: { main: 'ground', D: 15, T: 19, look: { az: 135, alt: 25 }, mask: { info: 1 }, lock: { day: 1, time: 1 }, opt: { path: false, ghosts: false } },
        hint1: '想想太陽一天是怎麼移動的。', hint2: '地球由西向東自轉，所以天上的太陽、月亮、星星看起來都由東往西移動。',
        explain: '地球由西向東自轉，所以月亮和太陽一樣「東升西落」。看看動畫裡的滿月！', observe: { main: 'ground', D: 15, T: 18.6, follow: true, play: 'time' } };
    }
    const opts = shuffle([{ t: '每天往東邊移一點', ok: true }, { t: '每天往西邊移一點', tag: 'dirFlip' }, { t: '每天都在同一個位置', tag: 'sameRise' }, { t: '每天往北邊移一點', tag: 'nsMove' }]);
    return { dim: 'motion', type: 'mc', prompt: '👣 連續幾天都在「同一個時間」看月亮，月亮的位置每天會怎麼變？', opts,
      setup: { main: 'ground', D: 5, T: 19, look: { az: 240, alt: 25 }, mask: { info: 1, day: 1 }, lock: { day: 1, time: 1 }, opt: { ghosts: false, path: false } },
      hint1: '月亮每天升起的時間是提早還是延後？', hint2: '月亮每天晚約 50 分鐘升起 → 同一時間看，月亮還沒走那麼遠，所以會偏東一點。',
      explain: '月亮繞地球由西向東轉，每天約移動 12°，所以同一時間看，月亮每天往東移一點、形狀也慢慢變。看看黃色殘影！',
      observe: { main: 'ground', D: 5, T: 19, look: { az: 240, alt: 25 }, opt: { ghosts: true }, play: 'day' } };
  },
  fists() {
    const cands = [];
    for (let D = 4; D <= 26; D++) for (let i = 0; i < 24 * 6; i++) {
      const T = i / 6, mh = moonAt(D, T), n = Math.round(mh.alt / 10);
      if (n >= 2 && n <= 6 && Math.abs(mh.alt - n * 10) < 1.2 && sunAt(T).alt < -8) cands.push({ D, T, n, az: mh.az });
    }
    const c = pick(cands), opts = shuffle([c.n - 1, c.n, c.n + 1, c.n + 2].filter(k => k >= 1).slice(0, 4).map(k => ({ t: `約 ${k} 個拳頭（約 ${k * 10}°）`, ok: k === c.n, tag: 'altitude' })));
    return { dim: 'height', type: 'mc', prompt: '✊ 數數看：月亮的高度角大約是幾個拳頭高？（伸直手臂，一個拳頭約 10°）', opts,
      setup: { main: 'ground', D: c.D, T: c.T, follow: true, mask: { alt: 1, info: 1, day: 1, time: 1 }, lock: { day: 1, time: 1 }, opt: { fist: true, grid: true, path: false, ghosts: false } },
      hint1: '從地平線開始，一個一個數拳頭，數到月亮為止。', hint2: '格線每一圈是 10°，也可以數格線。',
      explain: `月亮高度角約 ${c.n * 10}°，就是約 ${c.n} 個拳頭高。`, observe: { mask: { info: 1 } } };
  },
  direction8() {
    const cands = [];
    for (let D = 3; D <= 27; D++) for (let i = 0; i < 24 * 6; i++) {
      const T = i / 6, mh = moonAt(D, T), k = Math.round(mh.az / 45) % 8;
      if (mh.alt > 15 && mh.alt < 55 && Math.abs(((mh.az - k * 45) + 540) % 360 - 180) < 8 && sunAt(T).alt < -6 && k !== 0) cands.push({ D, T, k });
    }
    const c = pick(cands), DIR = ['北', '東北', '東', '東南', '南', '西南', '西', '西北'];
    const ks = shuffle([c.k, (c.k + 4) % 8, (c.k + 1) % 8, (c.k + 7) % 8]);
    const opts = ks.map(k => ({ t: `${DIR[k]}方`, ok: k === c.k, tag: k === (c.k + 4) % 8 ? 'dirFlip' : 'direction' }));
    return { dim: 'height', type: 'mc', prompt: '🧭 站在台灣看天空：月亮現在在哪一個方位？', opts,
      setup: { main: 'ground', D: c.D, T: c.T, follow: true, mask: { alt: 1, info: 1 }, lock: { day: 1, time: 1 }, opt: { grid: true, fist: false, path: false, ghosts: false } },
      hint1: '看看地平線上的方位字，月亮正下方最接近哪一個？', hint2: '面向南方時，左手是東、右手是西。',
      explain: `月亮在${DIR[c.k]}方。`, observe: { mask: { info: 1 } } };
  },
  makePhase() {
    const target = pick(['上弦月', '滿月', '下弦月', '眉月']);
    const startD = { 上弦月: pick([2, 14, 20]), 滿月: pick([4, 8, 24]), 下弦月: pick([5, 12, 16]), 眉月: pick([10, 15, 22]) }[target];
    return { dim: 'cause', type: 'manip', prompt: `🚀 動手做：拖動下方的「農曆日期」，讓月亮變成「${target}」，再按「✅ 我調好了」。`,
      setup: { main: 'space', D: startD, T: 18, cam: 'tilt', mask: { day: 1, phase: 1, info: 1 }, lock: { time: 1 }, opt: { halves: false, rays: true, orbit: true } },
      check: () => phaseAt(QM().S.D, QM().S.T) === target,
      hint1: '看右邊「望遠鏡」小畫面裡的月亮形狀，一邊拖一邊看。', hint2: { 上弦月: '上弦月：月亮在太陽東邊 90°（地球的左手邊），亮右半邊。', 滿月: '滿月：月亮跑到地球背著太陽的那一邊。', 下弦月: '下弦月：月亮在太陽西邊 90°，亮左半邊。', 眉月: '眉月：月亮剛離開太陽方向一點點，亮右邊細細一彎。' }[target],
      explain: `${target}：${PH_DESC[target]}`,
      solve: { D: { 上弦月: 8, 滿月: 15, 下弦月: 23, 眉月: 3 }[target], T: 18 }, tag: 'phaseOrder' };
  },
  orbitPos() {
    const target = pick(['新月', '上弦月', '滿月', '下弦月']), ANG = { 新月: 0, 上弦月: 90, 滿月: 180, 下弦月: 270 };
    const letters = ['A', 'B', 'C', 'D'], angs = shuffle([0, 90, 180, 270]);
    const marks = angs.map((a, i) => ({ label: letters[i], angle: a * Math.PI / 180 }));
    const tA = ANG[target];
    const opts = angs.map((a, i) => ({ t: `位置 ${letters[i]}`, ok: a === tA, tag: Math.abs(((a - tA) + 540) % 360 - 180) === 180 ? 'litSide' : (a === 0 || tA === 0 ? 'shadow' : 'phaseOrder') }));
    const D = { 新月: 1, 上弦月: 8, 滿月: 15, 下弦月: 23 }[target], T = { 新月: 12, 上弦月: 18, 滿月: 24, 下弦月: 6 }[target];
    return { dim: 'cause', type: 'mc', prompt: `☀️ 從北極往下看（陽光從右邊照過來）。月亮在哪個位置時，台灣看到的是「${target}」？`, opts,
      setup: { main: 'space', D, T, cam: 'top', hideMoon: true, marks, mask: { day: 1, phase: 1, info: 1 }, lock: { day: 1, time: 1 }, opt: { rays: true, orbit: true, halves: false } },
      hint1: '月亮永遠是「朝太陽的那一半」被照亮。', hint2: '滿月：亮的那一半整個朝向地球；新月：亮的那一半背對地球。上弦：月亮在地球的左手邊（從北極看，逆時針轉了 90°）。',
      explain: `${target}時月亮在太陽東邊 ${tA}°：${PH_DESC[target] || '和太陽同方向，亮面背對地球，看不到。'}`, observe: { main: 'space', D, T, hideMoon: false, opt: { halves: true } } };
  },
  cause2() {
    const opts = shuffle([{ t: '月亮繞地球轉，我們看到「被太陽照亮那一半」的多少不一樣', ok: true }, { t: '地球的影子遮住了月亮的一部分', tag: 'shadow' }, { t: '雲層遮住了月亮的一部分', tag: 'cloud' }, { t: '月亮自己會發光，亮度一直改變', tag: 'selfLight' }]);
    const tier2 = shuffle([{ t: '月亮亮的那一邊，總是朝向太陽的方向', ok: true }, { t: '月亮只有晚上才看得到', tag: 'nightOnly' }, { t: '月亮每天升起的時間都一樣', tag: 'sameRise' }, { t: '滿月時，月亮離地球最近', tag: 'distance' }]);
    return { dim: 'cause', type: 'two', prompt: '🤔 為什麼月亮會有圓缺（月相）的變化？', opts, tier2, tier2Prompt: '哪一個觀察，最能支持你的答案？',
      setup: { main: 'space', D: 11, T: 18, cam: 'tilt', mask: { info: 1 }, lock: { day: 0, time: 1 }, opt: { halves: true, rays: true } },
      hint1: '拖拖看農曆日期，觀察黃圈（被照亮的一半）和藍圈（朝向地球的一半）。', hint2: '兩個圈重疊的部分，就是我們看到的亮面。',
      explain: '月亮永遠有一半被太陽照亮；月亮繞地球轉，我們看到亮面的多少就不同。地球影子遮住月亮是「月食」，不是月相。', observe: { opt: { halves: true } } };
  },
  bestTime() {
    const ph = pick(['上弦月', '滿月', '下弦月']), ans = { 上弦月: '傍晚（約 18 時）', 滿月: '半夜（約 24 時）', 下弦月: '清晨（約 6 時）' }[ph];
    const opts = shuffle(['傍晚（約 18 時）', '半夜（約 24 時）', '清晨（約 6 時）', '中午（約 12 時）'].map(t => ({ t, ok: t === ans, tag: 'phaseTime' })));
    const D = { 上弦月: 8, 滿月: 15, 下弦月: 23 }[ph], T = { 上弦月: 18, 滿月: 24, 下弦月: 6 }[ph];
    return { dim: 'time', type: 'mc', prompt: `${PH_EMOJI[ph]} 「${ph}」大約什麼時候，會出現在正南方的高空？`, opts,
      setup: { main: 'space', D, T: 12, cam: 'top', mask: { info: 1, time: 1 }, lock: { day: 1, time: 0 }, opt: { rays: true } },
      hint1: '可以拖動「時間」，看看小人什麼時候正好面對月亮。', hint2: '月亮在太陽東邊幾度，就比太陽晚幾小時（每 15° 晚 1 小時）到正南方。',
      explain: `${ph}在太陽東邊 ${({ 上弦月: 90, 滿月: 180, 下弦月: 270 })[ph]}°，比太陽晚 ${({ 上弦月: 6, 滿月: 12, 下弦月: 18 })[ph]} 小時到正南方，所以是${ans}。`,
      observe: { main: 'ground', D, T, look: { az: 180, alt: 40 }, follow: true } };
  },
  litSide() {
    const opts = shuffle([{ t: '靠近太陽（西邊、偏下方）的那一邊', ok: true }, { t: '離太陽遠（東邊、偏上方）的那一邊', tag: 'litSide' }, { t: '中間亮、兩邊暗', tag: 'phaseShape' }, { t: '每天都不一定', tag: 'selfLight' }]);
    return { dim: 'phase', type: 'mc', prompt: '🌒 傍晚太陽剛下山，在西方低空看到細細的眉月，亮的是哪一邊？', opts,
      setup: { main: 'space', D: 3, T: 18.6, cam: 'tilt', hideMoon: true, mask: { info: 1, phase: 1 }, lock: { day: 1, time: 1 } },
      hint1: '月亮的光是從哪裡來的？', hint2: '月亮反射太陽光，亮的一邊一定朝向太陽。',
      explain: '月亮不會自己發光，是反射太陽光，所以亮的那一邊永遠朝向太陽；傍晚太陽在西方地平線下，眉月亮的是朝西、偏下方的那一邊。',
      observe: { main: 'ground', D: 3, T: 18.6, look: { az: 262, alt: 12 }, hideMoon: false, follow: true } };
  },
  order() {
    const seq = ['眉月', '上弦月', '滿月', '下弦月'];
    return { dim: 'phase', type: 'order', prompt: '🔢 從新月開始，依照「時間先後」把這四個月相排好（依序點選）', seq, tiles: shuffle(seq),
      setup: { main: 'space', D: 15, T: 24, cam: 'tilt', hideMoon: true, mask: { day: 1, phase: 1, info: 1 }, lock: { day: 1, time: 1 } },
      hint1: '新月之後，亮的部分會先越來越大。', hint2: '越來越大的叫「盈」，越來越小的叫「虧」；上弦在前、下弦在後。',
      explain: '新月 → 眉月 → 上弦月 → 滿月 → 下弦月 → 殘月，大約一個月一輪。', tag: 'phaseOrder',
      observe: { main: 'scope', D: 3, T: 18, hideMoon: false, play: 'day' } };
  },
  elong90() {
    const opts = shuffle([{ t: '約 90°', ok: true }, { t: '約 45°', tag: 'angle' }, { t: '約 180°', tag: 'angle' }, { t: '約 0°（同方向）', tag: 'shadow' }]);
    return { dim: 'cause', type: 'mc', prompt: '📐 上弦月時，從地球看，月亮和太陽大約相隔幾度？', opts, jOnly: true,
      setup: { main: 'space', D: 8, T: 18, cam: 'top', hideMoon: true, mask: { info: 1, phase: 1 }, lock: { day: 1, time: 1 } },
      hint1: '上弦月是「一半亮」。', hint2: '一半亮 → 我們從側面看被照亮的半球 → 地球、月亮連線和陽光垂直。',
      explain: '上弦月時月亮在太陽東邊約 90°；滿月 180°、下弦 270°（或西邊 90°）。', observe: { main: 'space', D: 8, T: 18, hideMoon: false, opt: { halves: true } } };
  },
  alignFull() {
    const opts = shuffle([{ t: '太陽—地球—月亮，地球在中間（但三者通常沒有剛好排成一直線）', ok: true }, { t: '太陽—月亮—地球，月亮在中間', tag: 'phaseOrder' }, { t: '三者排成直角', tag: 'angle' }, { t: '地球的影子剛好落在月亮上', tag: 'shadow' }]);
    return { dim: 'cause', type: 'mc', prompt: '🌕 滿月時，太陽、地球、月亮的排列大約是？', opts, jOnly: true,
      setup: { main: 'space', D: 15, T: 24, cam: 'side', hideMoon: true, mask: { info: 1, phase: 1, day: 1 }, lock: { day: 1, time: 1 } },
      hint1: '滿月時，被照亮的那一半整個朝向地球。', hint2: '月亮要在地球「背著太陽」的那一側，亮面才會整個朝向我們。',
      explain: '滿月時月亮在地球背著太陽的那一側；因為月球軌道和地球軌道有約 5° 的傾斜，大多數滿月不會被地球影子遮到——遮到時就是月食。', observe: { main: 'space', D: 15, T: 24, hideMoon: false, opt: { halves: true } } };
  },
  eclipse() {
    const opts = shuffle([{ t: '月相是看到月亮被照亮部分的多少；月食是月亮進入地球的影子', ok: true }, { t: '兩者都是地球影子造成的，只是遮的多少不同', tag: 'shadow' }, { t: '月食每個月都會發生一次', tag: 'eclipse' }, { t: '月相只會發生在滿月', tag: 'eclipse' }]);
    return { dim: 'cause', type: 'mc', prompt: '🌘 「月相」和「月食」最大的差別是什麼？', opts, jOnly: true,
      setup: { main: 'space', D: 15, T: 24, cam: 'tilt', mask: { info: 1 }, lock: { day: 1, time: 1 }, opt: { halves: true } },
      hint1: '月相每天都在變，月食卻很少發生。', hint2: '想想「影子」需要什麼條件：太陽、地球、月亮要剛好排成一直線。',
      explain: '月相是日地月相對位置造成的亮面變化，每天都在變；月食要三者剛好排成一直線、月亮進入地球影子，一年只有少數幾次。', observe: {} };
  }
};
const GEN_BY_DIM = {
  phase: ['phaseId', 'litSide', 'order'], time: ['where', 'bestTime'], motion: ['riseDelay', 'skyMove'],
  height: ['fists', 'direction8'], cause: ['makePhase', 'orbitPos', 'cause2', 'elong90', 'alignFull', 'eclipse']
};

// ---------------- 設定 ----------------
function getDefaultParams() {
  return { title: '日地月觀測挑戰', level: 'e', count: 8, dims: { phase: true, time: true, motion: true, height: true, cause: true }, hints: true, voice: true, allowRotate: true, maria: false };
}
function normCfg(c) {
  const d = getDefaultParams(); c = Object.assign({}, d, c || {});
  if (c.enableVoice === false && c.voice === d.voice) c.voice = false;
  c.dims = Object.assign({}, d.dims, c.dims || {});
  if (!Object.values(c.dims).some(Boolean)) c.dims = d.dims;
  c.count = [6, 8, 10, 12].includes(+c.count) ? +c.count : 8;
  c.level = c.level === 'j' ? 'j' : 'e';
  return c;
}
let qcfg = getDefaultParams();
let currentStudent = { roomCode: '00000', seatNo: '-', playerName: '探索者' };

// ---------------- 出題 ----------------
function buildQuiz(cfg) {
  const dims = Object.keys(DIMS).filter(k => cfg.dims[k]);
  const pool = {};
  const J_ONLY = ['elong90', 'alignFull', 'eclipse'];
  dims.forEach(d => { pool[d] = shuffle(GEN_BY_DIM[d].filter(g => cfg.level === 'j' || !J_ONLY.includes(g))); });
  const out = [], used = {};
  let order = shuffle(dims), guard = 0;
  while (out.length < cfg.count && guard++ < 200) {
    for (const d of order) {
      if (out.length >= cfg.count) break;
      const list = pool[d]; if (!list.length) continue;
      const g = list.find(x => !used[x]) || pick(list);
      if (used[g] >= 2) continue;
      used[g] = (used[g] || 0) + 1;
      const q = GEN[g](); q.gen = g; q.dim = q.dim || d; out.push(q);
    }
    order = shuffle(dims);
  }
  return shuffle(out);
}

// ---------------- 挑戰流程 ----------------
const QZ = { list: [], i: 0, res: [], t0: 0, combo: 0, maxCombo: 0, hints: 0, attempts: 0, tier: 1, t1ok: null, seq: [], answered: false };
function openQuizHome() {
  closeOverlay('result-overlay');
  const p = new URLSearchParams(location.search).get('code');
  try { const last = localStorage.getItem('MOON_QUIZ_CODE'); if ($('login-code') && !$('login-code').dataset.touched) $('login-code').value = p && /^\d{5}$/.test(p) ? p : (last || '00000'); } catch (e) {}
  showOverlay('quiz-home');
  if (typeof refreshSeatPickButton === 'function') try { refreshSeatPickButton(); } catch (e) {}
}
async function startCloudGame() {
  const codeEl = $('login-code');
  const code = (codeEl.value.trim().replace(/\D/g, '') || '00000').padStart(5, '0').slice(0, 5);
  codeEl.value = code;
  const seat = ($('login-seat').value || '').trim() || '-';
  const name = ($('login-name').value || '').trim() || '探索者';
  currentStudent = { roomCode: code, seatNo: seat, playerName: name };
  try { localStorage.setItem('MOON_QUIZ_CODE', code); } catch (e) {}
  const btn = $('start-btn'); btn.disabled = true; btn.textContent = '☁️ 正在載入挑戰設定…';
  const info = $('qz-code-info'); info.className = 'qz-code-info'; info.textContent = '';
  try {
    const data = await gasGet({ action: 'getRoomConfig', roomCode: code });
    const ok = data && data.status === 'success' && data.config && typeof data.config === 'object';
    if (ok) qcfg = normCfg(data.config);
    else if (code !== '00000') { info.className = 'qz-code-info err'; info.textContent = '❌ 挑戰代碼錯誤，請詢問老師'; qToast('❌ 挑戰代碼錯誤，請詢問老師'); codeEl.focus(); codeEl.select(); return; }
    else qcfg = getDefaultParams();
    if (code !== '00000') gasGet({ action: 'markPlayed', roomCode: code }).catch(() => {});
    closeOverlay('quiz-home');
    beginQuiz();
  } catch (err) {
    showConnError('（無法連到雲端題庫，請依上面兩步驟排除）');
  } finally { btn.disabled = false; btn.textContent = '🚀 開始挑戰'; }
}
function beginQuiz() {
  const M = QM(); if (!M) { qToast('3D 宇宙還在載入，請稍等一下再開始'); return; }
  QZ.levelBefore = M.S.level;
  QZ.list = buildQuiz(qcfg); QZ.i = 0; QZ.res = []; QZ.t0 = Date.now(); QZ.combo = 0; QZ.maxCombo = 0;
  document.body.classList.add('quiz');
  if (M.S.level !== qcfg.level) M.setLevel(qcfg.level);
  M.toast(`🏆 ${qcfg.title}：共 ${QZ.list.length} 題，加油！`);
  showQuestion();
}
function curQ() { return QZ.list[QZ.i]; }
function applySetup(st) {
  const M = QM(); if (!M) return;
  const s = Object.assign({}, st || {});
  s.opt = Object.assign({ maria: !!qcfg.maria, ghosts: false }, s.opt || {});
  M.setQuizState(s);
  document.body.classList.toggle('quiz-need-dock', !(s.lock && s.lock.day && s.lock.time));
  document.body.classList.toggle('quiz-no-rotate', !qcfg.allowRotate);
}
function showQuestion() {
  const q = curQ(); if (!q) return finishQuiz();
  QZ.hints = 0; QZ.attempts = 0; QZ.tier = 1; QZ.t1ok = null; QZ.seq = []; QZ.answered = false;
  applySetup(q.setup);
  renderBar();
  speak(q.prompt);
}
function progressHtml() {
  return QZ.list.map((_, k) => { const r = QZ.res[k]; return `<i class="${k === QZ.i && !QZ.answered ? 'cur' : r ? (r.pts >= 100 ? 'ok' : r.pts > 0 ? 'part' : 'ng') : ''}"></i>`; }).join('');
}
function totalScore() { return QZ.res.length ? Math.round(QZ.res.reduce((a, r) => a + r.pts, 0) / QZ.list.length) : 0; }
function renderBar(fbHtml) {
  const q = curQ(), bar = $('quiz-bar'), dim = DIMS[q.dim];
  const head = `<div class="qb-top"><span class="qb-no">第 ${QZ.i + 1} / ${QZ.list.length} 題</span><span class="qb-prog">${progressHtml()}</span>
    <span class="qb-dim">${dim.icon} ${dim.name}</span><span class="qb-score">⭐ ${totalScore()} 分</span>
    <button type="button" class="qb-iconbtn" onclick="speak(QZ.tier===2?curQ().tier2Prompt:curQ().prompt)" title="唸題目">🔊</button>
    <button type="button" class="qb-iconbtn" onclick="exitQuiz()" title="離開挑戰">✕</button></div>`;
  let body = '';
  if (q.type === 'two' && QZ.tier === 2) body = `<div class="qb-q"><span class="tier">第二段：理由</span>${esc(q.tier2Prompt)}</div>${optsHtml(q.tier2)}`;
  else if (q.type === 'two') body = `<div class="qb-q"><span class="tier">第一段：答案</span>${esc(q.prompt)}</div>${optsHtml(q.opts)}`;
  else if (q.type === 'mc') body = `<div class="qb-q">${esc(q.prompt)}</div>${optsHtml(q.opts)}`;
  else if (q.type === 'manip') body = `<div class="qb-q">${esc(q.prompt)}</div><div class="qb-manip">👇 用下方的滑桿操作，右邊小畫面會跟著變。${QZ.attempts ? '<b>（再試一次！）</b>' : ''}</div>`;
  else if (q.type === 'order') body = `<div class="qb-q">${esc(q.prompt)}</div><div class="qb-order">${q.tiles.map(t => `<button type="button" class="qb-tile ${QZ.seq.includes(t) ? 'used' : ''}" ${QZ.answered ? 'disabled' : ''} onclick="orderTap('${t}')"><span class="em">${PH_EMOJI[t]}</span>${t}${QZ.seq.includes(t) ? `<span class="n">${QZ.seq.indexOf(t) + 1}</span>` : ''}</button>`).join('')}</div>
    <div class="qb-seq">🌑 新月 → ${[0, 1, 2, 3].map(k => `<span class="slot">${QZ.seq[k] ? PH_EMOJI[QZ.seq[k]] + ' ' + QZ.seq[k] : '？'}</span>`).join(' → ')}</div>`;
  let act = '';
  if (!QZ.answered) {
    if (q.type === 'manip') act += `<button type="button" class="qb-go" onclick="checkManip()">✅ 我調好了</button>`;
    if (q.type === 'order') act += `<button type="button" class="qb-hint" onclick="orderClear()">↩️ 重新排</button>`;
    if (qcfg.hints && QZ.hints < 2) act += `<button type="button" class="qb-hint" onclick="useHint()">💡 提示${QZ.hints ? '（再一個）' : ''}<small> -20 分</small></button>`;
  } else {
    act += `<button type="button" class="qb-go blue" onclick="nextQuestion()">${QZ.i + 1 >= QZ.list.length ? '🏁 看成績' : '下一題 ➜'}</button>`;
  }
  const hintBox = QZ.hints ? `<div class="qb-hintbox">💡 ${esc(q.hint1)}${QZ.hints > 1 ? '<br>💡 ' + esc(q.hint2) : ''}</div>` : '';
  bar.innerHTML = head + body + hintBox + (fbHtml || '') + `<div class="qb-act">${act}</div>`;
}
function optsHtml(opts) {
  return `<div class="qb-opts">${opts.map((o, k) => `<button type="button" class="qb-opt ${o._mark || ''}" ${QZ.answered || o._dis ? 'disabled' : ''} onclick="answerOpt(${k})"><b>${'ABCD'[k]}</b>${esc(o.t)}</button>`).join('')}</div>`;
}
function useHint() { QZ.hints = Math.min(2, QZ.hints + 1); renderBar(); speak(QZ.hints === 1 ? curQ().hint1 : curQ().hint2); }
function hintPenalty(p) { return p > 0 ? Math.max(40, p - QZ.hints * 20) : 0; }
function answerOpt(k) {
  const q = curQ(); if (QZ.answered) return;
  if (q.type === 'two' && QZ.tier === 1) {
    const o = q.opts[k]; QZ.t1ok = !!o.ok; QZ.t1tag = o.tag;
    q.opts.forEach(x => { x._dis = true; x._mark = x === o ? (o.ok ? 'right' : 'wrong') : ''; });
    QZ.tier = 2; renderBar(); speak(q.tier2Prompt); return;
  }
  const opts = q.type === 'two' ? q.tier2 : q.opts, o = opts[k];
  opts.forEach(x => { x._mark = x.ok ? 'right' : (x === o ? 'wrong' : ''); });
  let pts, tags = [];
  if (q.type === 'two') {
    pts = QZ.t1ok && o.ok ? 100 : QZ.t1ok ? 60 : o.ok ? 20 : 0;
    if (!QZ.t1ok && QZ.t1tag) tags.push(QZ.t1tag); if (!o.ok && o.tag) tags.push(o.tag);
  } else { pts = o.ok ? 100 : 0; if (!o.ok && o.tag) tags.push(o.tag); }
  finishAnswer(hintPenalty(pts), tags);
}
function orderTap(t) { if (QZ.answered || QZ.seq.includes(t)) return; QZ.seq.push(t); if (QZ.seq.length === 4) { const ok = QZ.seq.join() === curQ().seq.join(); finishAnswer(hintPenalty(ok ? 100 : 0), ok ? [] : ['phaseOrder']); } else renderBar(); }
function orderClear() { QZ.seq = []; renderBar(); }
function checkManip() {
  const q = curQ(); if (QZ.answered) return;
  if (q.check()) { finishAnswer(hintPenalty(QZ.attempts ? 60 : 100), []); return; }
  QZ.attempts++;
  if (QZ.attempts < 2) { qToast('還不太對，再調調看！可以按「💡 提示」'); renderBar(`<div class="qb-fb ng"><span class="big">🤏 還差一點！</span>再試一次。</div>`); return; }
  QM().setQuizState(Object.assign({}, q.setup, { D: q.solve.D, T: q.solve.T, lock: { day: 1, time: 1 }, mask: { info: 1 } }));
  finishAnswer(0, [q.tag || 'phaseOrder']);
}
function finishAnswer(pts, tags) {
  const q = curQ(); QZ.answered = true;
  QZ.res[QZ.i] = { pts, dim: q.dim, tags, gen: q.gen };
  if (pts >= 100) { QZ.combo++; QZ.maxCombo = Math.max(QZ.maxCombo, QZ.combo); } else QZ.combo = 0;
  sfx(pts >= 100 ? 'ok' : pts > 0 ? 'part' : 'ng');
  // 👀 觀察：把答案在 3D 宇宙裡演出來
  const ob = q.observe || {};
  const st = Object.assign({}, q.setup, ob, { lock: { day: 1, time: 1 }, mask: Object.assign({}, ob.mask || {}), hideMoon: ob.hideMoon !== undefined ? ob.hideMoon : false, marks: ob.marks !== undefined ? ob.marks : q.setup.marks });
  if (q.gen === 'makePhase') st.D = QM().S.D;
  applySetup(st);
  if (ob.play) setTimeout(() => { const M = QM(); M.S.lock = { day: 0, time: 0 }; document.querySelectorAll('.play').forEach(b => b.disabled = false); M.play(ob.play); }, 400);
  const cls = pts >= 100 ? 'ok' : pts > 0 ? 'part' : 'ng';
  const big = pts >= 100 ? `🎉 答對了！+${pts}` : pts > 0 ? `👍 答對一部分 +${pts}` : '💪 這題沒答對';
  const tip = tags.length ? `<br>🧠 ${esc(TAGS[tags[0]] ? TAGS[tags[0]].tip : '')}` : '';
  renderBar(`<div class="qb-fb ${cls}"><span class="big">${big}</span>👀 ${esc(q.explain)}${tip}</div>`);
  speak((pts >= 100 ? '答對了！' : '') + q.explain);
}
function nextQuestion() { QM().stopPlay(); QZ.i++; if (QZ.i >= QZ.list.length) finishQuiz(); else showQuestion(); }
let sfxCtx = null;
function sfx(kind) {
  try {
    sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)(); if (sfxCtx.state === 'suspended') sfxCtx.resume();
    const notes = kind === 'ok' ? [660, 880, 1320] : kind === 'part' ? [660, 780] : [300, 220];
    notes.forEach((f, i) => { const o = sfxCtx.createOscillator(), g = sfxCtx.createGain(), t = sfxCtx.currentTime + i * 0.09;
      o.type = 'triangle'; o.frequency.value = f; g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(sfxCtx.destination); o.start(t); o.stop(t + 0.2); });
  } catch (e) {}
}
function rankOf(s) { return s >= 90 ? '🌕 滿月天文大師' : s >= 75 ? '🌔 盈凸月探險家' : s >= 60 ? '🌓 上弦月研究員' : s >= 40 ? '🌒 眉月觀測員' : '🌑 新月見習生'; }
function wrongSummary() {
  const items = [];
  QZ.res.forEach(r => { if (r.pts < 100) { const t = r.tags[0]; items.push(`${DIMS[r.dim].name}${t && TAGS[t] ? '(' + TAGS[t].name + ')' : ''}`); } });
  return items.length ? Array.from(new Set(items)).join('、') : '全對無失誤';
}
let lastPayload = null;
async function finishQuiz() {
  const M = QM(); M.stopPlay();
  document.body.classList.remove('quiz', 'quiz-need-dock', 'quiz-no-rotate');
  M.setQuizState({ main: 'space', mask: {}, lock: {} });
  const score = totalScore(), rank = rankOf(score), sec = Math.max(5, Math.round((Date.now() - QZ.t0) / 1000));
  const full = QZ.res.filter(r => r.pts >= 100).length;
  // 成績畫面
  $('res-head').innerHTML = `<h2>🏁 ${esc(qcfg.title)}・挑戰完成！</h2><div class="res-score"><div class="num">${score}<small> 分</small></div>
    <div><div class="rk">${rank}</div><div class="meta">${esc(currentStudent.playerName)}${currentStudent.seatNo !== '-' ? '・' + esc(currentStudent.seatNo) + ' 號' : ''}｜全對 ${full}/${QZ.list.length} 題｜最高連對 ${QZ.maxCombo}｜${Math.floor(sec / 60)} 分 ${sec % 60} 秒</div></div></div>`;
  const byDim = {};
  QZ.res.forEach(r => { byDim[r.dim] = byDim[r.dim] || { n: 0, s: 0 }; byDim[r.dim].n++; byDim[r.dim].s += r.pts; });
  $('res-dims').innerHTML = `<div class="res-dims">${Object.entries(byDim).map(([d, v]) => { const p = Math.round(v.s / v.n); return `<div class="res-dim">${DIMS[d].icon} ${DIMS[d].name}<br><b style="color:${p >= 80 ? '#4ade80' : p >= 50 ? '#fbbf24' : '#f87171'}">${p} 分</b><div class="bar"><i style="width:${p}%"></i></div></div>`; }).join('')}</div>`;
  const tags = Array.from(new Set(QZ.res.flatMap(r => r.tags))).filter(t => TAGS[t]);
  $('res-tips').innerHTML = tags.length ? tags.slice(0, 3).map(t => `<div class="res-tip">🧠 <b>${esc(TAGS[t].name)}</b>：${esc(TAGS[t].tip)}</div>`).join('') : `<div class="res-tip" style="border-color:#4ade80;background:rgba(34,197,94,.12)">🌟 太厲害了，所有概念都掌握了！</div>`;
  $('result-board-tbody').innerHTML = '';
  showOverlay('result-overlay');
  lastPayload = {
    action: 'submitScore', roomCode: currentStudent.roomCode, seatNo: currentStudent.seatNo, playerName: currentStudent.playerName,
    score, correctCount: full, wrongCount: QZ.list.length - full, maxCombo: QZ.maxCombo, durationSeconds: sec,
    rankTitle: `${rank}||${qcfg.title}||${wrongSummary()}`, topicSummary: qcfg.title, wrongDetails: wrongSummary()
  };
  uploadScore();
}
async function uploadScore() {
  const st = $('res-upload'); st.innerHTML = '☁️ 正在上傳成績…';
  try {
    const data = await gasPost(lastPayload);
    if (data && data.status === 'success') { st.innerHTML = '✅ 成績已紀錄到雲端！'; renderBoardRows($('result-board-tbody'), (data.leaderboard || []).map(unpackLogRecord), currentStudent); }
    else st.innerHTML = `⚠️ 上傳失敗：${esc((data && data.message) || '未知錯誤')} <button type="button" class="retry" onclick="uploadScore()">🔁 再上傳一次</button>`;
  } catch (e) { st.innerHTML = '⚠️ 網路不穩，成績還沒上傳 <button type="button" class="retry" onclick="uploadScore()">🔁 再上傳一次</button>'; }
}
function renderBoardRows(tbody, list, me) {
  if (!list.length) { tbody.innerHTML = '<tr><td colspan="9">目前還沒有紀錄，你可以當第一名！</td></tr>'; return; }
  tbody.innerHTML = list.slice(0, 100).map((it, k) => {
    const isMe = me && String(it.playerName) === String(me.playerName) && String(it.seatNo) === String(me.seatNo);
    return `<tr class="${isMe ? 'me' : ''}"><td>${k < 3 ? ['🥇', '🥈', '🥉'][k] : k + 1}</td><td>${esc(it.seatNo)}</td><td>${esc(it.playerName)}</td><td class="sc">${esc(it.score)}</td>
      <td><span class="ok">${esc(it.correctCount)}</span> / <span class="ng">${esc(it.wrongCount)}</span></td><td>${esc(it.maxCombo)}</td><td>${esc(it.rankTitle)}</td><td>${esc(it.attempts || 1)} 次</td><td>${esc(String(it.timestamp || '').substring(5, 16))}</td></tr>`;
  }).join('');
}
function retryChallenge() { closeOverlay('result-overlay'); startCloudGame(); }
function exitQuiz(silent) {
  if (!silent && document.body.classList.contains('quiz') && !confirm('確定要離開挑戰嗎？這次的成績不會上傳。')) return;
  const M = QM(); try { speechSynthesis.cancel(); } catch (e) {}
  document.body.classList.remove('quiz', 'quiz-need-dock', 'quiz-no-rotate');
  closeOverlay('result-overlay');
  if (M) { M.setQuizState({ mask: {}, lock: {} }); if (QZ.levelBefore && M.S.level !== QZ.levelBefore) M.setLevel(QZ.levelBefore); }
}
// 首頁排行榜（最近 20 天，由座號點選模組換算）
async function openHomeBoard() {
  const m = $('home-board-modal'); m.style.display = 'flex';
  const tb = $('modal-board-tbody'); tb.innerHTML = '<tr><td colspan="9">☁️ 讀取中…</td></tr>';
  const code = (($('login-code').value || '').replace(/\D/g, '') || '00000').padStart(5, '0');
  try { const data = await gasGet({ action: 'getLeaderboard', roomCode: code }); renderBoardRows(tb, ((data && data.leaderboard) || []).map(unpackLogRecord), null); }
  catch (e) { tb.innerHTML = '<tr><td colspan="9">⚠️ 讀取失敗，請稍後再試</td></tr>'; }
}
function closeHomeBoard() { $('home-board-modal').style.display = 'none'; }

// =====================================================================
// 👩‍🏫 教師後台（專屬通行碼＋5 組額度）
// =====================================================================
const adminSession = { teacherPass: '', teacherName: '', isSuperAdmin: false, myRooms: [], remainingQuota: 5, maxQuota: 5, roomCode: '', roomPin: '', config: null };
function openTeacherLogin() { showOverlay('teacher-login-modal'); setTimeout(() => { const i = $('teacher-pass-input'); if (i) i.focus(); }, 60); }
async function verifyTeacherStep1() {
  const inp = $('teacher-pass-input'), pass = inp.value.trim();
  if (!pass) { qToast('⚠️ 請輸入您的教師專屬通行碼！'); return; }
  qToast('☁️ 正在驗證教師通行碼與查詢額度…');
  try {
    const data = await gasPost({ action: 'verifyTeacherPass', teacherPass: pass });
    if (data && data.status === 'success' && data.user) {
      Object.assign(adminSession, { teacherPass: data.user.passCode, teacherName: data.user.name, isSuperAdmin: !!data.user.isSuperAdmin, myRooms: data.myRooms || [], remainingQuota: data.remainingQuota, maxQuota: data.user.maxQuota || 5 });
      inp.value = ''; closeOverlay('teacher-login-modal'); openTeacherRoomModal();
    } else { qToast((data && data.message) || '❌ 通行碼無效'); inp.value = ''; inp.focus(); }
  } catch (e) { showConnError('（教師驗證連線失敗）'); }
}
function openTeacherRoomModal() {
  const rem = adminSession.remainingQuota ?? 5, maxQ = adminSession.maxQuota || 5;
  $('teacher-quota-banner').innerHTML = `👋 <b>${esc(adminSession.teacherName || '老師')}</b> 您好！本遊戲剩餘額度：<b style="color:${rem > 0 ? '#4ade80' : '#f87171'}">${rem} / ${maxQ} 組</b>
    ${adminSession.myRooms.length ? `<div style="margin-top:6px">📂 您已建立的代碼（點一下直接進入）：<div class="qz-chips" style="margin-top:6px">${adminSession.myRooms.map(r => `<button type="button" class="qz-chip" onclick="quickEnterMyRoom('${esc(r.roomCode)}')">🔑 ${esc(r.roomCode)}・${esc(r.title)}</button>`).join('')}</div></div>` : ''}`;
  const btn = $('btn-create-room');
  if (rem <= 0 && !adminSession.isSuperAdmin) { btn.disabled = true; btn.textContent = '🛑 額度已滿（請維護既有代碼）'; switchRoomMode('maintain'); }
  else { btn.disabled = false; btn.textContent = '✨ 建立代碼並進入後台'; switchRoomMode('create'); fetchSuggestedCodes(); }
  showOverlay('teacher-room-modal');
}
function switchRoomMode(m) { $('rm-create').style.display = m === 'create' ? '' : 'none'; $('rm-maintain').style.display = m === 'maintain' ? '' : 'none'; $('rm-tab-create').classList.toggle('on', m === 'create'); $('rm-tab-maintain').classList.toggle('on', m === 'maintain'); }
async function fetchSuggestedCodes() {
  const box = $('create-suggest'); box.innerHTML = '';
  try { const d = await gasGet({ action: 'getRecommendedCodes' }); const list = (d && d.recommended) || [];
    box.innerHTML = list.map(c => `<button type="button" class="qz-chip" onclick="document.getElementById('create-code').value='${esc(c)}'">✨ ${esc(c)}</button>`).join('');
    if (!$('create-code').value && list[0]) $('create-code').value = list[0];
  } catch (e) {}
}
async function quickEnterMyRoom(code) { $('maintain-code').value = code; $('maintain-pin').value = ''; await submitMaintainRoom(); }
async function submitCreateRoom() {
  const code = ($('create-code').value || '').replace(/\D/g, '');
  if (code.length !== 5) { qToast('⚠️ 請輸入完整的 5 位數字代碼！'); return; }
  if (code === '00000') { qToast('⚠️ 00000 是公開自學代碼，請換一組'); return; }
  const pin = $('create-pin').value.trim(); if (!pin) { qToast('⚠️ 請設定管理密碼！'); return; }
  const cfg = getDefaultParams();
  try {
    const d = await gasPost({ action: 'createNewRoom', roomCode: code, teacherPin: pin, teacherPass: adminSession.teacherPass, config: cfg });
    if (d.status === 'success') { qToast(d.message); $('create-pin').value = ''; enterAdmin(code, pin, cfg); }
    else qToast(d.message || '建立失敗');
  } catch (e) { showConnError('（建立代碼連線失敗）'); }
}
async function submitMaintainRoom() {
  const code = (($('maintain-code').value || '').replace(/\D/g, '') || '00000').padStart(5, '0'), pin = $('maintain-pin').value.trim();
  try {
    const d = await gasPost({ action: 'verifyRoomPin', roomCode: code, teacherPin: pin, teacherPass: adminSession.teacherPass });
    if (d.status === 'success') { qToast(d.message); $('maintain-pin').value = ''; adminSession.isSuperAdmin = adminSession.isSuperAdmin || !!d.isSuperAdmin; enterAdmin(code, d.roomPin || pin, normCfg(d.config)); }
    else qToast(d.message || '驗證失敗');
  } catch (e) { showConnError('（驗證代碼連線失敗）'); }
}
function enterAdmin(code, pin, cfg) {
  adminSession.roomCode = code; adminSession.roomPin = pin; adminSession.config = normCfg(cfg);
  closeOverlay('teacher-room-modal');
  $('admin-title').textContent = `⚙️ 代碼 [${code}] 管理後台`;
  renderAdminTasks(); switchAdminTab('tasks'); showOverlay('admin-overlay');
}
function switchAdminTab(t) {
  ['tasks', 'records', 'diag'].forEach(k => { $('admin-panel-' + k).style.display = k === t ? '' : 'none'; });
  document.querySelectorAll('[data-atab]').forEach(b => b.classList.toggle('on', b.dataset.atab === t));
  if (t === 'records') loadRecords(); if (t === 'diag') runDiag();
}
function renderAdminTasks() {
  const c = adminSession.config, panel = $('admin-panel-tasks');
  const lock = $('sp-admin-lock');               // 座號點選模組的「指定可以玩的班級」區塊（保留）
  const html = `
    <div class="adm-sec"><h3>📝 基本設定</h3>
      <div class="adm-row"><label>挑戰名稱</label><input type="text" id="cfg-title" maxlength="30" value="${esc(c.title)}"></div>
      <div class="adm-row"><label>程度</label><span class="adm-seg" id="cfg-level"><button type="button" data-v="e" class="${c.level === 'e' ? 'on' : ''}">🎒 國小</button><button type="button" data-v="j" class="${c.level === 'j' ? 'on' : ''}">📐 國中（加考成因與月食）</button></span></div>
      <div class="adm-row"><label>題數</label><span class="adm-seg" id="cfg-count">${[6, 8, 10, 12].map(n => `<button type="button" data-v="${n}" class="${c.count === n ? 'on' : ''}">${n} 題</button>`).join('')}</span></div>
      <p class="adm-note">題目每次都會從題庫隨機產生、選項也會打亂，學生無法背答案。</p></div>
    <div class="adm-sec"><h3>🎯 要考哪些概念</h3><div class="adm-grid">
      ${Object.entries(DIMS).map(([k, d]) => `<label class="adm-check"><input type="checkbox" data-dim="${k}" ${c.dims[k] ? 'checked' : ''}> ${d.icon} ${d.name}</label>`).join('')}</div></div>
    <div class="adm-sec"><h3>🛠 其他</h3><div class="adm-grid">
      <label class="adm-check"><input type="checkbox" id="cfg-hints" ${c.hints ? 'checked' : ''}> 💡 允許使用提示（每次 -20 分）</label>
      <label class="adm-check"><input type="checkbox" id="cfg-voice" ${c.voice ? 'checked' : ''}> 🔊 語音唸題目</label>
      <label class="adm-check"><input type="checkbox" id="cfg-rotate" ${c.allowRotate ? 'checked' : ''}> 🌍 測驗中可以轉動 3D 太空</label>
      <label class="adm-check"><input type="checkbox" id="cfg-maria" ${c.maria ? 'checked' : ''}> 🗺 顯示月海標示（玉兔）</label></div></div>
    <div class="adm-sec"><h3>🔗 給學生的連結</h3><div class="adm-row"><code id="stu-link" style="flex:1;word-break:break-all;color:#bae6fd">${esc(location.href.split('?')[0] + '?code=' + adminSession.roomCode)}</code>
      <button type="button" class="qb-hint" onclick="copyStuLink()">📋 複製</button></div><p class="adm-note">學生開這個連結會直接帶入代碼；也可以請學生按「🏆 挑戰測驗」自己輸入代碼。</p></div>
    <div class="adm-save"><button type="button" class="qz-start" onclick="saveAdminConfig()">💾 儲存設定</button></div>`;
  panel.innerHTML = html;
  if (lock) panel.insertBefore(lock, panel.firstChild);
  else if (typeof window.spAdminClear === 'function') { const box = document.createElement('div'); box.id = 'sp-admin-lock'; box.className = 'sp-admin-lock'; panel.insertBefore(box, panel.firstChild); }
  panel.querySelectorAll('.adm-seg').forEach(seg => seg.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }));
}
function copyStuLink() { const t = $('stu-link').textContent; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => qToast('📋 已複製學生連結')).catch(() => prompt('請複製這個連結：', t)); }
async function saveAdminConfig() {
  const c = Object.assign({}, adminSession.config);
  c.title = ($('cfg-title').value || '').trim() || '日地月觀測挑戰';
  c.level = ($('cfg-level').querySelector('.on') || {}).dataset?.v || 'e';
  c.count = +(($('cfg-count').querySelector('.on') || {}).dataset?.v || 8);
  c.dims = {}; document.querySelectorAll('[data-dim]').forEach(x => { c.dims[x.dataset.dim] = x.checked; });
  if (!Object.values(c.dims).some(Boolean)) { qToast('⚠️ 至少要選一個概念！'); return; }
  c.hints = $('cfg-hints').checked; c.voice = $('cfg-voice').checked; c.allowRotate = $('cfg-rotate').checked; c.maria = $('cfg-maria').checked;
  c.enableVoice = c.voice; c.allowRotateInQuiz = c.allowRotate; c.showRabbitInQuiz = c.maria;
  c.tasks = [{ task: c.title, correct: ['O'], wrong: ['X'] }];
  delete c.roomPin;
  try {
    const d = await gasPost({ action: 'saveRoomConfig', roomCode: adminSession.roomCode, teacherPin: adminSession.roomPin, teacherPass: adminSession.teacherPass, config: c });
    if (d.status === 'success') { adminSession.config = normCfg(c); qToast('✅ 已儲存！學生下次開始挑戰就會套用'); }
    else qToast(d.message || '儲存失敗');
  } catch (e) { showConnError('（儲存設定連線失敗）'); }
}
let adminLogs = [];
async function loadRecords() {
  const p = $('admin-panel-records');
  p.innerHTML = '<div class="adm-sec">☁️ 正在讀取成績…</div>';
  try {
    const d = await gasGet({ action: 'getTeacherRecords', roomCode: adminSession.roomCode });
    adminLogs = ((d && d.allLogs) || []).map(unpackLogRecord);
    renderRecords();
  } catch (e) { p.innerHTML = '<div class="adm-sec">⚠️ 讀取失敗，請到「🩺 連線檢查」看看。</div>'; }
}
function parseWrong(w) {
  const out = []; if (!w || w === '全對無失誤' || w === '無') return out;
  String(w).split('、').forEach(it => { const m = it.match(/^([^()]+)(?:\(([^)]+)\))?$/); if (m) out.push({ dim: m[1].trim(), tag: (m[2] || '').trim() }); });
  return out;
}
function renderRecords() {
  const p = $('admin-panel-records'), n = adminLogs.length;
  const latest = {}; adminLogs.forEach(r => { const k = r.seatNo + '|' + r.playerName; if (!latest[k]) latest[k] = r; });
  const people = Object.values(latest), np = people.length || 1;
  const dimCnt = {}, tagCnt = {};
  people.forEach(r => parseWrong(r.wrongDetails).forEach(x => { dimCnt[x.dim] = (dimCnt[x.dim] || 0) + 1; if (x.tag) tagCnt[x.tag] = (tagCnt[x.tag] || 0) + 1; }));
  const avg = people.length ? Math.round(people.reduce((a, r) => a + (+r.score || 0), 0) / people.length) : 0;
  const tagTip = name => { const e = Object.values(TAGS).find(t => t.name === name); return e ? e.tip : ''; };
  const dimRows = Object.entries(dimCnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="diag-bar"><span>${esc(k)}</span><span class="b"><i style="width:${Math.round(v / np * 100)}%"></i></span><span>${v} 人</span></div>`).join('') || '<p class="adm-note">目前沒有錯誤紀錄 🎉</p>';
  const tagRows = Object.entries(tagCnt).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `<div class="res-tip"><b>${esc(k)}</b>（${v} 人）：${esc(tagTip(k))}</div>`).join('') || '<p class="adm-note">沒有明顯的迷思。</p>';
  p.innerHTML = `
    <div class="adm-sec"><h3>🩺 全班概念診斷（每人看最近一次）</h3>
      <p class="adm-note">共 ${people.length} 位學生、${n} 筆紀錄；平均 ${avg} 分。長條＝有多少人在這個概念出錯。</p>${dimRows}
      <h3 style="margin-top:10px">🧠 最常見的迷思與補救建議</h3>${tagRows}</div>
    <div class="adm-sec"><h3>📋 完整紀錄</h3>
      <div class="adm-tools"><button type="button" onclick="loadRecords()">🔄 重新整理</button><button type="button" onclick="exportCsv()">📥 匯出 CSV</button><button type="button" class="danger" onclick="clearScores()">🧹 清空這個代碼的成績</button></div>
      <div class="qz-table-wrap" style="max-height:none"><table class="qz-table"><thead><tr><th>時間</th><th>座號</th><th>姓名</th><th>分數</th><th>全對/未全對</th><th>秒數</th><th>稱號</th><th>需要加強</th></tr></thead><tbody>
      ${adminLogs.map(r => `<tr><td>${esc(String(r.timestamp).substring(5, 16))}</td><td>${esc(r.seatNo)}</td><td>${esc(r.playerName)}</td><td class="sc">${esc(r.score)}</td><td>${esc(r.correctCount)} / ${esc(r.wrongCount)}</td><td>${esc(r.durationSeconds)}</td><td>${esc(r.rankTitle)}</td><td style="text-align:left">${esc(r.wrongDetails)}</td></tr>`).join('') || '<tr><td colspan="8">尚無紀錄</td></tr>'}
      </tbody></table></div></div>`;
}
function exportCsv() {
  const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  let csv = '挑戰時間,挑戰代碼,座號,姓名,總分,全對題數,未全對題數,最高連對,使用秒數,稱號,挑戰名稱,需要加強的概念\n';
  adminLogs.forEach(r => { csv += [r.timestamp, r.roomCode, r.seatNo, r.playerName, r.score, r.correctCount, r.wrongCount, r.maxCombo, r.durationSeconds, r.rankTitle, r.topicSummary, r.wrongDetails].map(q).join(',') + '\n'; });
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `日地月挑戰_${adminSession.roomCode}_成績.csv`; document.body.appendChild(a); a.click(); a.remove();
}
async function clearScores() {
  const ans = prompt(`⚠️ 要清空代碼 [${adminSession.roomCode}] 的「全部成績」嗎？\n這個動作不能復原。確定的話，請輸入代碼 ${adminSession.roomCode}：`);
  if (ans === null) return; if (ans.trim() !== adminSession.roomCode) { qToast('代碼不符，已取消'); return; }
  try {
    const d = await gasPost({ action: 'clearRoomScores', roomCode: adminSession.roomCode, teacherPin: adminSession.roomPin, teacherPass: adminSession.teacherPass });
    qToast(d.message || (d.status === 'success' ? '已清空' : '清空失敗')); loadRecords();
  } catch (e) { showConnError('（清空成績連線失敗）'); }
}
async function runDiag() {
  const p = $('admin-panel-diag'); p.innerHTML = '<div class="adm-sec">🩺 檢查中…</div>';
  const rows = [];
  const t0 = performance.now();
  try { const r = await fetch(`${getGasUrl()}?t=${Date.now()}`, { method: 'GET', credentials: 'omit', redirect: 'follow' }); const d = await r.json(); rows.push(['☁️ 雲端後台', `✅ 正常（${esc(d.version || d.status)}，${Math.round(performance.now() - t0)} 毫秒）`]);
    if (!/v3\.3/.test(String(d.version || ''))) rows.push(['🔐 後台版本', '⚠️ 建議更新成 Code.gs v3.3（保護管理密碼、清空成績要驗證）']); else rows.push(['🔐 後台版本', '✅ 已是 v3.3']);
  } catch (e) { rows.push(['☁️ 雲端後台', '❌ 連不上（請檢查網路，或確認 GAS 已部署為「任何人」可存取）']); }
  try { const d = await gasGet({ action: 'getRoomConfig', roomCode: adminSession.roomCode }); const leak = d && d.config && ('roomPin' in d.config);
    rows.push(['📥 讀取這組代碼', d && d.status === 'success' ? '✅ 正常' : '⚠️ ' + esc(d && d.status)]); rows.push(['🛡 管理密碼保護', leak ? '❌ 學生端讀得到管理密碼！請更新後台 v3.3' : '✅ 學生端讀不到管理密碼']);
  } catch (e) { rows.push(['📥 讀取這組代碼', '❌ 失敗']); }
  rows.push(['🖥 3D 顯示', QM() && QM().ready() ? '✅ 正常' : '⏳ 載入中']);
  p.innerHTML = `<div class="adm-sec"><h3>🩺 連線檢查</h3><table class="qz-table"><tbody>${rows.map(r => `<tr><td style="text-align:left;width:160px">${r[0]}</td><td style="text-align:left">${r[1]}</td></tr>`).join('')}</tbody></table>
    <p class="adm-note" style="margin-top:8px">後端網址已固定在程式碼裡（${esc(getGasUrl().slice(0, 60))}…）。</p></div>`;
}

// ---------------- 網址帶代碼：直接打開挑戰 ----------------
window.addEventListener('load', () => {
  const c = new URLSearchParams(location.search).get('code');
  const codeEl = $('login-code'); if (codeEl) codeEl.addEventListener('input', () => { codeEl.dataset.touched = '1'; });
  if (c && /^\d{5}$/.test(c)) setTimeout(() => { $('login-code').value = c; openQuizHome(); }, 600);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') ['quiz-home', 'teacher-login-modal', 'teacher-room-modal', 'conn-error-modal'].forEach(closeOverlay); });

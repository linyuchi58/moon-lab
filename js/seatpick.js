        // =====================================================================
        // 🎒 年級・班級・座號 點選器（取代「姓名或暱稱」輸入）—— 全部遊戲共用
        //  ・學生只用點的，不能打字（避免不雅暱稱）
        //  ・座號存在「座號」欄，「五年3班」存在「姓名」欄 → 後端不用改，舊成績照常顯示
        //  ・00000 公開練習可以選「隨機可愛暱稱」
        //  ・老師可在後台指定可以玩的班級（可複選，預設不限制）
        // =====================================================================
        (function () {
            const SP_KEY = 'GAME_SEAT_PICK_V1';
            const SP_STALE_MS = 45 * 60 * 1000;   // 超過一節課 → 開始前再確認一次（同一台平板可能換人）
            const SP_GRADES = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '其他'];
            const SP_CLASS_SETS = [
                { key: 'num', label: '1、2、3', list: Array.from({ length: 20 }, (_, i) => String(i + 1)) },
                { key: 'tg', label: '甲乙丙', list: ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] },
                { key: 'zx', label: '忠孝仁愛', list: ['忠', '孝', '仁', '愛', '信', '義', '和', '平'] },
                { key: 'zr', label: '智仁勇', list: ['智', '仁', '勇'] },
                { key: 'ml', label: '梅蘭竹菊', list: ['梅', '蘭', '竹', '菊'] }
            ];
            const SP_ADJ = ['勇敢的', '快樂的', '聰明的', '閃亮的', '好奇的', '熱血的', '溫柔的', '神奇的', '機智的', '開心的', '超酷的', '努力的', '認真的', '可愛的', '帥氣的', '活力的', '冷靜的', '幸運的', '飛快的', '無敵的'];
            const SP_ANIMALS = ['柴犬', '熊貓', '企鵝', '小狐狸', '無尾熊', '海豚', '小松鼠', '貓頭鷹', '小白兔', '長頸鹿', '水獺', '小恐龍', '獨角獸', '小老虎', '北極熊', '小海豹', '刺蝟', '鸚鵡', '小鹿', '樹懶'];
            const spLockCache = {};      // 代碼 → 老師指定的班級 [{g,c}]
            let spPick = { g: '', c: '', s: '', nick: '', at: 0 };
            let spDraft = null, spOpts = {}, spTab = 'num', spBusy = false;
            let adminLockClasses = [], adminLockGrade = '五', adminLockTab = 'num';

            try { const o = JSON.parse(localStorage.getItem(SP_KEY) || 'null'); if (o && typeof o === 'object') spPick = Object.assign(spPick, o); } catch (e) {}
            function savePick() { try { localStorage.setItem(SP_KEY, JSON.stringify(spPick)); } catch (e) {} }
            function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
            function classStr(g, c) { if (!c) return ''; return (g && g !== '其他') ? `${g}年${c}班` : `${c}班`; }
            function randomNick() { return SP_ADJ[Math.floor(Math.random() * SP_ADJ.length)] + SP_ANIMALS[Math.floor(Math.random() * SP_ANIMALS.length)]; }
            function curCode() { const el = document.getElementById('login-code'); return String((el && el.value) || '').replace(/\D/g, '').padStart(5, '0').slice(0, 5); }
            function normLocks(arr) { return Array.isArray(arr) ? arr.filter(x => x && x.c).map(x => ({ g: String(x.g || ''), c: String(x.c) })) : []; }

            // 這個遊戲現在是「一人一場（選座號）」還是「全班／小隊（只選年級班級）」
            function seatPickMode() {
                try { if (typeof ruleType !== 'undefined') return ruleType === 'practice' ? 'student' : 'class'; } catch (e) {}
                try { if (typeof playStyle !== 'undefined' && playStyle === 'relay') return 'class'; } catch (e) {}
                try { if (typeof playMode !== 'undefined' && playMode === 'relay') return 'class'; } catch (e) {}
                return 'student';
            }
            function pickValid(p, mode, locks) {
                if (!p.g || !p.c) return false;
                if (mode === 'student' && !p.s) return false;
                if (locks && locks.length && !locks.some(l => l.g === p.g && l.c === p.c)) return false;
                return true;
            }
            function pickLabel(p, mode) {
                const cs = classStr(p.g, p.c);
                if (!cs) return '';
                if (mode === 'class') return cs;
                return `${cs} ${p.s ? p.s + ' 號' : ''}`.trim();
            }

            // 把選好的內容寫回原本（已隱藏）的姓名／座號欄，遊戲其他流程完全不用改
            function applySeatPickToInputs() {
                const mode = seatPickMode();
                const nameEl = document.getElementById('login-name'), seatEl = document.getElementById('login-seat');
                const cs = classStr(spPick.g, spPick.c);
                const pub = curCode() === '00000';
                if (nameEl) nameEl.value = (mode === 'student' && pub && spPick.nick) ? (cs + ' ' + spPick.nick) : cs;
                if (seatEl) seatEl.value = mode === 'student' ? (spPick.s || '') : '';
            }

            async function getLocksFor(code) {
                if (code === '00000') return [];
                if (spLockCache[code]) return spLockCache[code];
                try {
                    if (typeof homeRoomCache !== 'undefined' && homeRoomCache && homeRoomCache.code === code && homeRoomCache.params) {
                        spLockCache[code] = normLocks(homeRoomCache.params.lockClasses);
                        return spLockCache[code];
                    }
                } catch (e) {}
                try {
                    const url = (typeof getGasUrl === 'function') ? getGasUrl() : '';
                    if (!url) return [];
                    const res = await fetch(`${url}?action=getRoomConfig&roomCode=${encodeURIComponent(code)}&t=${Date.now()}`, { method: 'GET', credentials: 'omit', redirect: 'follow' });
                    const d = await res.json();
                    spLockCache[code] = normLocks(d && d.config && d.config.lockClasses);
                    return spLockCache[code];
                } catch (e) { return []; }
            }

            // ---------- 首頁按鈕 ----------
            function refreshSeatPickButton() {
                const btn = document.getElementById('sp-home-btn'); if (!btn) return;
                const mode = seatPickMode();
                const code = curCode();
                const locks = spLockCache[code] || [];
                const ok = pickValid(spPick, mode, locks);
                const lbl = document.getElementById('sp-home-label');
                if (lbl) lbl.innerHTML = mode === 'class' ? '🏫 年級・班級 <span style="color:#e74c3c;">*必選</span>' : '🎒 年級・班級・座號 <span style="color:#e74c3c;">*必選</span>';
                btn.classList.toggle('sp-empty', !ok);
                const pub = code === '00000' && mode === 'student' && spPick.nick && ok;
                if (ok) {
                    btn.innerHTML = `<span class="sp-hb-main">${esc(pickLabel(spPick, mode))}${pub ? `<span class="sp-hb-nick">🎲 ${esc(spPick.nick)}</span>` : ''}</span><span class="sp-hb-sub">✏️ 不是你？點這裡改</span>`;
                } else if (spPick.c && locks.length && !locks.some(l => l.g === spPick.g && l.c === spPick.c)) {
                    btn.innerHTML = `<span class="sp-hb-main">⚠️ 這組代碼只開放給指定班級</span><span class="sp-hb-sub">點這裡重新選擇</span>`;
                } else {
                    btn.innerHTML = `<span class="sp-hb-main">👆 點我選擇${mode === 'class' ? '年級・班級' : '年級・班級・座號'}</span><span class="sp-hb-sub">全部用點的，不用打字</span>`;
                }
                applySeatPickToInputs();
            }

            // ---------- 點選視窗 ----------
            function ensureModal() {
                if (document.getElementById('sp-modal')) return;
                const m = document.createElement('div');
                m.id = 'sp-modal';
                m.innerHTML = `<div class="sp-card" role="dialog" aria-modal="true" aria-label="選擇年級班級座號"><div id="sp-body"></div></div>`;
                m.addEventListener('pointerdown', e => { if (e.target === m) closeSeatPicker(); });
                document.body.appendChild(m);
            }
            async function openSeatPicker(opts = {}) {
                if (spBusy) return;
                ensureModal();
                spOpts = opts;
                const code = curCode();
                spOpts.code = code;
                spOpts.mode = seatPickMode();
                spDraft = Object.assign({}, spPick);
                spOpts.stale = !!opts.stale;
                document.getElementById('sp-modal').classList.add('open');
                document.getElementById('sp-body').innerHTML = `<div class="sp-loading">⏳ 正在讀取這組代碼的班級設定…</div>`;
                spOpts.locks = await getLocksFor(code);
                if (spOpts.locks.length === 1 && !spOpts.locks.some(l => l.g === spDraft.g && l.c === spDraft.c)) { spDraft.g = spOpts.locks[0].g; spDraft.c = spOpts.locks[0].c; }
                if (spOpts.locks.length && !spOpts.locks.some(l => l.g === spDraft.g && l.c === spDraft.c)) { spDraft.g = ''; spDraft.c = ''; }
                const cset = SP_CLASS_SETS.find(cs => cs.list.includes(spDraft.c));
                if (cset) spTab = cset.key;
                renderSeatPicker();
            }
            function closeSeatPicker() {
                const m = document.getElementById('sp-modal'); if (m) m.classList.remove('open');
                spDraft = null;
            }
            function btns(list, cur, onPick, extraCls = '') {
                return list.map(v => `<button type="button" class="sp-b ${extraCls}${String(cur) === String(v) ? ' on' : ''}" data-v="${esc(v)}" onclick="${onPick}(this.dataset.v)">${esc(v)}</button>`).join('');
            }
            function renderSeatPicker() {
                if (!spDraft) return;
                const mode = spOpts.mode, locks = spOpts.locks || [], pub = spOpts.code === '00000';
                const needSeat = mode === 'student';
                const summary = pickLabel(spDraft, mode) || (needSeat ? '－年－班－號' : '－年－班');
                let html = `<div class="sp-head"><div class="sp-title">${needSeat ? '🎒 選擇你的年級・班級・座號' : '🏫 選擇你們的年級・班級'}</div>
                    <div class="sp-sum${pickValid(spDraft, mode, locks) ? ' ok' : ''}">${esc(summary)}${pub && needSeat && spDraft.nick ? ` · 🎲${esc(spDraft.nick)}` : ''}</div></div>`;
                if (spOpts.stale && pickValid(spPick, mode, locks)) html += `<div class="sp-note">👋 上次在這台平板選的是 <b>${esc(pickLabel(spPick, mode))}</b>，是你嗎？是的話直接按「確定」。</div>`;
                if (mode === 'class') html += `<div class="sp-note">🏁 這個模式是全班／小隊一起玩，只要選年級和班級。</div>`;
                if (locks.length) {
                    html += `<div class="sp-sec sp-cls"><div class="sp-h"><span>🏫 老師指定的班級</span><span class="sp-hint">選你的班</span></div>
                        <div class="sp-g sp-g-lock">${locks.map(l => { const v = classStr(l.g, l.c); return `<button type="button" class="sp-b sp-wide${spDraft.g === l.g && spDraft.c === l.c ? ' on' : ''}" onclick="spPickLock('${esc(l.g)}','${esc(l.c)}')">${esc(v)}</button>`; }).join('')}</div></div>`;
                } else {
                    html += `<div class="sp-sec sp-grade"><div class="sp-h"><span>① 年級</span></div><div class="sp-g sp-g-grade">${btns(SP_GRADES, spDraft.g, 'spPickGrade')}</div></div>`;
                    const set = SP_CLASS_SETS.find(cs => cs.key === spTab) || SP_CLASS_SETS[0];
                    html += `<div class="sp-sec sp-cls" id="sp-sec-class"><div class="sp-h"><span>② 班級</span><span class="sp-tabs">${SP_CLASS_SETS.map(cs => `<button type="button" class="sp-tab${cs.key === set.key ? ' on' : ''}" onclick="spSetTab('${cs.key}')">${cs.label}</button>`).join('')}</span></div>
                        <div class="sp-g sp-g-class">${btns(set.list, spDraft.c, 'spPickClass')}</div></div>`;
                }
                if (needSeat) {
                    html += `<div class="sp-sec sp-seat" id="sp-sec-seat"><div class="sp-h"><span>${locks.length ? '②' : '③'} 座號</span></div>
                        <div class="sp-g sp-g-seat">${btns(Array.from({ length: 50 }, (_, i) => String(i + 1)), spDraft.s, 'spPickSeat')}</div></div>`;
                }
                if (pub && needSeat) {
                    html += `<div class="sp-sec sp-nick"><div class="sp-h"><span>🎲 公開練習暱稱（選填）</span><span class="sp-hint">排行榜會顯示暱稱</span></div>
                        <div class="sp-nick-row"><span class="sp-nick-now">${spDraft.nick ? esc(spDraft.nick) : '（不使用暱稱，排行榜顯示年班）'}</span>
                        <button type="button" class="sp-mini" onclick="spRollNick()">🎲 ${spDraft.nick ? '換一個' : '幫我取一個'}</button>
                        ${spDraft.nick ? '<button type="button" class="sp-mini ghost" onclick="spClearNick()">不要暱稱</button>' : ''}</div></div>`;
                }
                const ok = pickValid(spDraft, mode, locks);
                const miss = [];
                if (locks.length) { if (!locks.some(l => l.g === spDraft.g && l.c === spDraft.c)) miss.push('班級'); }
                else { if (!spDraft.g) miss.push('年級'); if (!spDraft.c) miss.push('班級'); }
                if (needSeat && !spDraft.s) miss.push('座號');
                html += `<div class="sp-foot"><span class="sp-miss">${ok ? '' : '還沒選：' + Array.from(new Set(miss)).join('、')}</span>
                    <button type="button" class="sp-cancel" onclick="spCancel()">取消</button>
                    <button type="button" class="sp-ok${ok ? ' ready' : ''}" onclick="spConfirm()">${spOpts.autoStart ? '✅ 確定，開始！' : '✅ 確定'}</button></div>`;
                const body = document.getElementById('sp-body');
                body.innerHTML = html;
            }
            function scrollToSec(id) { const el = document.getElementById(id); if (el && el.scrollIntoView) { try { el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) {} } }
            window.spPickGrade = v => { spDraft.g = v; renderSeatPicker(); if (!spDraft.c) scrollToSec('sp-sec-class'); };
            window.spPickClass = v => { spDraft.c = v; renderSeatPicker(); if (!spDraft.s) scrollToSec('sp-sec-seat'); };
            window.spPickLock = (g, c) => { spDraft.g = g; spDraft.c = c; renderSeatPicker(); if (!spDraft.s) scrollToSec('sp-sec-seat'); };
            window.spPickSeat = v => { spDraft.s = v; renderSeatPicker(); };
            window.spSetTab = k => { spTab = k; renderSeatPicker(); };
            window.spRollNick = () => { let n = randomNick(); if (n === spDraft.nick) n = randomNick(); spDraft.nick = n; renderSeatPicker(); };
            window.spClearNick = () => { spDraft.nick = ''; renderSeatPicker(); };
            window.spCancel = () => closeSeatPicker();
            window.spConfirm = () => {
                if (!spDraft) return;
                const mode = spOpts.mode, locks = spOpts.locks || [];
                if (!pickValid(spDraft, mode, locks)) {
                    const el = document.querySelector('#sp-modal .sp-miss'); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
                    return;
                }
                const keepSeat = mode === 'class' ? spPick.s : spDraft.s;
                spPick = { g: spDraft.g, c: spDraft.c, s: keepSeat || '', nick: spDraft.nick || '', at: Date.now() };
                savePick();
                const auto = !!spOpts.autoStart;
                closeSeatPicker();
                refreshSeatPickButton();
                if (auto && typeof startCloudGame === 'function') setTimeout(() => startCloudGame(), 30);
            };
            window.openSeatPicker = openSeatPicker;
            window.refreshSeatPickButton = refreshSeatPickButton;
            document.addEventListener('keydown', e => {
                const m = document.getElementById('sp-modal');
                if (!m || !m.classList.contains('open')) return;
                if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); window.spConfirm(); }
                else if (e.key === 'Escape') { e.preventDefault(); closeSeatPicker(); }
            }, true);

            // ---------- 開始前檢查：沒選好（或換人、代碼限定班級）就先跳出點選視窗 ----------
            if (typeof startCloudGame === 'function') {
                const origStart = startCloudGame;
                startCloudGame = async function () {
                    const code = curCode();
                    const mode = seatPickMode();
                    const locks = await getLocksFor(code);
                    const stale = !spPick.at || (Date.now() - spPick.at > SP_STALE_MS);
                    if (!pickValid(spPick, mode, locks) || stale) {
                        refreshSeatPickButton();
                        openSeatPicker({ autoStart: true, stale: stale && pickValid(spPick, mode, locks) });
                        return;
                    }
                    applySeatPickToInputs();
                    return origStart.apply(this, arguments);
                };
            }
            // 切換上課方式時，按鈕文字跟著變
            ['selectPlayStyle', 'selectRuleType', 'setPlayMode'].forEach(fn => {
                try {
                    const f = window[fn];
                    if (typeof f === 'function') window[fn] = function () { const r = f.apply(this, arguments); try { refreshSeatPickButton(); } catch (e) {} return r; };
                } catch (e) {}
            });

            // ---------- 🏆 首頁排行榜只算最近 20 天 ----------
            const BOARD_DAYS = 20;
            function isHomeBoardOpen() { const m = document.getElementById('home-board-modal'); return !!(m && m.style.display && m.style.display !== 'none'); }
            function tsMs(t) {
                const raw = String(t || '').trim(); if (!raw) return 0;
                const g = raw.match(/^\w{3} (\w{3}) (\d{1,2}) (\d{4}) (\d{1,2}):(\d{2}):(\d{2}) GMT([+-])(\d{2})(\d{2})/);
                if (g) {
                    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(g[1]);
                    if (mon >= 0) return Date.UTC(+g[3], mon, +g[2], +g[4], +g[5], +g[6]) - (g[7] === '+' ? 1 : -1) * ((+g[8]) * 60 + (+g[9])) * 60000;
                }
                const d = raw.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
                if (d) return new Date(+d[1], +d[2] - 1, +d[3], +(d[4] || 0), +(d[5] || 0), +(d[6] || 0)).getTime();
                const ms = Date.parse(raw.replace(/\s*\(.*\)\s*$/, ''));
                return isNaN(ms) ? 0 : ms;
            }
            function fmtTs(ms) { const d = new Date(ms), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; }
            function recentBoard(logs, days) {
                const since = Date.now() - days * 86400000;
                const best = {};
                (logs || []).forEach(r => {
                    const ms = tsMs(r.timestamp);
                    if (ms && ms < since) return;            // 超過 20 天的不算（時間看不懂的保留）
                    const item = Object.assign({}, r, { score: Number(r.score) || 0, durationSeconds: Number(r.durationSeconds) || 0 });
                    if (ms) item.timestamp = fmtTs(ms);
                    const key = String(String(r.rankTitle || '').split('||')[3] || '') + '__' + String(r.seatNo) + '__' + String(r.playerName);
                    if (!best[key]) best[key] = Object.assign(item, { attempts: 1 });
                    else {
                        const att = best[key].attempts + 1;
                        if (item.score > best[key].score || (item.score === best[key].score && item.durationSeconds < best[key].durationSeconds)) best[key] = Object.assign(item, { attempts: att });
                        else best[key].attempts = att;
                    }
                });
                return Object.values(best).sort((a, b) => b.score - a.score || a.durationSeconds - b.durationSeconds);
            }

            // ---------- 攔截雲端請求：讀取代碼的班級限定、後台載入／儲存班級限定、首頁近 20 天排行榜 ----------
            const origFetch = window.fetch.bind(window);
            window.fetch = async function (url, opts) {
                let body = null;
                try {
                    if (opts && opts.method === 'POST' && typeof opts.body === 'string' && opts.body.indexOf('saveRoomConfig') >= 0) {
                        body = JSON.parse(opts.body);
                        if (body && body.action === 'saveRoomConfig' && body.config && typeof body.config === 'object') {
                            body.config.lockClasses = adminLockClasses.map(x => ({ g: x.g, c: x.c }));
                            opts = Object.assign({}, opts, { body: JSON.stringify(body) });
                            spLockCache[String(body.roomCode || '')] = normLocks(body.config.lockClasses);
                        }
                    }
                } catch (e) {}
                {
                    const u0 = String(url || '');
                    if ((!opts || !opts.method || opts.method === 'GET') && u0.indexOf('action=getLeaderboard') >= 0 && isHomeBoardOpen()) {
                        // 首頁排行榜：改讀完整歷程，只留最近 20 天、每人取最高分（後端不用改）
                        const r2 = await origFetch(u0.replace('action=getLeaderboard', 'action=getTeacherRecords'), opts);
                        const d2 = await r2.json();
                        const outData = (d2 && d2.status === 'success' && Array.isArray(d2.allLogs))
                            ? { status: 'success', leaderboard: recentBoard(d2.allLogs, BOARD_DAYS), recentDays: BOARD_DAYS }
                            : d2;
                        return new Response(JSON.stringify(outData), { status: 200, headers: { 'Content-Type': 'application/json' } });
                    }
                }
                let res = await origFetch(url, opts);
                try {
                    const uu = String(url || '');
                    const isBoardCall = (uu.indexOf('action=getLeaderboard') >= 0) || (opts && opts.method === 'POST' && typeof opts.body === 'string' && /"action"\s*:\s*"submitScore"/.test(opts.body));
                    if (isBoardCall && uu.indexOf('script.google') >= 0 || isBoardCall && typeof getGasUrl === 'function' && uu.indexOf(getGasUrl()) === 0) {
                        const txt = await res.clone().text();
                        const d = JSON.parse(txt);
                        if (d && Array.isArray(d.leaderboard)) {
                            d.leaderboard.forEach(it => { if (it && typeof it === 'object' && it.timestamp) { const ms = tsMs(it.timestamp); if (ms) it.timestamp = fmtTs(ms); } });
                            res = new Response(JSON.stringify(d), { status: 200, headers: { 'Content-Type': 'application/json' } });
                        }
                    }
                } catch (e) {}
                try {
                    const u = String(url || '');
                    if ((!opts || !opts.method || opts.method === 'GET') && u.indexOf('action=getRoomConfig') >= 0) {
                        const m = u.match(/roomCode=(\d{5})/);
                        if (m) res.clone().json().then(d => { if (d && d.status === 'success') { spLockCache[m[1]] = normLocks(d.config && d.config.lockClasses); refreshSeatPickButton(); } }).catch(() => {});
                    } else if (opts && opts.method === 'POST' && typeof opts.body === 'string' && /"action"\s*:\s*"(verifyRoomPin|createNewRoom)"/.test(opts.body)) {
                        const b = JSON.parse(opts.body);
                        res.clone().json().then(d => {
                            if (d && d.status === 'success') {
                                adminLockClasses = b.action === 'verifyRoomPin' ? normLocks(d.config && d.config.lockClasses) : [];
                                renderAdminLock();
                            }
                        }).catch(() => {});
                    }
                } catch (e) {}
                return res;
            };


            // ---------- 排行榜表格：班級欄（座號左邊）、隱藏連擊與段位稱號 ----------
            const SP_BOARD_IDS = ['modal-board-tbody', 'result-board-tbody'];
            const SP_CLASS_RE = /(?:[一二三四五六七八九]年)?(?:1[0-9]|20|[1-9]|[甲乙丙丁戊己庚辛壬癸忠孝仁愛信義和平智勇梅蘭竹菊])班/;
            const SP_TRIM_RE = /^[\s\-－_·、,，]+|[\s\-－_·、,，]+$/g;
            function spBoardHead(tbody) {
                const table = tbody.closest('table'); if (!table || table.dataset.spBoard) return !!(table && table.dataset.spBoard === '1');
                const tr = table.querySelector('thead tr'); const ths = tr ? tr.children : [];
                if (ths.length !== 9 || !/連擊/.test(ths[5].textContent)) { table.dataset.spBoard = '0'; return false; }
                ths[6].remove(); ths[5].remove();
                const th = document.createElement('th'); th.textContent = '班級'; th.className = 'sp-col-class';
                tr.insertBefore(th, tr.children[1]);
                table.dataset.spBoard = '1'; table.classList.add('sp-board');
                return true;
            }
            function spSplitName(td) {
                const full = td.textContent || '';
                const m = full.match(SP_CLASS_RE); if (!m) return '';
                const walker = document.createTreeWalker(td, NodeFilter.SHOW_TEXT);
                let n; while ((n = walker.nextNode())) { if (n.nodeValue.indexOf(m[0]) >= 0) { n.nodeValue = n.nodeValue.replace(m[0], '').replace(SP_TRIM_RE, ''); break; } }
                if (!(td.textContent || '').trim()) td.innerHTML = '<span class="sp-dash">—</span>';
                return m[0];
            }
            function spBoardRows(tbody) {
                if (!spBoardHead(tbody)) return;
                [...tbody.children].forEach(tr => {
                    if (tr.dataset.sp) return; tr.dataset.sp = '1';
                    const tds = tr.children;
                    if (tds.length === 1) { if (tds[0].colSpan >= 9) tds[0].colSpan = 8; return; }
                    if (tds.length !== 9) return;
                    tds[6].remove(); tds[5].remove();
                    const cls = spSplitName(tds[2]);
                    const td = document.createElement('td'); td.className = 'sp-col-class';
                    td.innerHTML = cls ? escSp(cls) : '<span class="sp-dash">—</span>';
                    tr.insertBefore(td, tds[1]);
                    const st = tr.children[2]; if (st && !(st.textContent || '').trim()) st.innerHTML = '<span class="sp-dash">—</span>';
                });
            }
            function escSp(t) { return String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
            function installBoardColumns() {
                SP_BOARD_IDS.forEach(id => {
                    const tb = document.getElementById(id); if (!tb || tb.dataset.spObs) return;
                    tb.dataset.spObs = '1'; spBoardRows(tb);
                    new MutationObserver(() => spBoardRows(tb)).observe(tb, { childList: true });
                });
            }

            // ---------- 教師後台：指定可以玩的班級 ----------
            function renderAdminLock() {
                const box = document.getElementById('sp-admin-lock'); if (!box) return;
                const set = SP_CLASS_SETS.find(cs => cs.key === adminLockTab) || SP_CLASS_SETS[0];
                const has = (g, c) => adminLockClasses.some(l => l.g === g && l.c === c);
                box.innerHTML = `<div class="spa-title">🔒 指定可以玩的班級 <span class="spa-sub">（可複選；都不選＝不限制，學生自由選年級班級）</span></div>
                    <div class="spa-now">${adminLockClasses.length ? adminLockClasses.map((l, i) => `<span class="spa-chip">${esc(classStr(l.g, l.c))}<button type="button" onclick="spAdminRemove(${i})" title="移除">✕</button></span>`).join('') + `<button type="button" class="spa-clear" onclick="spAdminClear()">全部清除（不限制）</button>` : '<span class="spa-none">目前：不限制</span>'}</div>
                    <div class="spa-row"><span class="spa-lbl">年級</span><div class="spa-g">${SP_GRADES.map(g => `<button type="button" class="spa-b${adminLockGrade === g ? ' on' : ''}" onclick="spAdminGrade('${g}')">${g}</button>`).join('')}</div></div>
                    <div class="spa-row"><span class="spa-lbl">班級</span><div><div class="spa-tabs">${SP_CLASS_SETS.map(cs => `<button type="button" class="sp-tab${cs.key === set.key ? ' on' : ''}" onclick="spAdminTab('${cs.key}')">${cs.label}</button>`).join('')}</div>
                    <div class="spa-g">${set.list.map(c => `<button type="button" class="spa-b cls${has(adminLockGrade, c) ? ' on' : ''}" onclick="spAdminToggle('${c}')">${has(adminLockGrade, c) ? '✓ ' : ''}${esc(classStr(adminLockGrade, c))}</button>`).join('')}</div></div></div>
                    <div class="spa-note">💡 點班級按鈕加入／取消；設定好請按「☁️ 儲存」發布。只指定一個班時，學生只要選座號。</div>`;
            }
            window.spAdminGrade = g => { adminLockGrade = g; renderAdminLock(); };
            window.spAdminTab = k => { adminLockTab = k; renderAdminLock(); };
            window.spAdminToggle = c => {
                const i = adminLockClasses.findIndex(l => l.g === adminLockGrade && l.c === c);
                if (i >= 0) adminLockClasses.splice(i, 1); else adminLockClasses.push({ g: adminLockGrade, c });
                renderAdminLock();
            };
            window.spAdminRemove = i => { adminLockClasses.splice(i, 1); renderAdminLock(); };
            window.spAdminClear = () => { adminLockClasses = []; renderAdminLock(); };

            // ---------- 安裝到畫面上 ----------
            function installSeatPicker() {
                installBoardColumns();
                const nameEl = document.getElementById('login-name'), seatEl = document.getElementById('login-seat');
                if (!nameEl || !seatEl) return;
                const nameGroup = nameEl.closest('.form-group') || nameEl.parentElement;
                const seatGroup = seatEl.closest('.form-group') || seatEl.parentElement;
                const codeEl = document.getElementById('login-code');
                const codeGroup = codeEl && (codeEl.closest('.form-group') || codeEl.parentElement);
                if (!document.getElementById('sp-home-wrap')) {
                    const wrap = document.createElement('div');
                    wrap.id = 'sp-home-wrap';
                    wrap.className = 'form-group full sp-home-wrap';
                    wrap.innerHTML = `<label id="sp-home-label">🎒 年級・班級・座號</label><button type="button" id="sp-home-btn" class="sp-home-btn" onclick="openSeatPicker()"></button>`;
                    nameGroup.parentNode.insertBefore(wrap, nameGroup);
                }
                nameGroup.classList.add('sp-hidden');
                seatGroup.classList.add('sp-hidden');
                if (codeGroup) codeGroup.classList.add('sp-code-full');
                document.querySelectorAll('[id^="pk-name-"]').forEach(inp => { inp.readOnly = true; inp.tabIndex = -1; inp.classList.add('sp-ro'); });
                const panel = document.getElementById('admin-panel-tasks');
                if (panel && !document.getElementById('sp-admin-lock')) {
                    const box = document.createElement('div');
                    box.id = 'sp-admin-lock';
                    box.className = 'sp-admin-lock';
                    panel.insertBefore(box, panel.firstChild);
                }
                renderAdminLock();
                refreshSeatPickButton();
                const bh = document.querySelector('#home-board-modal h2');
                if (bh && bh.textContent.indexOf('最近') < 0) bh.innerHTML = `🏆 最近 ${BOARD_DAYS} 天排行榜 <span style="font-size:13px; color:#7f8c8d; font-weight:bold;">（只算最近 ${BOARD_DAYS} 天、每人最高分）</span>`;
                const c = curCode();
                if (c !== '00000') getLocksFor(c).then(refreshSeatPickButton);
            }
            const prevOnload = window.onload;
            window.onload = function () {
                if (typeof prevOnload === 'function') prevOnload.apply(this, arguments);
                try { installSeatPicker(); } catch (e) { console.error(e); }
                const codeEl = document.getElementById('login-code');
                if (codeEl) codeEl.addEventListener('input', () => setTimeout(() => { const c = curCode(); refreshSeatPickButton(); if (/^\d{5}$/.test(codeEl.value) && c !== '00000') getLocksFor(c).then(refreshSeatPickButton); }, 0));
            };
        })();

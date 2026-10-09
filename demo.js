const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const period = t => { const h = +t.slice(0, 2); return h < 11 ? '早上' : h < 14 ? '中午' : h < 18 ? '下午' : '晚上'; };
const short = n => n.replace(/（.*?）|\(.*?\)/g, '').trim();

const BOX = { blue: ['蓝色', '#3b82f6'], green: ['绿色', '#16a34a'], orange: ['橙色', '#f97316'], purple: ['紫色', '#8b5cf6'], red: ['红色', '#ef4444'], white: ['白色', '#e5e7eb'] };
const PILL = { white: ['白色', '#ffffff'], yellow: ['黄色', '#fde047'], pink: ['粉色', '#f9a8d4'], brown: ['棕色', '#b45309'] };
const SHAPE = { round: '圆形', oval: '椭圆形', capsule: '胶囊' };
const look = m => `${BOX[m.box][0]}盒子，${PILL[m.pill][0]}${SHAPE[m.shape]}${m.shape === 'capsule' ? '' : '药片'}`;

let sound = true;
let S;

function fresh() {
  const s = {
    min: 7 * 60 + 58, waitMin: 30, repeatMin: 15,
    meds: [
      { id: 'm1', name: '降压药（示例）', dose: '1片', slot: 1, box: 'blue', pill: 'white', shape: 'round', method: '早饭后，用一杯温水送服', times: ['08:00'] },
      { id: 'm2', name: '降糖药（示例）', dose: '1片', slot: 2, box: 'orange', pill: 'yellow', shape: 'oval', method: '和饭一起吃，用温水送服', times: ['08:00', '20:00'] }
    ],
    doses: [], parent: 'home', active: null, ringType: null,
    tab: 'home', call: null, msgs: [], banner: null, summary: '', draft: null, note: '',
    sc: 'normal', step: 0
  };
  S = s; buildDoses(); return s;
}

function buildDoses() {
  const old = Object.fromEntries(S.doses.map(d => [d.time, d]));
  const times = [...new Set(S.meds.flatMap(m => m.times))].sort();
  S.doses = times.map(time => {
    const medIds = S.meds.filter(m => m.times.includes(time)).map(m => m.id);
    if (old[time]) return { ...old[time], medIds };
    const past = toMin(time) <= S.min;
    return { id: time, time, medIds, status: 'pending', rang: past, reminded: past, escalated: past, skip: past };
  });
}
const medsOf = d => d.medIds.map(id => S.meds.find(m => m.id === id));
const dose = id => S.doses.find(d => d.id === id);
const names = d => medsOf(d).map(m => `${short(m.name)} ${m.dose}`).join('、');

// ---------- 声音 ----------
let AC, ringTimer, buzzTimer, bannerTimer;
function ac() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); return AC; } catch { return null; } }
function tone(f, dur, when = 0, vol = 0.08) {
  if (!sound) return; const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
  o.frequency.value = f; o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.start(t); o.stop(t + dur);
}
function startRing() { stopRing(); let n = 0; const p = () => { tone(880, 0.25); tone(660, 0.25, 0.3); if (++n > 8) stopRing(); }; p(); ringTimer = setInterval(p, 1500); }
function stopRing() { clearInterval(ringTimer); ringTimer = null; }
function ding() { tone(1046, 0.15); tone(1318, 0.25, 0.15); }
function speak(t) { if (!sound || !('speechSynthesis' in window)) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'zh-CN'; u.rate = 0.9; speechSynthesis.speak(u); } catch { } }
function hush() { stopRing(); try { speechSynthesis.cancel(); } catch { } }

function instruction(d) {
  return `该吃${period(d.time)}${+d.time.slice(0, 2)}点的药了。` + medsOf(d).map(m =>
    `打开药箱第${m.slot}格，拿${BOX[m.box][0]}盒子的${short(m.name)}，是${PILL[m.pill][0]}${SHAPE[m.shape]}的，吃${m.dose}。${m.method}。`).join('') + '吃好以后，按绿色的“我吃好了”。';
}

// ---------- 时间推进与规则 ----------
function tick(to) { while (S.min < to) { S.min++; check(); } render(); }
function check() {
  for (const d of S.doses) {
    if (d.status !== 'pending' || d.skip) continue;
    const dt = S.min - toMin(d.time);
    if (dt >= 0 && !d.rang) { d.rang = true; ring(d, 'due'); }
    if (dt >= S.repeatMin && !d.reminded) { d.reminded = true; ring(d, 'repeat'); }
    if (dt >= S.waitMin && !d.escalated) {
      d.escalated = true;
      notify({ type: 'alert', dose: d.id, title: '⚠️ 妈妈还没确认吃药', text: `${period(d.time)} ${d.time} 的药（${names(d)}）已经提醒了 2 次，过了 ${S.waitMin} 分钟还没确认。建议打个电话问问。` });
      emit('escalate');
    }
  }
}
function nextEvent() {
  const c = [];
  for (const d of S.doses) {
    if (d.status !== 'pending' || d.skip) continue;
    const t = toMin(d.time);
    if (!d.rang) c.push(t); else if (!d.reminded) c.push(t + S.repeatMin); else if (!d.escalated) c.push(t + S.waitMin);
  }
  return c.length ? Math.min(...c) : null;
}
function ring(d, type) { S.parent = 'ring'; S.active = d.id; S.ringType = type; startRing(); emit(type === 'due' ? 'ring' : 'remind'); }

function notify(m, quiet) {
  m.time = fmt(S.min); m.id = Math.random().toString(36).slice(2); m.read = !!quiet;
  S.msgs.unshift(m); S.summary = '';
  if (quiet) return;
  S.banner = m; ding();
  const p = $('#childPhone'); p.classList.remove('buzz'); void p.offsetWidth; p.classList.add('buzz');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { S.banner = null; render(); }, 5000);
}

function confirm(d, by) {
  d.status = 'done'; d.by = by; d.at = S.min;
  if (by === 'self') notify({ type: 'ok', dose: d.id, title: '✅ 妈妈已经吃药了', text: `${period(d.time)} ${d.time} 的药：${names(d)}。妈妈在 ${fmt(S.min)} 自己确认吃好了（药箱第 ${medsOf(d).map(m => m.slot).join('、')} 格已打开）。` });
  else notify({ type: 'ok', dose: d.id, title: '✅ 已电话确认：妈妈吃了药', text: `${period(d.time)} ${d.time} 的药：${names(d)}。你在 ${fmt(S.min)} 通过电话确认。` });
}

function aiSummary() {
  const lines = S.doses.map(d => {
    const p = `${period(d.time)} ${d.time}`;
    if (d.status === 'done') return `· ${p}：✅ ${d.by === 'call' ? '你打电话确认' : '妈妈自己确认'}吃了（${fmt(d.at)}）`;
    if (d.status === 'help') return `· ${p}：🙋 妈妈求助“${d.reason}”`;
    if (d.skip) return `· ${p}：今天已过，明天开始提醒`;
    if (d.escalated) return `· ${p}：⚠️ 超过 ${S.waitMin} 分钟没确认`;
    if (d.rang) return `· ${p}：⏳ 已提醒，等妈妈确认`;
    return `· ${p}：还没到时间`;
  });
  const issue = S.doses.some(d => d.status === 'help' || (d.status === 'pending' && d.escalated));
  const tip = issue
    ? '建议：现在给妈妈打个电话。开场可以说“妈，药箱提醒你吃药了，我陪你一起看看是哪一格亮灯？”'
    : '今天不用专门打电话问吃药，打电话时可以聊聊别的 😊';
  return `✨ AI 今日小结\n${lines.join('\n')}\n\n${tip}`;
}

// ---------- 引导情景 ----------
const SC = {
  normal: { title: '① 妈妈按时吃药', steps: [
    { text: '现在是早上 7:58。左边是<b>妈妈的手机</b>，右边是<b>你的手机</b>。点下面的【快进到 08:00】，看看到点会发生什么。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '8 点到了！妈妈的手机像来电一样<b>响铃</b>提醒她吃药。点妈妈手机上绿色的【接听】。', target: '[data-act=answer]', wait: 'answer' },
    { text: '妈妈看到了：<b>药盒和药片长什么样、在药箱第几格（亮灯）、吃几片、怎么吃</b>，手机还会读出来。假设妈妈吃完了，点【我吃好了】。', target: '[data-act=done]', wait: 'doneClick' },
    { text: '为了防止误按，再确认一次。点【是的，都吃了】。', target: '[data-act=yes]', wait: 'confirmed' },
    { text: '看右边！你的手机<b>马上收到通知</b>：妈妈几点吃的、吃了什么都写清楚了，不用再打电话问。点【✨ AI 今日小结】看看一天的情况。', target: '[data-act=summary]', wait: 'summary' },
    { text: '🎉 完成！这是最理想的情况。接着试试上面的「② 妈妈忘了吃药」，看看没吃药时会怎样。', end: true }
  ] },
  forgot: { title: '② 妈妈忘了吃药', steps: [
    { text: '现在是早上 7:58。点【快进到 08:00】。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '8 点手机响了，但这次假设<b>妈妈没听到</b>，没有接。点【快进到 08:15】。', ff: '08:15', target: '#g-ff', wait: 'remind' },
    { text: '8:15，妈妈的手机<b>第 2 次响铃</b>。假设还是没接，点【快进到 08:30】。', ff: '08:30', target: '#g-ff', wait: 'escalate' },
    { text: '过了约定的 30 分钟还没确认，<b>你的手机收到提醒</b>。点右边红色的【📞 打给妈妈】。', target: '[data-act=call]', wait: 'call' },
    { text: '电话通了，妈妈的手机显示“和女儿通话中”。假设妈妈说刚才在买菜没听到，现在吃了。点【妈妈已经吃了】记录结果。', target: '[data-act=callok]', wait: 'callResult' },
    { text: '🎉 完成！只有真的没确认时，你才需要打电话。等多久再通知你，可以在你手机的【药品】页改成 60 分钟。', end: true }
  ] },
  help: { title: '③ 妈妈找不到药', steps: [
    { text: '现在是早上 7:58。点【快进到 08:00】。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '妈妈的手机响了，点绿色的【接听】。', target: '[data-act=answer]', wait: 'answer' },
    { text: '这次假设妈妈<b>找不到药</b>。点橙色的【我需要帮忙】。', target: '[data-act=help]', wait: 'helpClick' },
    { text: '妈妈只要选一个大按钮就行。点【找不到药】。', target: '[data-reason="找不到药"]', wait: 'help' },
    { text: '你的手机<b>立刻收到求助</b>，不用等 30 分钟。点【📞 打给妈妈】。', target: '[data-act=call]', wait: 'call' },
    { text: '电话里告诉妈妈：“药箱第 1 格，正在亮灯的蓝盒子。”妈妈找到并吃了，点【妈妈已经吃了】。', target: '[data-act=callok]', wait: 'callResult' },
    { text: '🎉 完成！妈妈遇到困难时一键求助，你能马上知道是什么问题。', end: true }
  ] },
  setup: { title: '④ 帮妈妈录入新药', steps: [
    { text: '现在是晚上 8:50，今天的药妈妈都吃了。医生新开了一种药，你来帮妈妈录入。点右边手机底部的【💊 药品】。', target: '[data-tab=meds]', wait: 'tab:meds' },
    { text: '点【＋ 添加新药】。', target: '[data-act=add]', wait: 'add' },
    { text: '框里已经贴好一段医生写的用法。点【✨ AI 帮我填】，让 AI 把它整理成表格。', target: '[data-act=ai]', wait: 'ai' },
    { text: 'AI 填好了药名、剂量、时间和吃法。再选一下<b>药盒和药片的样子</b>（妈妈靠这个认药），然后点【保存】。', target: '[data-act=save]', wait: 'setup' },
    { text: '保存好了，妈妈的手机会按时提醒。点【快进到 21:00】。', ff: '21:00', target: '#g-ff', wait: 'ring' },
    { text: '妈妈的手机响了，点【接听】，看看妈妈看到的是不是你刚才录入的样子。', target: '[data-act=answer]', wait: 'answer' },
    { text: '🎉 完成！你只需要录入一次，之后每天到点都会这样提醒妈妈。', end: true }
  ] },
  free: { title: '自由体验', steps: [] }
};

function start(key) {
  hush(); clearTimeout(bannerTimer); fresh(); S.sc = key; S.step = 0;
  if (key === 'setup') {
    S.min = 20 * 60 + 50;
    for (const d of S.doses) {
      Object.assign(d, { rang: true, reminded: true, escalated: true, status: 'done', by: 'self', at: toMin(d.time) + 4 });
      const m = S.min; S.min = d.at; confirm(d, 'self'); S.min = m;
    }
    S.banner = null; S.msgs.forEach(m => m.read = true);
    clearTimeout(bannerTimer); $('#childPhone').classList.remove('buzz');
    S.doses.forEach(d => { d.at = toMin(d.time) + 4; });
  }
  render();
}
function emit(ev) { const st = SC[S.sc]?.steps[S.step]; if (st && st.wait === ev) S.step++; }

// ---------- 渲染 ----------
function art(m, k = 1) {
  const box = BOX[m.box][1], pill = PILL[m.pill][1]; let p;
  if (m.shape === 'round') p = `<circle cx="98" cy="45" r="14" fill="${pill}" stroke="#334155" stroke-width="2"/><line x1="98" y1="33" x2="98" y2="57" stroke="#94a3b8" stroke-width="2"/>`;
  else if (m.shape === 'oval') p = `<ellipse cx="98" cy="45" rx="19" ry="11" fill="${pill}" stroke="#334155" stroke-width="2"/>`;
  else p = `<g transform="rotate(-25 98 45)"><rect x="78" y="37" width="40" height="16" rx="8" fill="${pill}" stroke="#334155" stroke-width="2"/><rect x="78" y="37" width="20" height="16" rx="8" fill="${box}" stroke="#334155" stroke-width="2"/></g>`;
  return `<svg class="art" viewBox="0 0 125 80" width="${125 * k}" height="${80 * k}" role="img" aria-label="${esc(look(m))}"><rect x="6" y="8" width="62" height="64" rx="6" fill="${box}"/><rect x="12" y="26" width="50" height="22" rx="3" fill="#fff"/><text x="37" y="41" font-size="10" text-anchor="middle" fill="#111">${esc(short(m.name).slice(0, 4))}</text>${p}</svg>`;
}
const pillbox = lit => `<div class="pillbox">${[1, 2, 3, 4, 5, 6].map(i => `<div class="cell ${lit.includes(i) ? 'lit' : ''}">${i}</div>`).join('')}</div>`;
const sbar = dark => `<div class="sbar ${dark ? 'dark' : ''}"><span>${fmt(S.min)}</span><span>📶 🔋</span></div>`;

function parentHTML() {
  const d = dose(S.active);
  if (S.call) {
    return sbar(true) + `<div class="p-incall"><div class="avatar">👩</div><div class="who">女儿</div><div class="cst">${S.call.stage === 'calling' ? '来电中…' : '通话中'}</div></div>`;
  }
  switch (S.parent) {
    case 'ring': return sbar(true) + `<div class="p-ring"><div class="ring-icon">💊</div><div class="ring-title">该吃药了</div><div class="ring-sub">${period(d.time)} ${d.time} · ${d.medIds.length} 种药</div>${S.ringType === 'repeat' ? '<div class="ring-tag">第 2 次提醒</div>' : ''}<div class="ring-actions"><div><button data-act="later" class="r-btn r-later">⏰</button><span>稍后</span></div><div><button data-act="answer" class="r-btn r-answer">📞</button><span>接听</span></div></div></div>`;
    case 'guide': {
      const ms = medsOf(d);
      return sbar() + `<div class="p-body"><h2>${period(d.time)} ${d.time}<br>要吃 ${ms.length} 种药</h2>
        <div class="pb-wrap"><div class="pb-title">💡 药箱这几格在亮灯</div>${pillbox(ms.map(m => m.slot))}</div>
        ${ms.map(m => `<div class="med"><div class="slotno">第 ${m.slot} 格</div>${art(m, 1.3)}<div class="mname">${esc(short(m.name))}</div><div class="mlook">${esc(look(m))}</div><div class="mdose">吃 <b>${esc(m.dose)}</b></div><div class="mhow">${esc(m.method)}</div></div>`).join('')}
        <button data-act="replay" class="p-sec">🔊 再听一遍</button></div>
        <div class="p-actions"><button data-act="done" class="p-ok">✅ 我吃好了</button><button data-act="help" class="p-help">🙋 我需要帮忙</button></div>`;
    }
    case 'confirm': return sbar() + `<div class="p-body center"><h2>都吃好了吗？</h2>${medsOf(d).map(m => `<div class="cfm">${art(m, .8)}<span>${esc(short(m.name))} ${esc(m.dose)}</span></div>`).join('')}<button data-act="yes" class="p-ok">是的，都吃了</button><button data-act="no" class="p-sec">还没有，返回</button></div>`;
    case 'help': return sbar() + `<div class="p-body"><h2>遇到什么问题？</h2>${['找不到药', '不知道怎么吃', '记不清吃没吃', '让孩子给我打电话'].map(r => `<button data-reason="${r}" class="p-reason">${r}</button>`).join('')}<button data-act="back" class="p-sec">返回</button></div>`;
    case 'helpSent': return sbar() + `<div class="p-body center"><div class="big-emoji">📨</div><h2>已经告诉女儿了</h2><p class="p-text">她会马上给您打电话，<br>请稍等。</p></div>`;
    case 'done': {
      const nx = S.doses.find(x => x.status === 'pending' && !x.skip && toMin(x.time) > S.min);
      return sbar() + `<div class="p-body center"><div class="big-emoji">👍</div><h2>吃好了！</h2><p class="p-text">${d?.by === 'call' ? '女儿已经帮您记录好了' : '已经告诉女儿了'}</p>${nx ? `<p class="p-text small">下一次：${period(nx.time)} ${nx.time}</p>` : ''}<button data-act="home" class="p-sec">返回</button></div>`;
    }
    default: {
      const nx = S.doses.find(x => x.status === 'pending' && !x.skip && toMin(x.time) > S.min);
      return sbar() + `<div class="p-body"><div class="bigclock">${fmt(S.min)}</div><div class="date">10月9日 星期五</div>
        ${nx ? `<div class="p-card"><div class="lbl">下一次吃药</div><div class="t">${period(nx.time)} ${nx.time}</div><div>${medsOf(nx).map(m => esc(short(m.name))).join('、')}</div></div>` : '<div class="p-card"><div class="lbl">今天的药</div><div class="t">都吃完啦</div></div>'}
        <div class="p-list">${S.doses.map(x => `<div>${x.status === 'done' ? '✅' : x.status === 'help' ? '🙋' : '⏰'} ${period(x.time)} ${x.time}</div>`).join('')}</div>
        <p class="hint">到点时手机会响铃，告诉您吃什么</p></div>`;
    }
  }
}

function statusText(d) {
  if (d.status === 'done') return `✅ 已吃 · ${d.by === 'call' ? '电话确认' : '妈妈自己确认'} ${fmt(d.at)}`;
  if (d.status === 'help') return `🙋 需要帮忙：${esc(d.reason)}`;
  if (d.skip) return '今天已过，明天开始';
  if (d.escalated) return '⚠️ 超时没确认';
  if (d.rang) return '⏳ 已提醒，等妈妈确认';
  return '还没到时间';
}
const open = d => d && (d.status === 'help' || (d.status === 'pending' && d.escalated));

function childHTML() {
  if (S.call) {
    const talking = S.call.stage === 'talking';
    return sbar(true) + `<div class="c-call"><div class="avatar">👵</div><div class="who">妈妈</div><div class="cst">${talking ? '通话中' : '正在呼叫…'}</div>
      ${talking ? `<div class="c-callnote">问完以后，记录一下结果：</div><button data-act="callok" class="p-ok">✅ 妈妈已经吃了</button><button data-act="calllater" class="c-ghost">还没吃，晚点再问</button>` : ''}</div>`;
  }
  const unread = S.msgs.filter(m => !m.read).length;
  const b = S.banner ? `<div class="banner ${S.banner.type}" data-tab="msgs"><div class="b-app">安心药箱 · 现在</div><b>${esc(S.banner.title)}</b><div>${esc(S.banner.text)}</div></div>` : '';
  let body = '';
  if (S.tab === 'home') {
    const todo = S.doses.filter(open);
    body = `<div class="c-head"><div class="c-hi">妈妈今天的吃药情况</div><div class="c-sub">10月9日 · 现在 ${fmt(S.min)}</div></div>
      ${todo.map(d => `<div class="alert ${d.status}"><b>${d.status === 'help' ? '🙋 妈妈需要帮忙' : '⚠️ 妈妈还没确认吃药'}</b><p>${d.status === 'help' ? `${d.time} 的药：妈妈说“${esc(d.reason)}”` : `${d.time} 的药提醒了 2 次，${S.waitMin} 分钟没确认`}</p><button data-act="call" data-dose="${d.id}" class="callbtn">📞 打给妈妈</button></div>`).join('')}
      <div class="c-doses">${S.doses.map(d => `<div class="c-dose ${d.status} ${d.escalated && d.status === 'pending' && !d.skip ? 'late' : ''}"><div class="c-time">${d.time}<small>${period(d.time)}</small></div><div><div class="c-meds">${esc(names(d))}</div><div class="c-st">${statusText(d)}</div></div></div>`).join('')}</div>
      <button data-act="summary" class="aibtn">✨ AI 今日小结</button>
      ${S.summary ? `<div class="summary">${esc(S.summary).replace(/\n/g, '<br>')}</div>` : ''}`;
  } else if (S.tab === 'msgs') {
    body = `<div class="c-head"><div class="c-hi">消息</div><div class="c-sub">来自 安心药箱</div></div>` + (S.msgs.map(m => `<div class="sms ${m.type}"><div class="sms-t">${esc(m.title)}</div><div>${esc(m.text)}</div><small>${m.time}</small>${open(dose(m.dose)) && m.type !== 'ok' ? `<button data-act="call" data-dose="${m.dose}" class="callbtn">📞 打给妈妈</button>` : ''}</div>`).join('') || '<p class="empty">还没有消息。妈妈吃完药、或者需要你帮忙时，这里会收到通知。</p>');
  } else {
    const f = S.draft;
    body = `<div class="c-head"><div class="c-hi">妈妈的药</div><div class="c-sub">录入一次，每天自动提醒</div></div>
      ${S.note ? `<div class="okbar">${esc(S.note)}</div>` : ''}
      ${f ? `<div class="form">
        <label>把医生写的、或药盒上的用法贴进来</label><textarea data-f="text" rows="3" placeholder="例如：降脂药，每次1片，每天 21:00，睡前温水送服">${esc(f.text)}</textarea>
        <button data-act="ai" class="aibtn">✨ AI 帮我填</button>${f.aiNote ? `<div class="ainote">${esc(f.aiNote)}</div>` : ''}
        <label>药名</label><input data-f="name" value="${esc(f.name)}">
        <div class="two"><div><label>每次吃多少</label><input data-f="dose" value="${esc(f.dose)}" placeholder="1片"></div><div><label>几点吃（可多个）</label><input data-f="times" value="${esc(f.times)}" placeholder="08:00, 20:00"></div></div>
        <label>怎么吃</label><input data-f="method" value="${esc(f.method)}" placeholder="例如：饭后用温水送服">
        <label>放在药箱第几格</label><select data-f="slot">${[1, 2, 3, 4, 5, 6].map(i => `<option ${+f.slot === i ? 'selected' : ''}>${i}</option>`).join('')}</select>
        <div class="two"><div><label>药盒颜色</label><select data-f="box">${Object.entries(BOX).map(([k, v]) => `<option value="${k}" ${f.box === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div><div><label>药片颜色</label><select data-f="pill">${Object.entries(PILL).map(([k, v]) => `<option value="${k}" ${f.pill === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div></div>
        <label>药片形状</label><select data-f="shape">${Object.entries(SHAPE).map(([k, v]) => `<option value="${k}" ${f.shape === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <div class="preview">妈妈会看到：${f.box ? art({ ...f, name: f.name || '药名' }, .9) : ''}</div>
        ${f.err ? `<div class="err">${esc(f.err)}</div>` : ''}
        <div class="two"><button data-act="cancel" class="c-ghost">取消</button><button data-act="save" class="p-ok sm">保存</button></div>
      </div>` : `<button data-act="add" class="addbtn">＋ 添加新药</button>`}
      ${S.meds.map(m => `<div class="medrow">${art(m, .6)}<div><b>${esc(short(m.name))} · ${esc(m.dose)}</b><div class="muted">${m.times.join('、')} · 第 ${m.slot} 格</div><div class="muted">${esc(m.method)}</div></div></div>`).join('')}
      <div class="setting"><label for="wait">妈妈超过多久没确认，就通知我</label><select id="wait"><option value="30" ${S.waitMin === 30 ? 'selected' : ''}>30 分钟</option><option value="60" ${S.waitMin === 60 ? 'selected' : ''}>60 分钟</option></select></div>`;
  }
  const tabs = [['home', '🏠', '首页'], ['msgs', '💬', '消息'], ['meds', '💊', '药品']].map(([k, i, n]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${i}<span>${n}</span>${k === 'msgs' && unread ? `<em>${unread}</em>` : ''}</button>`).join('');
  return sbar() + b + `<div class="c-body">${body}</div><nav class="tabbar">${tabs}</nav>`;
}

function guideHTML() {
  const sc = SC[S.sc], st = sc.steps[S.step];
  const tabs = Object.entries(SC).map(([k, v]) => `<button data-sc="${k}" class="sc ${k === S.sc ? 'on' : ''}">${v.title}</button>`).join('');
  let box;
  if (S.sc === 'free') box = '<p>随意操作两部手机：左边是妈妈的，右边是你的。用下面的按钮让时间往前走。</p>';
  else box = `<div class="stepno">第 ${S.step + 1} 步 / 共 ${sc.steps.length} 步</div><p>${st.text}</p>${st.ff ? `<button id="g-ff" data-act="ff" data-to="${st.ff}" class="primary">⏩ 快进到 ${st.ff}</button>` : ''}${st.end ? '<button data-act="restart" class="primary">↺ 再来一遍</button>' : ''}`;
  const free = S.sc === 'free' ? '<button data-act="next">⏩ 快进到下一次提醒</button><button data-act="plus15">+15 分钟</button>' : '';
  return `<div class="sc-row"><span class="pick">选一个情景体验：</span>${tabs}</div><div class="stepbox">${box}</div><div class="timebar"><span>🕗 现在 <b>${fmt(S.min)}</b></span>${free}<button data-act="sound">${sound ? '🔊 声音：开' : '🔇 声音：关'}</button><button data-act="restart">↺ 重新开始</button></div>`;
}

function render() {
  $('#guide').innerHTML = guideHTML();
  $('#parent').innerHTML = parentHTML();
  const cs = $('#child').querySelector('.c-body')?.scrollTop || 0;
  $('#child').innerHTML = childHTML();
  const cb = $('#child').querySelector('.c-body'); if (cb) cb.scrollTop = cs;
  $('#parentPhone').classList.toggle('ringing', S.parent === 'ring' && !S.call);
  const st = SC[S.sc]?.steps[S.step];
  if (st?.target) { const el = document.querySelector(st.target); if (el) { el.classList.add('pulse'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
}

// ---------- 交互 ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-tab],[data-sc],[data-reason]'); if (!el) return;
  ac()?.resume?.();
  const d = dose(S.active);
  if (el.dataset.sc) return start(el.dataset.sc);
  if (el.dataset.tab) { S.tab = el.dataset.tab; S.banner = null; S.note = ''; if (S.tab === 'msgs') S.msgs.forEach(m => m.read = true); emit('tab:' + S.tab); return render(); }
  if (el.dataset.reason) {
    d.status = 'help'; d.reason = el.dataset.reason; S.parent = 'helpSent'; hush();
    notify({ type: 'help', dose: d.id, title: '🙋 妈妈需要帮忙', text: `${period(d.time)} ${d.time} 的药：妈妈说“${d.reason}”。建议现在打个电话。` });
    emit('help'); return render();
  }
  switch (el.dataset.act) {
    case 'ff': return tick(toMin(el.dataset.to));
    case 'next': { const n = nextEvent(); return n == null ? alert('今天没有待提醒的药了。可以在你手机的【药品】页添加新药。') : tick(n); }
    case 'plus15': return tick(S.min + 15);
    case 'sound': sound = !sound; if (!sound) hush(); break;
    case 'restart': return start(S.sc);
    case 'answer': stopRing(); S.parent = 'guide'; speak(instruction(d)); emit('answer'); break;
    case 'later': hush(); S.parent = 'home'; break;
    case 'replay': speak(instruction(d)); break;
    case 'done': hush(); S.parent = 'confirm'; emit('doneClick'); break;
    case 'no': S.parent = 'guide'; break;
    case 'yes': confirm(d, 'self'); S.parent = 'done'; emit('confirmed'); break;
    case 'help': hush(); S.parent = 'help'; emit('helpClick'); break;
    case 'back': S.parent = 'guide'; break;
    case 'home': S.parent = 'home'; break;
    case 'summary': S.summary = aiSummary(); emit('summary'); break;
    case 'call': {
      hush(); S.call = { dose: el.dataset.dose, stage: 'calling' }; S.banner = null; emit('call');
      setTimeout(() => { if (S.call) { S.call.stage = 'talking'; render(); } }, 1300); break;
    }
    case 'callok': { const cd = dose(S.call.dose); S.call = null; S.active = cd.id; confirm(cd, 'call'); S.parent = 'done'; S.tab = 'home'; emit('callResult'); break; }
    case 'calllater': S.call = null; S.parent = 'home'; break;
    case 'add':
      S.note = ''; S.draft = { text: S.sc === 'setup' ? '降脂药（示例），每次1片，每天 21:00，睡前用温水送服' : '', name: '', dose: '', times: '', method: '', slot: '3', box: 'green', pill: 'white', shape: 'capsule' };
      emit('add'); break;
    case 'ai': {
      const f = S.draft, text = f.text.trim();
      if (!text) { f.aiNote = '请先贴一段用法。'; break; }
      try {
        const it = Extract.extractMock(text.split(/\n/)[0]).items[0];
        const how = text.match(/(饭前|饭后|空腹|睡前|随餐|和饭|吃饭时)[^，,。；;\n]*/);
        Object.assign(f, { name: it.name || f.name, dose: it.dose || f.dose, times: it.times.join(', ') || f.times, method: how ? how[0] : f.method });
        const miss = [!it.dose && '剂量', !it.times.length && '具体几点', !how && '怎么吃'].filter(Boolean);
        f.aiNote = '✨ AI 已从原文中整理出能确定的内容。' + (miss.length ? `原文没写清楚的（${miss.join('、')}）请你补上，AI 不会瞎猜。` : '请核对一遍。') + ' 药盒和药片长什么样，请你看着实物选。';
      } catch { f.aiNote = '没认出来，请手动填写。'; }
      emit('ai'); break;
    }
    case 'cancel': S.draft = null; break;
    case 'save': {
      const f = S.draft, times = f.times.split(/[,，、\s]+/).filter(Boolean).map(t => t.replace('：', ':').padStart(5, '0'));
      if (!f.name.trim() || !f.dose.trim() || !f.method.trim()) { f.err = '请填写药名、每次吃多少和怎么吃。'; break; }
      if (!times.length || times.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) { f.err = '吃药时间请写成 08:00 这样的格式。'; break; }
      S.meds.push({ id: 'm' + Date.now(), name: f.name.trim(), dose: f.dose.trim(), method: f.method.trim(), slot: +f.slot, box: f.box, pill: f.pill, shape: f.shape, times: [...new Set(times)] });
      buildDoses(); S.draft = null; S.note = `✅ 已保存「${short(f.name)}」，到点会提醒妈妈。`; emit('setup'); break;
    }
    default: return;
  }
  render();
});

document.addEventListener('input', e => {
  const k = e.target.dataset.f;
  if (k && S.draft) { S.draft[k] = e.target.value; if (['box', 'pill', 'shape', 'name'].includes(k)) { const p = document.querySelector('.preview'); if (p) p.innerHTML = '妈妈会看到：' + art({ ...S.draft, name: S.draft.name || '药名' }, .9); } }
  if (e.target.id === 'wait') { S.waitMin = +e.target.value; render(); }
});

start('normal');

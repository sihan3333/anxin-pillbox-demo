const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const period = t => { const h = +t.slice(0, 2); return h < 11 ? '早上' : h < 14 ? '中午' : h < 18 ? '下午' : '晚上'; };
const short = n => n.replace(/（.*?）|\(.*?\)/g, '').trim();
const spokenTime = t => `${period(t)}${+t.slice(0, 2) > 12 ? +t.slice(0, 2) - 12 : +t.slice(0, 2)}点${+t.slice(3) ? (+t.slice(3) === 30 ? '半' : +t.slice(3) + '分') : ''}`;

const BOX = { blue: ['蓝色', '#3b82f6'], green: ['绿色', '#16a34a'], orange: ['橙色', '#f97316'], purple: ['紫色', '#8b5cf6'], red: ['红色', '#ef4444'], white: ['白色', '#e5e7eb'] };
const PILL = { white: ['白色', '#ffffff'], yellow: ['黄色', '#fde047'], pink: ['粉色', '#f9a8d4'], brown: ['棕色', '#b45309'] };
const SHAPE = { round: '圆形', oval: '椭圆形', capsule: '胶囊' };
const REASONS = ['找不到药', '不知道怎么吃', '记不清吃没吃', '让孩子给我打电话'];
const SAMPLE_VOICE = '这是降脂药，每次一片，晚上九点吃，睡前用温水送服';
const look = m => `${BOX[m.box][0]}盒子，${PILL[m.pill][0]}${SHAPE[m.shape]}${m.shape === 'capsule' ? '' : '药片'}`;
// 同一时刻多种药时，按吃法里的饭点关系排先后；没写饭点关系的排在“吃饭时”一档，保持录入顺序
const MEAL = [[/空腹|饭前|餐前/, '饭前'], [/和饭|随餐|吃饭时|进餐时|餐中|与食物同服/, '吃饭时'], [/饭后|餐后/, '饭后'], [/睡前/, '睡前']];
const mealStep = m => { const i = MEAL.findIndex(([r]) => r.test(m.method)); return i < 0 ? { rank: 1, label: '' } : { rank: i, label: MEAL[i][1] }; };
const CN = '一二三四五六七八';

// 过去 6 天的示例记录（演示 AI 分析用）
const WEEK = [
  { d: '10/3', w: '六', am: 'call', pm: 'ok' }, { d: '10/4', w: '日', am: 'late', pm: 'ok' },
  { d: '10/5', w: '一', am: 'ok', pm: 'ok' }, { d: '10/6', w: '二', am: 'ok', pm: 'help' },
  { d: '10/7', w: '三', am: 'ok', pm: 'ok' }, { d: '10/8', w: '四', am: 'ok', pm: 'ok' }
];
const MARK = { ok: ['✅', '按时'], late: ['🟠', '第2次提醒后'], call: ['📞', '打电话后'], help: ['🙋', '求助'], miss: ['⚠️', '没确认'], wait: ['·', '未到/等待'] };

let sound = true;
let S;

function fresh() {
  S = {
    min: 7 * 60 + 58, waitMin: 30, repeatMin: 15,
    meds: [
      { id: 'm1', name: '降压药（示例）', dose: '1片', slot: 1, box: 'blue', pill: 'white', shape: 'round', method: '早饭后，用一杯温水送服', times: ['08:00'] },
      { id: 'm2', name: '降糖药（示例）', dose: '1片', slot: 2, box: 'orange', pill: 'yellow', shape: 'oval', method: '和饭一起吃，用温水送服', times: ['08:00', '20:00'] }
    ],
    doses: [], parent: 'home', active: null, ringType: null, psms: null, lastSpeech: '',
    tab: 'home', call: null, msgs: [], banner: null, showAI: false, weekend: false, draft: null, note: '', listening: false,
    sc: 'normal', step: 0
  };
  buildDoses();
}

function buildDoses() {
  const old = Object.fromEntries(S.doses.map(d => [d.time, d]));
  const times = [...new Set(S.meds.flatMap(m => m.times))].sort();
  S.doses = times.map(time => {
    const medIds = S.meds.filter(m => m.times.includes(time)).map(m => m.id);
    if (old[time]) return { ...old[time], medIds };
    const past = toMin(time) <= S.min;
    return { id: time, time, medIds, status: 'pending', rang: past, reminded: past, escalated: past, skip: past, follow: null, recheck: null };
  });
}
const medsOf = d => d.medIds.map(id => S.meds.find(m => m.id === id)).sort((a, b) => mealStep(a).rank - mealStep(b).rank);
const dose = id => S.doses.find(d => d.id === id);
const names = d => medsOf(d).map(m => `${short(m.name)} ${m.dose}`).join('、');
const slots = d => medsOf(d).map(m => m.slot).join('、');

// ---------- 声音 ----------
let AC, ringTimer, bannerTimer;
function ac() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); return AC; } catch { return null; } }
function tone(f, dur, when = 0, vol = 0.08) {
  if (!sound) return; const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
  o.frequency.value = f; o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.start(t); o.stop(t + dur);
}
function speak(t) { if (!sound || !('speechSynthesis' in window)) return; try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang = 'zh-CN'; u.rate = 0.85; speechSynthesis.speak(u); } catch { } }
function say(t) { S.lastSpeech = t; speak(t); }
function startRing(prompt) {
  stopRing(); let n = 0;
  const p = () => { n++; if (n === 3) say(prompt); else if (n < 3 || n > 6) { tone(880, 0.25); tone(660, 0.25, 0.3); } if (n > 12) stopRing(); };
  p(); ringTimer = setInterval(p, 1500);
}
function stopRing() { clearInterval(ringTimer); ringTimer = null; }
function ding() { tone(1046, 0.15); tone(1318, 0.25, 0.15); }
function hush() { stopRing(); try { speechSynthesis.cancel(); } catch { } }

const stepName = (m, i) => `第${CN[i]}种${mealStep(m).label ? `，${mealStep(m).label}吃` : ''}`;
const instruction = d => { const ms = medsOf(d), seq = ms.length > 1; return `该吃${spokenTime(d.time)}的药了。` + (seq ? `一共${ms.length}种，请按顺序吃。` : '') + ms.map((m, i) =>
  `${seq ? stepName(m, i) + '：' : ''}打开药箱第${m.slot}格，拿${BOX[m.box][0]}盒子的${short(m.name)}，是${PILL[m.pill][0]}${SHAPE[m.shape]}的，吃${m.dose}。${m.method}。`).join('') +
  `${seq ? '都' : ''}吃好以后，请按左边绿色的“我吃好了”。如果遇到问题，比如找不到药、不知道怎么吃，请按右边橙色的“我需要帮忙”。`; };
const VOICE = {
  confirm: '您都吃好了吗？吃好了，请按绿色的“是的，都吃了”。还没吃，请按下面灰色的“还没有，返回”。',
  help: '遇到什么问题了？请按对应的按钮。一，找不到药。二，不知道怎么吃。三，记不清吃没吃。四，让孩子给我打电话。',
  helpSent: '好的，已经告诉女儿了。她会马上给您打电话，请稍等。',
  later: '好的，等一会儿再提醒您。'
};

// ---------- 时间推进与规则 ----------
function tick(to) { while (S.min < to) { S.min++; check(); } render(); }
function check() {
  for (const d of S.doses) {
    if (d.skip || d.status === 'done') continue;
    const dt = S.min - toMin(d.time);
    if (d.status === 'pending') {
      if (dt >= 0 && !d.rang) { d.rang = true; ring(d, 'due'); }
      if (dt >= S.repeatMin && !d.reminded) { d.reminded = true; ring(d, 'repeat'); }
      if (dt >= S.waitMin && !d.escalated) {
        d.escalated = true;
        notify({ type: 'alert', dose: d.id, title: '⚠️ 妈妈还没确认吃药', text: `${period(d.time)} ${d.time} 的药（${names(d)}）已经提醒了 2 次，过了 ${S.waitMin} 分钟还没确认。建议打个电话或发短信问问。` });
        emit('escalate');
      }
    }
    if (d.follow != null && S.min >= d.follow) { d.follow = null; d.recheck = S.min + 15; ring(d, 'follow'); }
    if (d.recheck != null && S.min >= d.recheck) {
      d.recheck = null;
      notify({ type: 'alert', dose: d.id, title: '⚠️ 妈妈还是没确认', text: `按你的要求又提醒了妈妈一次，15 分钟过去了，${d.time} 的药仍没确认。建议再打个电话。` });
    }
  }
}
function nextEvent() {
  const c = [];
  for (const d of S.doses) {
    if (d.skip || d.status === 'done') continue;
    const t = toMin(d.time);
    if (d.status === 'pending') { if (!d.rang) c.push(t); else if (!d.reminded) c.push(t + S.repeatMin); else if (!d.escalated) c.push(t + S.waitMin); }
    if (d.follow != null) c.push(d.follow);
    if (d.recheck != null) c.push(d.recheck);
  }
  const f = c.filter(x => x > S.min);
  return f.length ? Math.min(...f) : null;
}
function ring(d, type) {
  S.parent = 'ring'; S.active = d.id; S.ringType = type; S.psms = null;
  startRing(type === 'follow' ? '妈妈，女儿让我再提醒您吃药。请按绿色的接听键。' : '妈妈，该吃药了。请按绿色的接听键。');
  emit(type === 'due' ? 'ring' : type === 'repeat' ? 'remind' : 'follow');
}

function notify(m, quiet) {
  m.time = fmt(S.min); m.id = Math.random().toString(36).slice(2); m.read = !!quiet;
  S.msgs.unshift(m);
  if (quiet) return;
  S.banner = m; ding();
  const p = $('#childPhone'); p.classList.remove('buzz'); void p.offsetWidth; p.classList.add('buzz');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { S.banner = null; render(); }, 5000);
}

function confirm(d, by) {
  d.status = 'done'; d.by = by; d.at = S.min; d.follow = d.recheck = null;
  if (by === 'self') notify({ type: 'ok', dose: d.id, title: '✅ 妈妈已经吃药了', text: `${period(d.time)} ${d.time} 的药：${names(d)}。妈妈在 ${fmt(S.min)} 自己确认吃好了（药箱第 ${slots(d)} 格已打开）。` });
  else notify({ type: 'ok', dose: d.id, title: '✅ 已电话确认：妈妈吃了药', text: `${period(d.time)} ${d.time} 的药：${names(d)}。你在 ${fmt(S.min)} 通过电话确认。` });
}

function sendSms(d) {
  const text = `妈，记得吃${period(d.time)}${d.time}的药，药箱第${slots(d)}格。吃完按一下“我吃好了”哦。`;
  S.psms = { dose: d.id, text }; S.parent = 'sms'; S.active = d.id; stopRing();
  tone(988, 0.2); say(`女儿给您发来消息：${text}`);
  notify({ type: 'sent', dose: d.id, title: '💬 你给妈妈发了提醒短信', text }, true);
}

// ---------- AI ----------
function todayMark(d) {
  if (!d || d.skip) return 'wait';
  if (d.status === 'help') return 'help';
  if (d.status === 'done') return d.by === 'call' ? 'call' : d.at - toMin(d.time) >= S.repeatMin ? 'late' : 'ok';
  return d.escalated ? 'miss' : 'wait';
}
function aiHTML() {
  const today = [];
  for (const d of S.doses) {
    if (d.skip) continue;
    const p = `${period(d.time)} ${d.time}`;
    if (d.status === 'help') today.push(`${p} 的药，妈妈求助“${esc(d.reason)}”`);
    else if (d.status === 'pending' && d.escalated) today.push(`${p} 的药提醒了 2 次还没确认`);
    else if (d.status === 'done' && d.by === 'call') today.push(`${p} 的药是你打电话后才确认的`);
    else if (d.status === 'done' && todayMark(d) === 'late') today.push(`${p} 的药第 2 次提醒后才确认`);
  }
  const openNow = S.doses.find(open);
  const acts = [];
  if (openNow) acts.push(`<li><b>现在先联系妈妈</b>：${esc(openNow.status === 'help' ? `她说“${openNow.reason}”，打电话最快。` : '先发短信，不回再打电话。')}<div class="ai-btns"><button data-act="call" data-dose="${openNow.id}" class="callbtn sm">📞 打电话</button><button data-act="sms" data-dose="${openNow.id}" class="smsbtn sm">💬 发短信</button></div></li>`);
  acts.push(`<li><b>把周六、周日早上的提醒改到 9:00</b>：避开妈妈周末出门、起得晚的时间。<div class="ai-btns">${S.weekend ? '<span class="okchip">✅ 已改好，从明天（周六）开始</span>' : '<button data-act="weekend" class="aibtn sm">一键修改</button>'}</div></li>`);
  acts.push('<li><b>周末打电话时可以这样问</b>：“妈，周末早上药箱响的时候你一般在干嘛呀？要不要换个时间提醒？”</li>');
  acts.push('<li><b>晚上的药</b>：周二妈妈“记不清吃没吃”过一次。提醒她吃完立刻按确认，记不清时可以在药箱记录里查药格打开时间。</li>');
  return `<div class="ai-card"><div class="ai-h">✨ AI 帮你看了看</div>
    <div class="ai-sec"><b>📋 今天</b><p>${today.length ? today.join('；') + '。' : '到目前为止都按时确认了，不用专门打电话问吃药。'}</p></div>
    <div class="ai-sec"><b>📈 这一周的规律</b><p>早上 8 点的药：<b>周六、周日</b>都要第 2 次提醒或打电话后才确认，工作日都按时。可能是周末作息不同，8 点时妈妈不在手机旁边。</p></div>
    <div class="ai-sec"><b>💡 建议你这样做</b><ol>${acts.join('')}</ol></div>
    <div class="ai-foot">依据：最近 7 天的确认记录（过去 6 天为示例数据）。AI 只给建议，不改药、不判断是否真的吃了。</div></div>`;
}

// 把口语/医嘱文字整理成表单（规则 Mock）
function cnNum(s) {
  if (/^\d+(\.\d+)?$/.test(s)) return +s;
  if (s === '半') return 0.5;
  const n = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (s.includes('十')) { const [a, b] = s.split('十'); return (a ? n[a] : 1) * 10 + (b ? n[b] : 0); }
  return n[s] ?? NaN;
}
function aiParse(text) {
  const N = '[0-9一二两三四五六七八九十〇零]+';
  const t = text.replace(/：/g, ':');
  const nameM = t.match(/^(?:这是|这个是|这个药是|药名是|药名叫|吃的是|新开的)?\s*([^，,。；;\s:]+?)(?=[，,。；;\s:]|每次|一次|每天|每日|$)/);
  const doseM = t.match(new RegExp(`(?:每次|一次)?\\s*(${N}|半)\\s*(片|粒|袋|颗|滴|毫升|mL|ml|mg|毫克)`));
  const times = new Set();
  for (const m of t.matchAll(/(?:^|[^\d])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/g)) times.add(`${m[1].padStart(2, '0')}:${m[2]}`);
  for (const m of t.matchAll(new RegExp(`(早上|早晨|上午|中午|下午|晚上)?\\s*(${N})\\s*点\\s*(半|(${N})\\s*分?)?`, 'g'))) {
    let h = cnNum(m[2]); const mi = m[3] === '半' ? 30 : m[4] ? cnNum(m[4]) : 0;
    if (isNaN(h) || isNaN(mi) || h > 23 || mi > 59) continue;
    if ((m[1] === '下午' || m[1] === '晚上') && h < 12) h += 12;
    if (m[1] === '中午' && h < 6) h += 12;
    times.add(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`);
  }
  const how = t.match(/(饭前|饭后|餐前|餐后|空腹|睡前|随餐|和饭|吃饭时|进餐时|用温水|温水)[^，,。；;\n]*/);
  const dose = doseM ? `${cnNum(doseM[1]) === 0.5 ? '半' : cnNum(doseM[1])}${doseM[2]}` : '';
  return { name: nameM ? nameM[1] : '', dose, times: [...times].sort(), method: how ? how[0] : '' };
}
function voiceInput() {
  const f = S.draft, R = window.SpeechRecognition || window.webkitSpeechRecognition;
  const fallback = why => { f.text = SAMPLE_VOICE; f.aiNote = `（${why}，已用一段示例语音代替）`; S.listening = false; emit('voice'); render(); };
  if (!R) return fallback('当前浏览器不支持语音识别');
  let got = false;
  try {
    const r = new R(); r.lang = 'zh-CN'; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = e => { got = true; f.text = e.results[0][0].transcript; f.aiNote = '🎤 已听到，点“AI 帮我填”整理。'; S.listening = false; emit('voice'); render(); };
    r.onerror = e => { if (!got) fallback(e.error === 'not-allowed' ? '没有麦克风权限' : '没听清或语音服务不可用'); };
    r.onend = () => { if (!got && S.listening) fallback('没听清'); };
    S.listening = true; render(); r.start();
  } catch { fallback('语音识别启动失败'); }
}
function readPhoto(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 360 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.8)); }; img.onerror = rej; img.src = r.result; };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

// ---------- 引导情景 ----------
const SC = {
  normal: { title: '① 妈妈按时吃药', steps: [
    { text: '现在是早上 7:58。左边是<b>妈妈的手机</b>，右边是<b>你的手机</b>。建议打开电脑声音。点下面的【快进到 08:00】，看看到点会发生什么。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '8 点到了！妈妈的手机像来电一样<b>响铃</b>，还会<b>语音</b>说“该吃药了，请按绿色的接听键”。点绿色的【接听】。', target: '[data-act=answer]', wait: 'answer' },
    { text: '妈妈能看到<b>药盒和药片长什么样、药箱第几格亮灯、吃几片、怎么吃</b>，手机会全部读出来，并告诉她遇到问题可以按橙色的【我需要帮忙】。假设妈妈吃完了，点【我吃好了】。', target: '[data-act=done]', wait: 'doneClick' },
    { text: '手机会语音问妈妈“都吃好了吗？”，防止误按。点绿色的【是的，都吃了】。', target: '[data-act=yes]', wait: 'confirmed' },
    { text: '看右边！你的手机<b>马上收到通知</b>，几点吃的、吃了什么都写清楚了，不用再打电话问。点【✨ AI 帮我分析】，看看 AI 根据这一周的情况给你什么建议。', target: '[data-act=summary]', wait: 'summary' },
    { text: '🎉 完成！AI 发现妈妈<b>周末早上</b>经常要提醒两次，建议把周末的提醒改到 9 点，可以一键修改。接着试试「② 妈妈忘了吃药」。', end: true }
  ] },
  forgot: { title: '② 妈妈忘了吃药', steps: [
    { text: '现在是早上 7:58。点【快进到 08:00】。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '8 点手机响了，但这次假设<b>妈妈没听到</b>，没有接。点【快进到 08:15】。', ff: '08:15', target: '#g-ff', wait: 'remind' },
    { text: '8:15，妈妈的手机<b>第 2 次响铃</b>。假设还是没接，点【快进到 08:30】。', ff: '08:30', target: '#g-ff', wait: 'escalate' },
    { text: '过了约定的 30 分钟还没确认，<b>你的手机收到提醒</b>。可以发短信，也可以打电话。这次点红色的【📞 打给妈妈】。', target: '[data-act=call]', wait: 'call' },
    { text: '电话通了。假设妈妈说<b>“哎呀还没吃，我在买菜”</b>。点【还没吃，15 分钟后再响铃提醒妈妈】。', target: '[data-act=calllater]', wait: 'later' },
    { text: '设好了。点【快进到 08:45】，看看会不会再提醒妈妈。', ff: '08:45', target: '#g-ff', wait: 'follow' },
    { text: '8:45 妈妈的手机又响了，写着“女儿让我再提醒您”。这次妈妈接了，点【接听】。', target: '[data-act=answer]', wait: 'answer' },
    { text: '点【我吃好了】。', target: '[data-act=done]', wait: 'doneClick' },
    { text: '点【是的，都吃了】。', target: '[data-act=yes]', wait: 'confirmed' },
    { text: '🎉 完成！你的手机收到“妈妈已经吃药了”。只有真的没确认时你才需要介入，而且一个电话就能安排好后续提醒。', end: true }
  ] },
  help: { title: '③ 妈妈找不到药', steps: [
    { text: '现在是早上 7:58。点【快进到 08:00】。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '妈妈的手机响了，点绿色的【接听】。', target: '[data-act=answer]', wait: 'answer' },
    { text: '这次假设妈妈<b>找不到药</b>。点橙色的【我需要帮忙】。', target: '[data-act=help]', wait: 'helpClick' },
    { text: '手机会<b>按序号读出</b>四个选项，妈妈不识字也能按。点【1 找不到药】。', target: '[data-reason="找不到药"]', wait: 'help' },
    { text: '你的手机<b>立刻收到求助</b>，不用等 30 分钟。点【📞 打给妈妈】。', target: '[data-act=call]', wait: 'call' },
    { text: '电话里告诉妈妈：“药箱第 1 格，正在亮灯的蓝盒子。”妈妈找到并吃了，点【妈妈已经吃了】。', target: '[data-act=callok]', wait: 'callResult' },
    { text: '🎉 完成！妈妈遇到困难时一键求助，你能马上知道是什么问题。', end: true }
  ] },
  setup: { title: '④ 帮妈妈录入新药', steps: [
    { text: '现在是晚上 8:50，今天的药妈妈都吃了。医生新开了一种药，你来帮妈妈录入。点右边手机底部的【💊 药品】。', target: '[data-tab=meds]', wait: 'tab:meds' },
    { text: '点【＋ 添加新药】。', target: '[data-act=add]', wait: 'add' },
    { text: '可以打字，也可以<b>直接说</b>。点【🎤 语音说】，说一句：“这是降脂药，每次一片，晚上九点吃，睡前用温水送服”。（浏览器不支持语音时，会自动用这句示例代替）', target: '[data-act=voice]', wait: 'voice' },
    { text: '点【✨ AI 帮我填】，AI 会把这句话整理成药名、剂量、时间和吃法。', target: '[data-act=ai]', wait: 'ai' },
    { text: 'AI 填好了，请核对。为了不吃错，最好点【📷 拍照/上传药盒照片】放一张实物照片（可跳过，跳过会用颜色和形状示意）。然后点【保存】。', target: '[data-act=save]', wait: 'setup' },
    { text: '保存好了，妈妈的手机会按时提醒。点【快进到 21:00】。', ff: '21:00', target: '#g-ff', wait: 'ring' },
    { text: '妈妈的手机响了，点【接听】，看看妈妈看到的是不是你刚才录入的样子。', target: '[data-act=answer]', wait: 'answer' },
    { text: '🎉 完成！你只需要录入一次，之后每天到点都会这样提醒妈妈。', end: true }
  ] },
  free: { title: '自由体验', steps: [] }
};

function start(key) {
  hush(); clearTimeout(bannerTimer); fresh(); S.sc = key; S.step = 0;
  if (key === 'setup') {
    const now = 20 * 60 + 50;
    for (const d of S.doses) { Object.assign(d, { rang: true, reminded: true, escalated: true }); S.min = toMin(d.time) + 4; confirm(d, 'self'); }
    S.min = now; S.banner = null; S.msgs.forEach(m => m.read = true); clearTimeout(bannerTimer);
    $('#childPhone').classList.remove('buzz');
  }
  render();
}
function emit(ev) { const st = SC[S.sc]?.steps[S.step]; if (st && st.wait === ev) S.step++; }

// ---------- 渲染 ----------
function art(m, k = 1) {
  if (m.photo) return `<img class="photo" src="${esc(m.photo)}" style="max-width:${130 * k}px;max-height:${100 * k}px" alt="${esc(short(m.name))}实物照片">`;
  const box = BOX[m.box][1], pill = PILL[m.pill][1]; let p;
  if (m.shape === 'round') p = `<circle cx="98" cy="45" r="14" fill="${pill}" stroke="#334155" stroke-width="2"/><line x1="98" y1="33" x2="98" y2="57" stroke="#94a3b8" stroke-width="2"/>`;
  else if (m.shape === 'oval') p = `<ellipse cx="98" cy="45" rx="19" ry="11" fill="${pill}" stroke="#334155" stroke-width="2"/>`;
  else p = `<g transform="rotate(-25 98 45)"><rect x="78" y="37" width="40" height="16" rx="8" fill="${pill}" stroke="#334155" stroke-width="2"/><rect x="78" y="37" width="20" height="16" rx="8" fill="${box}" stroke="#334155" stroke-width="2"/></g>`;
  return `<svg class="art" viewBox="0 0 125 80" width="${125 * k}" height="${80 * k}" role="img" aria-label="${esc(look(m))}"><rect x="6" y="8" width="62" height="64" rx="6" fill="${box}"/><rect x="12" y="26" width="50" height="22" rx="3" fill="#fff"/><text x="37" y="41" font-size="10" text-anchor="middle" fill="#111">${esc(short(m.name).slice(0, 4))}</text>${p}</svg>`;
}
const pillbox = lit => `<div class="pillbox">${[1, 2, 3, 4, 5, 6].map(i => `<div class="cell ${lit.includes(i) ? 'lit' : ''}">${i}</div>`).join('')}</div>`;
const sbar = dark => `<div class="sbar ${dark ? 'dark' : ''}"><span>${fmt(S.min)}</span><span>📶 🔋</span></div>`;
const replay = '<button data-act="replay" class="p-sec">🔊 再听一遍</button>';

function parentHTML() {
  const d = dose(S.active);
  if (S.call) return sbar(true) + `<div class="p-incall"><div class="avatar">👩</div><div class="who">女儿</div><div class="cst">${S.call.stage === 'calling' ? '来电中…' : '通话中'}</div></div>`;
  switch (S.parent) {
    case 'ring': return sbar(true) + `<div class="p-ring"><div class="ring-icon">💊</div><div class="ring-title">该吃药了</div><div class="ring-sub">${period(d.time)} ${d.time} · ${d.medIds.length} 种药</div>${S.ringType === 'repeat' ? '<div class="ring-tag">第 2 次提醒</div>' : S.ringType === 'follow' ? '<div class="ring-tag">女儿让我再提醒您</div>' : ''}<div class="ring-actions"><div><button data-act="later" class="r-btn r-later">⏰</button><span>稍后</span></div><div><button data-act="answer" class="r-btn r-answer">📞</button><span>接听</span></div></div></div>`;
    case 'sms': return sbar() + `<div class="p-body"><h2>💬 女儿发来消息</h2><div class="p-sms">${esc(S.psms.text)}</div>${replay}</div><div class="p-actions one"><button data-act="gotake" class="p-ok">💊 好的，去吃药</button></div>`;
    case 'guide': {
      const ms = medsOf(d);
      const seq = ms.length > 1;
      return sbar() + `<div class="p-body"><h2>${period(d.time)} ${d.time}<br>要吃 ${ms.length} 种药${seq ? '<br><small>请按顺序吃</small>' : ''}</h2>
        <div class="pb-wrap"><div class="pb-title">💡 药箱这几格在亮灯</div>${pillbox(ms.map(m => m.slot))}</div>
        ${ms.map((m, i) => `<div class="med">${seq ? `<div class="mstep">${stepName(m, i)}</div>` : ''}<div class="slotno">第 ${m.slot} 格</div>${art(m, 1.3)}<div class="mname">${esc(short(m.name))}</div><div class="mlook">${esc(look(m))}</div><div class="mdose">吃 <b>${esc(m.dose)}</b></div><div class="mhow">${esc(m.method)}</div></div>`).join('')}
        ${replay}</div>
        <div class="p-actions"><button data-act="done" class="p-ok">✅ 我吃好了</button><button data-act="help" class="p-help">🙋 我需要帮忙</button></div>`;
    }
    case 'confirm': return sbar() + `<div class="p-body center"><h2>都吃好了吗？</h2>${medsOf(d).map(m => `<div class="cfm">${art(m, .8)}<span>${esc(short(m.name))} ${esc(m.dose)}</span></div>`).join('')}${replay}</div><div class="p-actions col"><button data-act="yes" class="p-ok">✅ 是的，都吃了</button><button data-act="no" class="p-sec">还没有，返回</button></div>`;
    case 'help': return sbar() + `<div class="p-body"><h2>遇到什么问题？</h2>${REASONS.map((r, i) => `<button data-reason="${r}" class="p-reason"><span class="num">${i + 1}</span>${r}</button>`).join('')}${replay}<button data-act="back" class="p-sec">返回</button></div>`;
    case 'helpSent': return sbar() + `<div class="p-body center"><div class="big-emoji">📨</div><h2>已经告诉女儿了</h2><p class="p-text">她会马上给您打电话，<br>请稍等。</p>${replay}</div>`;
    case 'done': {
      const nx = S.doses.find(x => x.status === 'pending' && !x.skip && toMin(x.time) > S.min);
      return sbar() + `<div class="p-body center"><div class="big-emoji">👍</div><h2>吃好了！</h2><p class="p-text">${d?.by === 'call' ? '女儿已经帮您记录好了' : '已经告诉女儿了'}</p>${nx ? `<p class="p-text small">下一次：${period(nx.time)} ${nx.time}</p>` : ''}${replay}<button data-act="home" class="p-sec">返回</button></div>`;
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
  if (d.follow != null) return `⏰ ${fmt(d.follow)} 会再提醒妈妈`;
  if (d.escalated) return '⚠️ 超时没确认';
  if (d.rang) return '⏳ 已提醒，等妈妈确认';
  return '还没到时间';
}
const open = d => d && !d.skip && (d.status === 'help' || (d.status === 'pending' && d.escalated));
const contactBtns = d => `<div class="ai-btns"><button data-act="call" data-dose="${d.id}" class="callbtn">📞 打给妈妈</button><button data-act="sms" data-dose="${d.id}" class="smsbtn">💬 发短信提醒</button></div>`;

function weekHTML() {
  const rows = [['早上', '08:00', 'am'], ['晚上', '20:00', 'pm']];
  const days = [...WEEK, { d: '10/9', w: '五', today: true }];
  return `<div class="week"><div class="week-h">最近 7 天</div><table><tr><th></th>${days.map(x => `<th class="${x.today ? 'today' : ''}">${x.w}</th>`).join('')}</tr>${rows.map(([n, t, k]) => `<tr><td>${n}</td>${days.map(x => { const v = x.today ? todayMark(dose(t)) : x[k]; return `<td title="${MARK[v][1]}">${MARK[v][0]}</td>`; }).join('')}</tr>`).join('')}</table><div class="legend">✅ 按时　🟠 第2次提醒后　📞 打电话后　🙋 求助</div></div>`;
}

function childHTML() {
  if (S.call) {
    const talking = S.call.stage === 'talking';
    return sbar(true) + `<div class="c-call"><div class="avatar">👵</div><div class="who">妈妈</div><div class="cst">${talking ? '通话中' : '正在呼叫…'}</div>
      ${talking ? `<div class="c-callnote">问完以后，记录一下结果：</div><button data-act="callok" class="p-ok">✅ 妈妈已经吃了</button><button data-act="calllater" class="c-ghost">还没吃，15 分钟后再响铃提醒妈妈</button>` : ''}</div>`;
  }
  const unread = S.msgs.filter(m => !m.read).length;
  const b = S.banner ? `<div class="banner ${S.banner.type}" data-tab="msgs"><div class="b-app">安心药箱 · 现在</div><b>${esc(S.banner.title)}</b><div>${esc(S.banner.text)}</div></div>` : '';
  let body = '';
  if (S.tab === 'home') {
    const todo = S.doses.filter(open);
    body = `<div class="c-head"><div class="c-hi">妈妈今天的吃药情况</div><div class="c-sub">10月9日 周五 · 现在 ${fmt(S.min)}</div></div>
      ${todo.map(d => `<div class="alert ${d.status}"><b>${d.status === 'help' ? '🙋 妈妈需要帮忙' : '⚠️ 妈妈还没确认吃药'}</b><p>${d.status === 'help' ? `${d.time} 的药：妈妈说“${esc(d.reason)}”` : `${d.time} 的药提醒了 2 次，${S.waitMin} 分钟没确认`}${d.follow != null ? `<br>⏰ ${fmt(d.follow)} 会再响铃提醒妈妈` : ''}</p>${contactBtns(d)}</div>`).join('')}
      <div class="c-doses">${S.doses.map(d => `<div class="c-dose ${d.status} ${open(d) && d.status === 'pending' ? 'late' : ''}"><div class="c-time">${d.time}<small>${period(d.time)}</small></div><div><div class="c-meds">${esc(names(d))}</div><div class="c-st">${statusText(d)}</div></div></div>`).join('')}</div>
      ${weekHTML()}
      ${S.showAI ? aiHTML() : '<button data-act="summary" class="aibtn">✨ AI 帮我分析：接下来怎么做</button>'}`;
  } else if (S.tab === 'msgs') {
    body = `<div class="c-head"><div class="c-hi">消息</div><div class="c-sub">来自 安心药箱</div></div>` + (S.msgs.map(m => `<div class="sms ${m.type}"><div class="sms-t">${esc(m.title)}</div><div>${esc(m.text)}</div><small>${m.time}</small>${open(dose(m.dose)) && (m.type === 'alert' || m.type === 'help') ? contactBtns(dose(m.dose)) : ''}</div>`).join('') || '<p class="empty">还没有消息。妈妈吃完药、或者需要你帮忙时，这里会收到通知。</p>');
  } else {
    const f = S.draft;
    body = `<div class="c-head"><div class="c-hi">妈妈的药</div><div class="c-sub">录入一次，每天自动提醒</div></div>
      ${S.note ? `<div class="okbar">${esc(S.note)}</div>` : ''}
      ${f ? `<div class="form">
        <label>说一说，或者把医生写的用法贴进来</label><textarea data-f="text" rows="3" placeholder="例如：这是降脂药，每次一片，晚上九点吃，睡前用温水送服">${esc(f.text)}</textarea>
        <div class="two"><button data-act="voice" class="voicebtn">${S.listening ? '👂 正在听…' : '🎤 语音说'}</button><button data-act="ai" class="aibtn">✨ AI 帮我填</button></div>${f.aiNote ? `<div class="ainote">${esc(f.aiNote)}</div>` : ''}
        <label>药名</label><input data-f="name" value="${esc(f.name)}">
        <div class="two"><div><label>每次吃多少</label><input data-f="dose" value="${esc(f.dose)}" placeholder="1片"></div><div><label>几点吃（可多个）</label><input data-f="times" value="${esc(f.times)}" placeholder="08:00, 20:00"></div></div>
        <label>怎么吃</label><input data-f="method" value="${esc(f.method)}" placeholder="例如：饭后用温水送服">
        <label>放在药箱第几格</label><select data-f="slot">${[1, 2, 3, 4, 5, 6].map(i => `<option ${+f.slot === i ? 'selected' : ''}>${i}</option>`).join('')}</select>
        <label>📷 药盒 / 药片照片（推荐，妈妈对照实物不容易吃错）</label><label class="upload">${f.photo ? '已上传，点这里换一张' : '拍照 / 上传照片'}<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
        <div class="muted">没有照片时，用下面的颜色和形状画示意图：</div>
        <div class="two"><div><label>药盒颜色</label><select data-f="box">${Object.entries(BOX).map(([k, v]) => `<option value="${k}" ${f.box === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div><div><label>药片颜色</label><select data-f="pill">${Object.entries(PILL).map(([k, v]) => `<option value="${k}" ${f.pill === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div></div>
        <label>药片形状</label><select data-f="shape">${Object.entries(SHAPE).map(([k, v]) => `<option value="${k}" ${f.shape === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <div class="preview">妈妈会看到：${art({ ...f, name: f.name || '药名' }, .9)}</div>
        ${f.err ? `<div class="err">${esc(f.err)}</div>` : ''}
        <div class="two"><button data-act="cancel" class="c-ghost">取消</button><button data-act="save" class="p-ok sm">保存</button></div>
      </div>` : '<button data-act="add" class="addbtn">＋ 添加新药</button>'}
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
function toGuide(d) { S.parent = 'guide'; S.active = d.id; say(instruction(d)); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-tab],[data-sc],[data-reason]'); if (!el) return;
  ac()?.resume?.();
  const d = dose(S.active);
  if (el.dataset.sc) return start(el.dataset.sc);
  if (el.dataset.tab) { S.tab = el.dataset.tab; S.banner = null; S.note = ''; if (S.tab === 'msgs') S.msgs.forEach(m => m.read = true); emit('tab:' + S.tab); return render(); }
  if (el.dataset.reason) {
    d.status = 'help'; d.reason = el.dataset.reason; S.parent = 'helpSent'; say(VOICE.helpSent);
    notify({ type: 'help', dose: d.id, title: '🙋 妈妈需要帮忙', text: `${period(d.time)} ${d.time} 的药：妈妈说“${d.reason}”。建议现在打个电话。` });
    emit('help'); return render();
  }
  switch (el.dataset.act) {
    case 'ff': return tick(toMin(el.dataset.to));
    case 'next': { const n = nextEvent(); return n == null ? alert('今天没有待提醒的事了。可以在你手机的【药品】页添加新药。') : tick(n); }
    case 'plus15': return tick(S.min + 15);
    case 'sound': sound = !sound; if (!sound) hush(); break;
    case 'restart': return start(S.sc);
    case 'answer': stopRing(); toGuide(d); emit('answer'); break;
    case 'later': stopRing(); S.parent = 'home'; say(VOICE.later); break;
    case 'replay': speak(S.lastSpeech); break;
    case 'done': S.parent = 'confirm'; say(VOICE.confirm); emit('doneClick'); break;
    case 'no': toGuide(d); break;
    case 'yes': confirm(d, 'self'); S.parent = 'done'; { const nx = S.doses.find(x => x.status === 'pending' && !x.skip && toMin(x.time) > S.min); say(`好的，吃好了，已经告诉女儿了。${nx ? `下一次是${spokenTime(nx.time)}。` : '今天的药都吃完了。'}`); } emit('confirmed'); break;
    case 'help': S.parent = 'help'; say(VOICE.help); emit('helpClick'); break;
    case 'back': toGuide(d); break;
    case 'home': hush(); S.parent = 'home'; break;
    case 'gotake': toGuide(dose(S.psms.dose)); S.psms = null; break;
    case 'summary': S.showAI = true; emit('summary'); break;
    case 'weekend': S.weekend = true; break;
    case 'sms': sendSms(dose(el.dataset.dose)); emit('sms'); break;
    case 'call': {
      hush(); S.call = { dose: el.dataset.dose, stage: 'calling' }; S.banner = null; emit('call');
      setTimeout(() => { if (S.call) { S.call.stage = 'talking'; render(); } }, 1300); break;
    }
    case 'callok': { const cd = dose(S.call.dose); S.call = null; S.active = cd.id; confirm(cd, 'call'); S.parent = 'done'; S.tab = 'home'; emit('callResult'); break; }
    case 'calllater': {
      const cd = dose(S.call.dose); S.call = null; S.parent = 'home'; S.tab = 'home';
      cd.follow = S.min + 15; cd.recheck = null;
      notify({ type: 'sent', dose: cd.id, title: '⏰ 已设好再次提醒', text: `${fmt(cd.follow)} 药箱会再响铃提醒妈妈；如果之后 15 分钟还没确认，会再通知你。` }, true);
      emit('later'); break;
    }
    case 'add':
      S.note = ''; S.draft = { text: '', name: '', dose: '', times: '', method: '', slot: '3', box: 'green', pill: 'white', shape: 'capsule', photo: '' };
      emit('add'); break;
    case 'voice': if (!S.listening) voiceInput(); return;
    case 'ai': {
      const f = S.draft, text = f.text.trim();
      if (!text) { f.aiNote = '请先说一句或贴一段用法。'; break; }
      const r = aiParse(text);
      Object.assign(f, { name: r.name || f.name, dose: r.dose || f.dose, times: r.times.join(', ') || f.times, method: r.method || f.method });
      const miss = [!r.name && '药名', !r.dose && '每次吃多少', !r.times.length && '具体几点', !r.method && '怎么吃'].filter(Boolean);
      f.aiNote = '✨ AI 已整理出能确定的内容。' + (miss.length ? `原话里没说清楚的（${miss.join('、')}）请你补上，AI 不会瞎猜。` : '请核对一遍。');
      emit('ai'); break;
    }
    case 'cancel': S.draft = null; break;
    case 'save': {
      const f = S.draft, times = f.times.split(/[,，、\s]+/).filter(Boolean).map(t => t.replace('：', ':').padStart(5, '0'));
      if (!f.name.trim() || !f.dose.trim() || !f.method.trim()) { f.err = '请填写药名、每次吃多少和怎么吃。'; break; }
      if (!times.length || times.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) { f.err = '吃药时间请写成 08:00 这样的格式。'; break; }
      S.meds.push({ id: 'm' + Date.now(), name: f.name.trim(), dose: f.dose.trim(), method: f.method.trim(), slot: +f.slot, box: f.box, pill: f.pill, shape: f.shape, photo: f.photo, times: [...new Set(times)] });
      buildDoses(); S.draft = null; S.note = `✅ 已保存「${short(f.name)}」，到点会提醒妈妈。`; emit('setup'); break;
    }
    default: return;
  }
  render();
});

const refreshPreview = () => { const p = document.querySelector('.preview'); if (p && S.draft) p.innerHTML = '妈妈会看到：' + art({ ...S.draft, name: S.draft.name || '药名' }, .9); };
document.addEventListener('input', e => {
  const k = e.target.dataset.f;
  if (k && S.draft) { S.draft[k] = e.target.value; if (['box', 'pill', 'shape', 'name'].includes(k)) refreshPreview(); }
  if (e.target.id === 'wait') { S.waitMin = +e.target.value; render(); }
});
document.addEventListener('change', async e => {
  if (e.target.dataset.photo === undefined || !S.draft) return;
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { S.draft.err = '请选择 10MB 以内的图片。'; return render(); }
  try { S.draft.photo = await readPhoto(file); S.draft.err = ''; } catch { S.draft.err = '图片读取失败，请换一张。'; }
  render();
});

start('normal');

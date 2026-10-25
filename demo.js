const BROWSER = typeof document !== 'undefined';
const $ = s => BROWSER ? document.querySelector(s) : null;
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
  { d: '10/5', w: '一', am: 'ok', pm: 'ok' }, { d: '10/6', w: '二', am: 'ok', pm: 'help', pmWhy: '记不清吃没吃' },
  { d: '10/7', w: '三', am: 'ok', pm: 'ok' }, { d: '10/8', w: '四', am: 'ok', pm: 'ok' }
];
const MARK = { ok: ['✅', '按时'], late: ['🟠', '第2次提醒后'], call: ['📞', '打电话后'], help: ['🙋', '求助'], miss: ['⚠️', '没确认'], wait: ['·', '未到/等待'] };

let sound = true;
let S;

function fresh() {
  S = {
    min: 7 * 60 + 58, waitMin: 30, repeatMin: 15, refillDays: 7, restock: null,
    meds: [
      { id: 'm1', name: '降压药（示例）', dose: '1片', slot: 1, box: 'blue', pill: 'white', shape: 'round', method: '早饭后，用一杯温水送服', times: ['08:00'], stock: 30 },
      { id: 'm2', name: '降糖药（示例）', dose: '1片', slot: 2, box: 'orange', pill: 'yellow', shape: 'oval', method: '和饭一起吃，用温水送服', times: ['08:00', '20:00'], stock: 16 }
    ],
    doses: [], parent: 'home', active: null, ringType: null, psms: null, lastSpeech: '',
    tab: 'home', view: null, call: null, msgs: [], banner: null, showAI: false, weekend: false, weekendSkip: false, draft: null, note: '', listening: false, medIdx: 0,
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
const slots = d => medsOf(d).map(m => m.slot).sort((a, b) => a - b).join('、');

// ---------- 声音 ----------
let AC, ringTimer, bannerTimer;
function ac() { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); return AC; } catch { return null; } }
function tone(f, dur, when = 0, vol = 0.08) {
  if (!sound) return; const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + when;
  o.frequency.value = f; o.connect(g); g.connect(c.destination);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.start(t); o.stop(t + dur);
}
// 浏览器朗读长句会中途停、cancel 后立刻 speak 会被吞，所以按句拆开排队并稍等再读
let speakTimer, utterQ = [];
const zhVoice = () => { const vs = speechSynthesis.getVoices().filter(v => /^zh[-_]CN/i.test(v.lang)); return vs.find(v => /Xiaoxiao|Natural/i.test(v.name)) || vs[0]; };
const TTS = typeof speechSynthesis !== 'undefined';
if (TTS) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }
function speak(t) {
  if (!sound || !TTS || !t) return;
  try {
    clearTimeout(speakTimer); speechSynthesis.cancel();
    const v = zhVoice();
    utterQ = (t.match(/[^。！？]+[。！？]?/g) || [t]).map(p => { const u = new SpeechSynthesisUtterance(p); u.lang = 'zh-CN'; u.rate = 0.85; if (v) u.voice = v; return u; });
    speakTimer = setTimeout(() => { speechSynthesis.resume(); utterQ.forEach(u => speechSynthesis.speak(u)); }, 150);
  } catch { }
}
function say(t) { S.lastSpeech = t; speak(t); }
function startRing(prompt) {
  stopRing(); if (!BROWSER) return; let n = 0;
  const p = () => { n++; if (n === 3) say(prompt); else if (n < 3 || n > 6) { tone(880, 0.25); tone(660, 0.25, 0.3); } if (n > 12) stopRing(); };
  p(); ringTimer = setInterval(p, 1500);
}
function stopRing() { clearInterval(ringTimer); ringTimer = null; }
function ding() { tone(1046, 0.15); tone(1318, 0.25, 0.15); }
function hush() { stopRing(); clearTimeout(speakTimer); try { speechSynthesis.cancel(); } catch { } }

const stepName = (m, i) => `第${CN[i]}种${mealStep(m).label ? `，${mealStep(m).label}吃` : ''}`;
const instruction = d => { const ms = medsOf(d), seq = ms.length > 1; return `该吃${spokenTime(d.time)}的药了。` + (seq ? `一共${ms.length}种，请按顺序吃。` : '') + ms.map((m, i) =>
  `${seq ? stepName(m, i) + '：' : ''}打开药盒第${m.slot}格，拿${BOX[m.box][0]}盒子的${short(m.name)}，是${PILL[m.pill][0]}${SHAPE[m.shape]}的，吃${m.dose}。${m.method}。`).join('') +
  `${seq ? '都' : ''}吃好以后，请按左边绿色的“我吃好了”。如果遇到问题，比如找不到药、不知道怎么吃，请按右边橙色的“我需要帮忙”。`; };
const VOICE = {
  confirm: '您都吃好了吗？吃好了，请按绿色的“是的，都吃了”。还没吃，请按下面灰色的“还没有，返回”。',
  help: '遇到什么问题了？请按对应的按钮。一，找不到药。二，不知道怎么吃。三，记不清吃没吃。四，让孩子给我打电话。',
  helpSent: '好的，已经告诉女儿了。她会马上给您打电话，请稍等。',
  unsureSent: '好的，已经告诉女儿了。先不要再吃这一次的药，等女儿给您打电话，一起确认。',
  later: '什么时候再提醒您？还没开饭，按第 1 个；不在家，按第 2 个。',
  ask: '早上的药吃好了吗？吃好了，直接说“吃好了”，或者按绿色的按钮。'
};
const ASK_AFTER = 10; // 看完指引多少分钟还没确认，手机追问一句

// ---------- 时间推进与规则 ----------
function tick(to) { while (S.min < to) { S.min++; check(); } render(); }
function check() {
  for (const d of S.doses) {
    if (d.skip || d.status === 'done') continue;
    // 父母选了"待会再吃"后，再次响铃、通知子女的时间都从延后的时刻重新算
    const dt = S.min - (d.base ?? toMin(d.time));
    if (d.status === 'pending' && d.guideAt != null && !d.asked && S.min >= d.guideAt + ASK_AFTER && S.parent === 'guide' && S.active === d.id) {
      d.asked = true; S.parent = 'ask'; say(VOICE.ask); emit('ask');
    }
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
    const t = d.base ?? toMin(d.time);
    if (d.status === 'pending' && d.guideAt != null && !d.asked && S.parent === 'guide' && S.active === d.id) c.push(d.guideAt + ASK_AFTER);
    if (d.status === 'pending') { if (!d.rang) c.push(t); else if (!d.reminded) c.push(t + S.repeatMin); else if (!d.escalated) c.push(t + S.waitMin); }
    if (d.follow != null) c.push(d.follow);
    if (d.recheck != null) c.push(d.recheck);
  }
  const f = c.filter(x => x > S.min);
  return f.length ? Math.min(...f) : null;
}
function ring(d, type) {
  if (d.snooze && type === 'due') { type = 'snooze'; d.snooze = null; }
  S.parent = 'ring'; S.active = d.id; S.ringType = type; S.psms = null; S.medIdx = 0;
  startRing(type === 'follow' ? '妈妈，女儿让我再提醒您吃药。请按绿色的接听键。' : '妈妈，该吃药了。请按绿色的接听键。');
  emit(type === 'due' ? 'ring' : type === 'repeat' ? 'remind' : type === 'snooze' ? 'snoozeRing' : 'follow');
}
// 待会再吃：从现在起延后若干分钟再响铃，期间不算"没确认"
function snooze(d, mins, why) {
  d.base = S.min + mins; d.rang = d.reminded = d.escalated = false; d.guideAt = null; d.asked = false;
  d.snooze = { until: d.base, why };
}

function notify(m, quiet) {
  m.time = fmt(S.min); m.id = Math.random().toString(36).slice(2); m.read = !!quiet;
  S.msgs.unshift(m);
  if (quiet || !BROWSER) return;
  S.banner = m; ding();
  const p = $('#childPhone'); p.classList.remove('buzz'); void p.offsetWidth; p.classList.add('buzz');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { S.banner = null; render(); }, 5000);
}

function confirm(d, by) {
  d.status = 'done'; d.by = by; d.at = S.min; d.follow = d.recheck = null;
  if (by === 'self') notify({ type: 'ok', dose: d.id, title: '✅ 妈妈已经吃药了', text: `${period(d.time)} ${d.time} 的药：${names(d)}。妈妈在 ${fmt(S.min)} 自己确认吃好了。` });
  else notify({ type: 'ok', dose: d.id, title: '✅ 已电话确认：妈妈吃了药', text: `${period(d.time)} ${d.time} 的药：${names(d)}。你在 ${fmt(S.min)} 通过电话确认。` });
  useStock(d);
}

// ---------- 补药提醒（参考 Medisafe、MyTherapy 的余量提醒）----------
// 只在确认吃了之后按每次用量扣减；"记不清吃没吃"、没确认都不扣，宁可少算也不乱算
const perDose = m => { const r = String(m.dose).match(/^([0-9.]+|[一二两三四五六七八九十]+|半)\s*(片|粒|颗|袋)/); const v = r ? cnNum(r[1]) : NaN; return v > 0 ? v : null; };
const unit = m => String(m.dose).match(/片|粒|颗|袋/)?.[0] || '片';
const daysLeft = m => { const p = perDose(m); return m.stock == null || !p ? null : Math.floor(m.stock / (p * m.times.length)); };
const lowStock = () => S.meds.filter(m => daysLeft(m) != null && daysLeft(m) <= S.refillDays);
const stockText = m => `还剩 ${m.stock} ${unit(m)}，每天 ${m.times.length} 次、每次${m.dose}，约够吃 ${daysLeft(m)} 天`;
function useStock(d) {
  for (const m of medsOf(d)) {
    const p = perDose(m); if (m.stock == null || !p) continue;
    m.stock = Math.max(0, m.stock - p);
    if (daysLeft(m) <= S.refillDays && !m.refillWarned) {
      m.refillWarned = true;
      // 不抢"妈妈已经吃药了"的横幅，放进消息里标未读
      notify({ type: 'refill', title: `💊 ${short(m.name)}快吃完了`, text: `${stockText(m)}。记得帮妈妈买药，买回来后在【💊 药品】里补上药量。` }, true);
      S.msgs[0].read = false;
    }
  }
}
function restock(m, n) {
  m.stock = (m.stock || 0) + n;
  m.refillWarned = daysLeft(m) <= S.refillDays;
}

const UNSURE = '记不清吃没吃';
function askHelp(d, reason) {
  d.status = 'help'; d.reason = reason; d.helpAt = S.min; S.parent = 'helpSent';
  say(reason === UNSURE ? VOICE.unsureSent : VOICE.helpSent);
  notify({ type: 'help', dose: d.id, title: '🙋 妈妈需要帮忙', text: `${period(d.time)} ${d.time} 的药：妈妈说“${reason}”。` + (reason === UNSURE ? `已提醒妈妈先别再吃。打电话时先请她看看药盒第 ${slots(d)} 格里的药还在不在，再决定要不要补吃，避免重复吃药。` : '建议现在打个电话。') });
}

function sendSms(d) {
  const text = `妈，记得吃${period(d.time)}${d.time}的药，药盒第${slots(d)}格。吃完按一下“我吃好了”哦。`;
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
// 规则 Mock：从 7 天记录里统计规律，文字和建议都由统计结果决定
const LATE = ['late', 'call', 'miss'];
const isWeekend = x => x.w === '六' || x.w === '日';
function weekStats() {
  const today = { w: '五', am: todayMark(dose('08:00')), pm: todayMark(dose('20:00')), amWhy: dose('08:00')?.reason, pmWhy: dose('20:00')?.reason };
  const days = [...WEEK, today], out = {};
  for (const k of ['am', 'pm']) {
    const had = days.filter(x => x[k] !== 'wait'), we = had.filter(isWeekend), wd = had.filter(x => !isWeekend(x));
    const late = list => list.filter(x => LATE.includes(x[k])).length;
    const s = { n: had.length, ok: had.filter(x => x[k] === 'ok').length, we: we.length, weLate: late(we), wd: wd.length, wdLate: late(wd), help: had.filter(x => x[k] === 'help').map(x => ({ w: x.w, why: x[k + 'Why'] })) };
    s.weekendPattern = s.we > 0 && s.weLate / s.we >= 0.5 && (s.wd === 0 || s.wdLate / s.wd <= 0.25);
    out[k] = s;
  }
  return out;
}
function patternText(label, s) {
  if (!s.n) return `${label}：还没有记录。`;
  let t = `${label}：${s.n} 天里 ${s.ok} 天一次提醒就按时确认`;
  if (s.weekendPattern) t += `；<b>周末 ${s.weLate}/${s.we} 天</b>要第 2 次提醒或打电话才确认，工作日只有 ${s.wdLate}/${s.wd} 天。可能是周末作息不同，这个时间妈妈不在手机旁边`;
  else if (s.weLate + s.wdLate) t += `；${s.weLate + s.wdLate} 天要第 2 次提醒或打电话，没看出固定规律`;
  if (s.help.length) t += `；${s.help.map(h => `周${h.w}求助过${h.why ? `“${h.why}”` : ''}`).join('、')}`;
  return t + '。';
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

// ---------- 大模型整理医嘱（DeepSeek，经 Cloudflare Worker 中转保管密钥）----------
// 分工：模型只抽取原话里明确写了的内容，并给出每一项依据的原文片段；
// 规则层逐项核对依据（groundCheck），对不上原文的一律去掉，留给子女补充——宁可空着，也不编。
const AI_ENDPOINT = 'https://sansan-ai.sihanzheng68.workers.dev';
function rxPrompt(text) {
  return '你在帮子女把医嘱、药盒说明或口头交代整理成用药表单。只抽取原话里明确写了的内容，没写的字段一律留空，不要根据常识或药名推测。\n\n' +
    '字段：\n' +
    '- name：药名（原话里的叫法）\n' +
    '- dose：每次吃多少，数字+单位，如 "1片" "2粒" "半片" "5mg"；处方里"规格 + qd/bid/tid"的写法，这个规格就是每次剂量；"早晚各一片" "每次一片"就是 1 片；说明书写"成人一次2片"取成人剂量；只写了一天总量、给的是范围（一次1~2片、一到两粒）、不同时段剂量不同（早上一片晚上半片）时才留空\n' +
    '- times：具体几点吃，24 小时制 "HH:MM" 数组；只说了"一日三次""早晚各一次""饭后"而没说几点时，留空数组，不要自己定时间\n' +
    '- method：怎么吃，如 "饭前" "饭后" "随餐" "睡前" "空腹" "温水送服" "舌下含服"；"吃饭时" "餐时" "跟饭一起"算随餐，要填；"睡前" "睡前服"是吃法，要填；"早上吃" "晚上吃" "早晨服用" "晨服" "qn" 这类只说时段的不是吃法，留空；没写就留空\n' +
    '- evidence：每个非空字段对应的原文片段，必须一字不差地从原话里复制，如 {"name":"降脂药","dose":"每次一片","times":["晚上九点"],"method":"睡前用温水送服"}\n\n' +
    '只输出 JSON：{"name":"","dose":"","times":[],"method":"","evidence":{}}\n\n原话：' + text;
}
async function llmParse(text) {
  const r = await fetch(AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: rxPrompt(text) }) });
  if (!r.ok) throw new Error('http_' + r.status);
  const j = await r.json();
  return j.result || {};
}
// 规则层核对：每一项都要能在原话里找到依据，数字也要对得上
function groundCheck(text, raw) {
  const norm = s => String(s ?? '').replace(/[\s，,。；;：:]/g, '').toLowerCase();
  const src = norm(text), ev = raw && typeof raw.evidence === 'object' && raw.evidence || {};
  const inText = s => !!norm(s) && src.includes(norm(s));
  const nums = s => {
    const out = new Set(), t = String(s ?? '');
    for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) out.add(+m[0]);
    for (const m of t.matchAll(/[一二两三四五六七八九十〇零]+/g)) { const v = cnNum(m[0]); if (!isNaN(v)) out.add(v); }
    if (/半/.test(t)) out.add(0.5);
    return out;
  };
  const out = { name: '', dose: '', times: [], method: '' }, dropped = [];
  const str = v => typeof v === 'string' ? v.trim() : '';
  const name = str(raw && raw.name), dose = str(raw && raw.dose), method = str(raw && raw.method);
  if (name) { if (inText(ev.name) && norm(ev.name).includes(norm(name).slice(0, 2))) out.name = name; else dropped.push('药名'); }
  if (dose) {
    // the model may write the dose as "1片" or "一片" — read the number either way, then it must match the quoted text
    const said = nums(ev.dose), mine = [...nums(dose)];
    // a range ("1~2片""一到两粒") is not a single dose — leave it for the family to decide
    const range = /\d\s*[~～\-－至到或]\s*\d|[一二两三四五六七八九十]\s*[到至或]\s*[一二两三四五六七八九十]/.test(dose + ' ' + (ev.dose || ''));
    if (inText(ev.dose) && mine.length && mine.every(v => said.has(v)) && !range) out.dose = dose; else dropped.push('每次吃多少');
  }
  const times = Array.isArray(raw && raw.times) ? raw.times.filter(t => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t)) : [];
  if (times.length) {
    const evT = [].concat(ev.times || []).filter(inText).join(' ');
    // a clock time needs an hour actually said ("九点" "21:00"), not one made up from "一日三次" or "早晚"
    const said = nums(evT), hasClock = /点|:|：/.test(evT);
    const ok = times.filter(t => { const h = +t.split(':')[0]; return hasClock && (said.has(h) || said.has(h - 12) || (h === 0 && said.has(12))); });
    out.times = [...new Set(ok.map(t => t.padStart(5, '0')))].sort();
    if (ok.length < times.length) dropped.push('具体几点');
  }
  // "早上吃""早晨服用""晨服"只是时段，不是吃法
  const timeOnly = s => norm(s).replace(/每天|每日|每晚|每早|早上|早晨|晨|上午|中午|下午|晚上|晚间|夜里|夜间|服用|吃|服|用/g, '') === '';
  if (method) { if (inText(ev.method) && !timeOnly(method)) out.method = method; else dropped.push('怎么吃'); }
  return { ...out, dropped };
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
    { text: '妈妈的手机<b>一次只讲一种药</b>：打开药盒第几格、药盒和药片长什么样、吃几片、怎么吃，全部读出来；点【下一种】能看第二种。遇到问题可以按橙色的【我需要帮忙】。假设妈妈吃完了，点绿色的【我吃好了】。', target: '[data-act=done]', wait: 'doneClick' },
    { text: '手机会语音问妈妈“您都吃好了吗？”，防止误按。点绿色的【都吃好了】。', target: '[data-act=yes]', wait: 'confirmed' },
    { text: '看右边！你的手机<b>马上收到通知</b>，几点吃的、吃了什么都写清楚了，不用再打电话问。首页还提示<b>降糖药还剩 7 天</b>：每次确认吃药都按用量扣减，快吃完时提醒你买药。点底部的【这一周】，看看按最近 7 天记录统计出的规律和建议。', target: '[data-tab=week]', wait: 'tab:week' },
    { text: '🎉 完成！统计发现妈妈<b>周末早上</b>经常要提醒两次，建议把周末的提醒改到 9 点。接着试试「② 妈妈忘了吃药」。', end: true }
  ] },
  forgot: { title: '② 妈妈忘了吃药', steps: [
    { text: '现在是早上 7:58。点【快进到 08:00】。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '8 点手机响了，但这次假设<b>妈妈没听到</b>，没有接。点【快进到 08:15】。', ff: '08:15', target: '#g-ff', wait: 'remind' },
    { text: '8:15，妈妈的手机<b>第 2 次响铃</b>。假设还是没接，点【快进到 08:30】。', ff: '08:30', target: '#g-ff', wait: 'escalate' },
    { text: '过了约定的 30 分钟还没确认，<b>你的手机收到提醒</b>。可以发短信，也可以打电话。这次点蓝色的【给妈妈打电话】。', target: '[data-act=call]', wait: 'call' },
    { text: '电话通了。假设妈妈说<b>“哎呀还没吃，我在买菜”</b>。点【妈妈还没吃】，15 分钟后妈妈的手机会再响铃。', target: '[data-act=calllater]', wait: 'later' },
    { text: '设好了。点【快进到 08:45】，看看会不会再提醒妈妈。', ff: '08:45', target: '#g-ff', wait: 'follow' },
    { text: '8:45 妈妈的手机又响了，写着“女儿让我再提醒您”。这次妈妈接了，点【接听】。', target: '[data-act=answer]', wait: 'answer' },
    { text: '点【我吃好了】。', target: '[data-act=done]', wait: 'doneClick' },
    { text: '点【都吃好了】。', target: '[data-act=yes]', wait: 'confirmed' },
    { text: '🎉 完成！你的手机收到“妈妈已经吃药了”。只有真的没确认时你才需要介入，而且一个电话就能安排好后续提醒。', end: true }
  ] },
  unsure: { title: '③ 妈妈记不清吃没吃', steps: [
    { text: '现在是早上 7:58。点【快进到 08:00】。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '妈妈的手机响了，点绿色的【接听】。', target: '[data-act=answer]', wait: 'answer' },
    { text: '这次假设妈妈<b>记不清刚才有没有吃过</b>。点橙色的【我需要帮忙】。', target: '[data-act=help]', wait: 'helpClick' },
    { text: '手机会<b>按序号读出</b>四个选项，妈妈看不清字也能按。点【3 记不清吃没吃】。', target: '[data-reason="记不清吃没吃"]', wait: 'help' },
    { text: '妈妈的手机用大字和语音提醒她<b>先不要再吃</b>：重复吃药有风险，比如降糖药。你的手机<b>立刻收到求助</b>，并提示先看药盒格子。点【给妈妈打电话】。', target: '[data-act=call]', wait: 'call' },
    { text: '电话里请妈妈看看药盒第 1、2 格：药已经不在了，说明刚才吃过。点【妈妈已经吃了】。', target: '[data-act=callok]', wait: 'callResult' },
    { text: '🎉 完成！记不清时不催着补吃，而是先停下、一起核对，避免重复吃药。', end: true }
  ] },
  later: { title: '④ 现在不方便吃', steps: [
    { text: '现在是早上 7:58。点【快进到 08:00】。', ff: '08:00', target: '#g-ff', wait: 'ring' },
    { text: '降糖药要<b>和饭一起吃</b>，可妈妈的饭还没做好。点【现在不方便吃？】。', target: '[data-act=snoozeOpen]', wait: 'snoozeOpen' },
    { text: '妈妈可以选“还没开饭”，或者“我不在家”并选多久后再提醒。点【还没开饭】。', target: '[data-act=snooze][data-min="20"]', wait: 'snooze' },
    { text: '看右边：你的首页显示<b>“待会再吃 · 08:20”</b>，不算没确认，也不会打扰你。点【快进到 08:20】。', ff: '08:20', target: '#g-ff', wait: 'snoozeRing' },
    { text: '到了妈妈说的时间，手机再次响铃。点【接听】。', target: '[data-act=answer]', wait: 'answer' },
    { text: '假设妈妈看完指引去吃饭了，<b>忘了按“我吃好了”</b>。点【快进到 08:30】。', ff: '08:30', target: '#g-ff', wait: 'ask' },
    { text: '看完指引 10 分钟还没确认，手机<b>主动问一句</b>“吃好了吗”，说一声或按按钮都行。点绿色的【吃好了】。', target: '[data-act=askyes]', wait: 'confirmed' },
    { text: '🎉 完成！延后吃药不算没确认；忘了按确认时，手机会追问一句，减少误报。', end: true }
  ] },
  free: { title: '自由体验（录入新药等）', steps: [] }
};

function start(key) {
  hush(); clearTimeout(bannerTimer); fresh(); S.sc = key; S.step = 0;
  render();
}
function emit(ev) { const st = SC[S.sc]?.steps[S.step]; if (st && st.wait === ev) S.step++; }

// ---------- 渲染（与 Figma 高保真原型 v3 保持一致）----------
const IC = {
  back: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chev: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  phone: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
  msg: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>',
  mic: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v4"/></svg>',
  alert: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 7v6"/><path d="M12 16.5v.5"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  pill: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="m8.5 8.5 7 7"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 21h18"/><path d="M7 17V11"/><path d="M12 17V5"/><path d="M17 17v-8"/></svg>',
  camera: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  house: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v11h14V9"/></svg>'
};
function art(m, k = 1) {
  if (m.photo) return `<img class="photo" src="${esc(m.photo)}" style="max-width:${130 * k}px;max-height:${100 * k}px" alt="${esc(short(m.name))}实物照片">`;
  const box = BOX[m.box][1], pill = PILL[m.pill][1]; let p;
  if (m.shape === 'round') p = `<circle cx="98" cy="45" r="14" fill="${pill}" stroke="#334155" stroke-width="2"/><line x1="98" y1="33" x2="98" y2="57" stroke="#94a3b8" stroke-width="2"/>`;
  else if (m.shape === 'oval') p = `<ellipse cx="98" cy="45" rx="19" ry="11" fill="${pill}" stroke="#334155" stroke-width="2"/>`;
  else p = `<g transform="rotate(-25 98 45)"><rect x="78" y="37" width="40" height="16" rx="8" fill="${pill}" stroke="#334155" stroke-width="2"/><rect x="78" y="37" width="20" height="16" rx="8" fill="${box}" stroke="#334155" stroke-width="2"/></g>`;
  return `<svg class="art" viewBox="0 0 125 80" width="${125 * k}" height="${80 * k}" role="img" aria-label="${esc(look(m))}"><rect x="6" y="8" width="62" height="64" rx="6" fill="${box}"/><rect x="12" y="26" width="50" height="22" rx="3" fill="#fff"/><text x="37" y="41" font-size="10" text-anchor="middle" fill="#111">${esc(short(m.name).slice(0, 4))}</text>${p}</svg>`;
}
// 妈妈的药盒：深色盒身，要打开的格子高亮
function pillbox(lit, tag, tagCls = 'warn') {
  const n = Math.min(6, Math.max(4, ...S.meds.map(m => +m.slot || 1)));
  return `<div class="box"><div class="box-h"><span>妈妈的药盒</span>${tag ? `<span class="box-tag ${tagCls}">${esc(tag)}</span>` : ''}</div>
    <div class="box-cells" style="grid-template-columns:repeat(${n},1fr)">${Array.from({ length: n }, (_, i) => i + 1).map(i => `<div class="cell ${lit.includes(i) ? 'lit' : ''}"><b>${i}</b><small>${lit.includes(i) ? '这格' : '格'}</small></div>`).join('')}</div></div>`;
}
const slotList = d => medsOf(d).map(m => m.slot).sort((a, b) => a - b);
const sbar = cls => `<div class="sbar ${cls || ''}"><span>${fmt(S.min)}</span><span class="sig">▂▄▆ ▭</span></div>`;
const navbar = (title, opt = {}) => `<div class="nav">${opt.back ? `<button class="nav-back" data-act="${opt.back}">${IC.back}返回</button>` : ''}<b>${esc(title)}</b>${opt.right || ''}</div>`;
const firstSentence = t => { const s = (String(t || '').match(/[^。！？]+[。！？]?/) || [''])[0]; return s.length > 26 ? s.slice(0, 26) + '……' : s; };
const voiceBox = t => `<button class="voice" data-act="replay">${IC.speaker}<span>正在朗读：“${esc(firstSentence(t))}”</span></button>`;
const btn = (label, act, cls, extra = '') => `<button class="btn ${cls}" data-act="${act}" ${extra}>${label}</button>`;

function parentHTML() {
  const d = dose(S.active);
  if (S.call) return sbar('dark') + `<div class="incall"><div class="avatar">女</div><div class="who">女儿</div><div class="cst">${S.call.stage === 'calling' ? '来电中…' : '通话中'}</div></div>`;
  switch (S.parent) {
    case 'ring': {
      const sl = slotList(d), tag = S.ringType === 'repeat' ? '第 2 次提醒' : S.ringType === 'follow' ? '女儿让我再提醒您' : S.ringType === 'snooze' ? '到了您说的时间' : `${period(d.time)} ${d.time} · 吃药时间`;
      return sbar('blue') + `<div class="p ring"><div class="ring-top"><span class="ring-tag">${esc(tag)}</span><h1>该吃药了</h1><p>${period(d.time)}有 ${d.medIds.length} 种药，在药盒第 ${sl.join('、')} 格</p></div>
        <div class="ring-sheet">${pillbox(sl, `打开第 ${sl.join('、')} 格`)}${voiceBox('该吃药了，请按绿色的接听键')}
        <div class="answer"><button class="answer-btn" data-act="answer" aria-label="接听">${IC.phone}</button><b>接听</b><button class="link" data-act="snoozeOpen">现在不方便吃？${IC.chev}</button></div>
        ${btn('我需要帮忙', 'help', 'orange-line')}</div></div>`;
    }
    case 'guide': {
      const ms = medsOf(d), i = Math.min(S.medIdx, ms.length - 1), m = ms[i], seq = ms.length > 1, lbl = mealStep(m).label;
      const next = ms[i + 1];
      return sbar() + navbar('吃药指引', { right: `<button class="chip" data-act="replay">${IC.speaker}再听一遍</button>` }) + `<div class="p body">
        ${seq ? `<div class="prog-t">第 ${i + 1} 种，共 ${ms.length} 种</div><div class="prog">${ms.map((_, k) => `<span class="${k <= i ? 'on' : ''}"></span>`).join('')}</div>` : ''}
        <div class="card med"><span class="tag green">${esc(lbl ? lbl + '吃' : '按时吃')}</span>
          <div class="med-top"><div class="med-art">${art(m, .7)}</div><div><b>${esc(BOX[m.box][0])}盒子</b><small>${esc(PILL[m.pill][0] + SHAPE[m.shape])}${m.shape === 'capsule' ? '' : '药片'}</small></div></div>
          <div class="kv"><span>药名</span><b>${esc(short(m.name))}</b></div>
          <div class="kv"><span>在哪</span><b>药盒第 ${m.slot} 格（贴着 ${m.slot} 号）</b></div>
          <div class="kv"><span>吃几片</span><b>${esc(m.dose)}</b></div>
          <div class="kv"><span>怎么吃</span><b>${esc(m.method)}</b></div></div>
        ${next ? `<div class="card nextmed"><span class="num gray">${i + 2}</span><div><b>${esc(mealStep(next).label ? mealStep(next).label + '吃 · ' : '')}第 ${next.slot} 格</b><small>${esc(next.dose)} · ${esc(short(next.name))}</small></div><button class="mini" data-act="nextmed">下一种</button></div>` : (seq ? `<button class="link center" data-act="prevmed">← 回到第一种</button>` : '')}
        </div><div class="p-foot">${btn(IC.check + '我吃好了', 'done', 'green')}<button class="link center" data-act="done">${IC.mic}也可以直接说“吃好了”</button>${btn('我需要帮忙', 'help', 'orange-line')}</div>`;
    }
    case 'confirm': return sbar() + navbar('确认一下') + `<div class="p body center"><div class="okcircle">${IC.check}</div><h2>您都吃好了吗？</h2>
        <div class="card list">${medsOf(d).map(m => `<div class="row"><span class="rt">第 ${m.slot} 格 · ${esc(short(m.name))} · ${esc(m.dose)}</span><i class="ok">${IC.check}</i></div>`).join('')}</div>${voiceBox(VOICE.confirm)}</div>
        <div class="p-foot">${btn(IC.check + '都吃好了', 'yes', 'green')}${btn('还没有，回去看看', 'no', 'white')}</div>`;
    case 'ask': {
      const sl = slotList(d);
      return sbar() + navbar('确认一下') + `<div class="p body">${pillbox(sl, `${period(d.time)} ${+d.time.slice(0, 2)} 点的药`, 'ok')}<h2 class="ask-h">${period(d.time)} ${+d.time.slice(0, 2)} 点的药，<br>吃好了吗？</h2>
        <div class="listen"><span class="mic">${IC.mic}</span><b>正在听：直接说“吃好了”就行</b></div>
        <div class="card soft center"><b>不想说话也没关系</b><small>按下面的绿色按钮，一样能告诉女儿</small></div></div>
        <div class="p-foot">${btn(IC.check + '吃好了', 'askyes', 'green')}${btn('还没吃', 'askno', 'white')}</div>`;
    }
    case 'later': {
      const back = h => fmt(S.min + h);
      return sbar() + navbar('待会再吃', { back: 'laterBack' }) + `<div class="p body"><h2>什么时候再提醒您？</h2>
        <div class="card list">
          <button class="row big" data-act="snooze" data-min="20" data-why="还没开饭"><span class="num green">饭</span><div><b>还没开饭</b><small>开饭了再提醒我 · 20 分钟后</small></div>${IC.chev}</button>
          <div class="row big col"><div class="row-h"><span class="num blue">${IC.house}</span><div><b>我不在家</b><small>回去再吃，多久后提醒？</small></div></div>
            <div class="seg">${[[30, '30 分钟'], [60, '1 小时'], [120, '2 小时']].map(([v, l]) => `<button data-act="snooze" data-min="${v}" data-why="不在家">${l}</button>`).join('')}</div></div>
        </div>
        <div class="card soft"><small>女儿那边只会看到：</small><b>“妈妈说不在家，${back(60)} 再提醒”</b><small>不会说您没吃药。</small></div>${voiceBox(VOICE.later)}</div>
        <div class="p-foot">${btn('现在就吃', 'eatnow', 'green')}</div>`;
    }
    case 'sms': return sbar() + navbar('女儿发来消息') + `<div class="p body"><div class="bubble">${esc(S.psms.text)}</div>${voiceBox('女儿给您发来消息')}</div><div class="p-foot">${btn('好的，去吃药', 'gotake', 'green')}</div>`;
    case 'help': return sbar() + navbar('我需要帮忙', { back: 'back' }) + `<div class="p body"><h2>需要什么帮助？</h2><p class="sub">按号码，或者直接说出来</p>
        <div class="card list">${REASONS.map((r, i) => `<button class="row big" data-reason="${r}"><span class="num orange">${i + 1}</span><b>${r}</b>${IC.chev}</button>`).join('')}</div>${voiceBox('第 1，找不到药；第 2，不知道怎么吃……')}</div>
        <div class="p-foot">${btn('返回', 'back', 'white')}</div>`;
    case 'helpSent': {
      const unsure = d.reason === UNSURE, sl = slotList(d);
      return sbar() + navbar('我需要帮忙') + `<div class="p body">
        <div class="card warmbig"><span class="warn-ic">${IC.alert}</span><h2>${unsure ? '先不要再吃这一次的药' : '已经告诉女儿了'}</h2><p>${unsure ? '已经告诉女儿，她马上给您打电话。' : '她马上给您打电话，请稍等。'}</p></div>
        ${unsure ? `<div class="card"><p class="mb">等电话的时候，看看第 ${sl.join('、')} 格里的药还在不在。</p>${pillbox(sl, `打开第 ${sl.join('、')} 格`)}</div>` : ''}${voiceBox(S.lastSpeech)}</div>
        <div class="p-foot">${btn('好的，我等电话', 'home', 'blue')}</div>`;
    }
    case 'done': {
      const nx = S.doses.find(x => x.status === 'pending' && !x.skip && toMin(x.time) > S.min);
      return sbar() + navbar('吃好了') + `<div class="p body center"><div class="okcircle">${IC.check}</div><h2>吃好了！</h2><p class="lead">${d?.by === 'call' ? '女儿已经帮您记录好了' : '已经告诉女儿了'}</p>${nx ? `<div class="card soft center"><small>下一次吃药</small><b class="big">${period(nx.time)} ${nx.time}</b></div>` : '<div class="card soft center"><b>今天的药都吃完了</b></div>'}${voiceBox(S.lastSpeech)}</div>
        <div class="p-foot">${btn('返回', 'home', 'white')}</div>`;
    }
    default: {
      const nx = S.doses.find(x => x.status === 'pending' && !x.skip && (x.base ?? toMin(x.time)) > S.min);
      return sbar() + navbar('安心药箱') + `<div class="p body"><div class="bigclock">${fmt(S.min)}</div><div class="date">10月9日 星期五</div>
        ${nx ? `<div class="card soft center"><small>下一次吃药</small><b class="big">${nx.snooze ? fmt(nx.base) : `${period(nx.time)} ${nx.time}`}</b><small>${medsOf(nx).map(m => esc(short(m.name))).join('、')}</small></div>` : '<div class="card soft center"><b>今天的药都吃完了</b></div>'}
        <div class="card list">${S.doses.map(x => `<div class="row"><span class="rt">${period(x.time)} ${x.time}</span>${x.status === 'done' ? '<span class="tag green">已吃</span>' : x.status === 'help' ? '<span class="tag orange">已求助</span>' : x.snooze ? '<span class="tag blue">待会再吃</span>' : '<span class="tag gray">待提醒</span>'}</div>`).join('')}</div>
        <p class="hint">到点时手机会像来电一样响，告诉您吃什么</p></div>`;
    }
  }
}

// 每一顿在子女端的状态标签
function doseTag(d) {
  if (d.status === 'done') return `<span class="tag green">${IC.check}${d.by === 'call' ? '电话确认' : '自己确认'} ${fmt(d.at)}</span>`;
  if (d.status === 'help') return '<span class="tag orange">求助中</span>';
  if (d.skip) return '<span class="tag gray">今天已过</span>';
  if (d.snooze && !d.rang) return `<span class="tag blue">待会再吃 · ${fmt(d.base)}</span>`;
  if (d.follow != null) return `<span class="tag blue">${fmt(d.follow)} 再提醒</span>`;
  if (d.escalated) return '<span class="tag orange">还没确认</span>';
  if (d.rang) return '<span class="tag gray">已提醒</span>';
  return '<span class="tag gray">待提醒</span>';
}
function statusText(d) {
  if (d.status === 'done') return `✅ 已吃 · ${d.by === 'call' ? '电话确认' : '妈妈自己确认'} ${fmt(d.at)}`;
  if (d.status === 'help') return `🙋 需要帮忙：${esc(d.reason)}`;
  if (d.skip) return '今天已过，明天开始';
  if (d.snooze && !d.rang) return `妈妈说待会再吃 · ${fmt(d.base)} 再提醒`;
  if (d.follow != null) return `⏰ ${fmt(d.follow)} 会再提醒妈妈`;
  if (d.escalated) return '⚠️ 超时没确认';
  if (d.rang) return '⏳ 已提醒，等妈妈确认';
  return '还没到时间';
}
const open = d => d && !d.skip && (d.status === 'help' || (d.status === 'pending' && d.escalated));
const contactBtns = d => `<div class="two">${btn(IC.phone + '给妈妈打电话', 'call', 'blue', `data-dose="${d.id}"`)}${btn(IC.msg + '发短信', 'sms', 'light', `data-dose="${d.id}"`)}</div>`;
const restockForm = m => S.restock === m.id
  ? `<div class="two restock"><input id="restockN" type="number" min="1" max="999" placeholder="买了多少${unit(m)}"><button class="btn blue sm" data-act="restockSave" data-med="${m.id}">补上</button></div>`
  : `<button class="btn light sm" data-act="restock" data-med="${m.id}">已经买了药，补上药量</button>`;

const MARKS = { ok: ['√', 'ok'], late: ['2', 'late'], call: ['☎', 'call'], help: ['○', 'help'], miss: ['!', 'miss'], wait: ['·', 'wait'] };
function weekHTML() {
  const rows = [['早上', '08:00', 'am'], ['晚上', '20:00', 'pm']];
  const days = [...WEEK, { d: '10/9', w: '五', today: true }];
  const marks = days.flatMap(x => rows.map(([, t, k]) => x.today ? todayMark(dose(t)) : x[k])).filter(v => v !== 'wait');
  return `<div class="wk-h"><div><b>10 月 3 日 – 9 日</b><small>示例记录 · 本人确认 ${marks.filter(v => v === 'ok' || v === 'late').length}/${marks.length}</small></div><span class="tag gray">规则统计，不是大模型</span></div>
    <div class="card week"><table><tr><th></th>${days.map(x => `<th class="${x.today ? 'today' : ''}">${x.w}</th>`).join('')}</tr>${rows.map(([n, t, k]) => `<tr><td>${n}</td>${days.map(x => { const v = x.today ? todayMark(dose(t)) : x[k]; return `<td><span class="wc ${MARKS[v][1]}" title="${MARK[v][1]}">${MARKS[v][0]}</span></td>`; }).join('')}</tr>`).join('')}</table></div>
    <div class="legend"><span class="tag green">√ 自己确认</span><span class="tag orange">2 第 2 次提醒后确认</span><span class="tag blue">☎ 电话确认</span><span class="tag gray">○ 求助</span></div>`;
}
function findings() {
  const ws = weekStats(), out = [];
  const s = ws.am;
  if (s.weekendPattern) out.push(`<div class="card find"><b class="find-h">💡 发现</b><p>周末早上 ${s.weLate}/${s.we} 天要第 2 次提醒才确认，工作日 ${s.wdLate}/${s.wd} 天。</p>${S.weekend ? '<span class="tag green">已改好，从明天（周六）开始 9:00 提醒</span>' : S.weekendSkip ? '<span class="tag gray">先不改，下周再看</span>' : `<b>要把周末早上的提醒改到 9:00 吗？</b><div class="two">${btn('改到 9:00', 'weekend', 'blue')}${btn('先不改', 'weekendNo', 'white')}</div>`}</div>`);
  const unsure = [['am', '早上'], ['pm', '晚上']].filter(([k]) => ws[k].help.some(h => h.why === UNSURE)).map(([, l]) => l);
  if (unsure.length) out.push(`<div class="card find"><b class="find-h">💡 发现</b><p>${unsure.join('和')}的药出现过“记不清吃没吃”。提醒妈妈吃完立刻确认；记不清时先别补吃，先看药盒格子里的药还在不在。</p></div>`);
  if (!out.length) out.push('<div class="card find"><b class="find-h">💡 发现</b><p>这一周没有看出需要调整的规律，保持现在的提醒时间。</p></div>');
  return out.join('');
}

function childView() {
  const v = S.view;
  if (v && v.startsWith('alert:')) {
    const d = dose(v.slice(6)); if (!d) return null;
    const t0 = d.base ?? toMin(d.time);
    return navbar('提醒详情', { back: 'cback' }) + `<div class="c-body">
      <div class="card warm"><span class="warn-ic">${IC.alert}</span><div><b>${fmt(t0 + S.waitMin)} 妈妈还没确认${period(d.time)}的药</b><p>提醒已经响了 2 次。还没确认不等于没吃，先打个电话问问。</p></div></div>
      <h3>发生了什么</h3><div class="card"><div class="tl">
        <div><i></i><b>${fmt(t0)}</b><span>第 1 次响铃，没有接</span></div>
        <div><i></i><b>${fmt(t0 + S.repeatMin)}</b><span>第 2 次响铃，没有接</span></div>
        <div class="hot"><i></i><b>${fmt(t0 + S.waitMin)}</b><span>到了家里约定的 ${S.waitMin} 分钟，通知你</span></div></div></div>
      ${d.status === 'pending' ? contactBtns(d) : ''}
      <h3>打完电话后</h3><div class="card list">
        <button class="row big" data-act="calllater" data-dose="${d.id}"><div><b>妈妈还没吃</b><small>15 分钟后妈妈手机再响铃，仍未确认会再通知你</small></div>${IC.chev}</button>
        <button class="row big" data-act="callok" data-dose="${d.id}"><div><b>妈妈说吃过了</b><small>记为“电话确认”，和“自己确认”分开显示</small></div>${IC.chev}</button></div></div>`;
  }
  if (v && v.startsWith('help:')) {
    const d = dose(v.slice(5)); if (!d) return null;
    const unsure = d.reason === UNSURE, sl = slotList(d);
    return navbar('妈妈求助', { back: 'cback' }) + `<div class="c-body">
      <div class="card warm"><span class="warn-ic">${IC.alert}</span><div><b>${fmt(d.helpAt ?? S.min)} 妈妈按了“我需要帮忙”</b><p class="o">她选了：${REASONS.indexOf(d.reason) + 1} ${esc(d.reason)}</p></div></div>
      ${unsure ? `<div class="card"><small>妈妈的手机上正在显示</small><div class="warnrow">${IC.alert}<b>先不要再吃这一次的药，等女儿打电话</b></div></div>
      <h3>建议这样做</h3><div class="card"><ol class="steps"><li>先请妈妈看看药盒第 ${sl.join('、')} 格，药还在不在</li><li>药还在，再决定要不要补吃；拿不准就先别吃</li><li>需要时问医生或药师</li></ol></div>` : `<h3>建议这样做</h3><div class="card"><ol class="steps"><li>现在给妈妈打个电话，问清楚是哪一步卡住了</li></ol></div>`}
      ${d.answeredAt != null ? `<div class="card soft"><b class="bl">参考：${d.time} 的提醒妈妈 ${fmt(d.answeredAt)} 接听了</b><small>接听不代表吃了，只供电话里核对用。</small></div>` : ''}
      ${d.status === 'help' ? btn(IC.phone + '给妈妈打电话', 'call', 'blue', `data-dose="${d.id}"`) : ''}
      ${d.status === 'help' ? `<h3>打完电话后</h3><div class="card list"><button class="row big" data-act="callok" data-dose="${d.id}"><div><b>妈妈已经吃了</b><small>记为“电话确认”</small></div>${IC.chev}</button></div>` : ''}</div>`;
  }
  if (v === 'settings') {
    const seg = (act, cur, opts) => `<div class="seg sm">${opts.map(([val, l]) => `<button class="${cur === val ? 'on' : ''}" data-act="${act}" data-v="${val}">${l}</button>`).join('')}</div>`;
    return navbar('提醒设置', { back: 'cback' }) + `<div class="c-body"><h3>没确认时</h3><div class="card list">
      <div class="row"><div><b>再响一次铃</b><small>没接听时</small></div><span class="muted">${S.repeatMin} 分钟后</span></div>
      <div class="row"><div><b>通知家人</b><small>仍没确认时</small></div>${seg('setwait', S.waitMin, [[30, '30 分钟'], [60, '60 分钟']])}</div></div>
      <h3>补药</h3><div class="card list"><div class="row"><div><b>药快吃完时提醒我</b><small>按每次用量推算还够几天</small></div>${seg('setrefill', S.refillDays, [[3, '3 天'], [5, '5 天'], [7, '7 天'], [10, '10 天']])}</div></div>
      <p class="muted">等待时间是家里约定的沟通时间，不是医学上的安全时间。</p></div>`;
  }
  if (v === 'add' && S.draft) {
    const f = S.draft;
    return navbar('添加药品', { back: 'cancel' }) + `<div class="c-body">
      <div class="card"><div class="add-h"><div><b>说出或粘贴用法</b><small>医生写的用法、药盒说明都可以</small></div><div class="ibtns"><label class="ibtn ghost" aria-label="拍药盒照片">${IC.camera}<input type="file" accept="image/*" capture="environment" data-photo hidden></label><button class="ibtn ${S.listening ? 'on' : ''}" data-act="voice" aria-label="语音说">${IC.mic}</button></div></div>
        <textarea data-f="text" rows="3" placeholder="例如：这是降脂药，每次一片，晚上九点吃，睡前用温水送服">${esc(f.text)}</textarea>
        ${btn('✨ AI 帮我整理', 'ai', 'blue')}</div>
      ${f.aiNote ? `<div class="ainote">✦ AI 整理的草稿 · ${esc(f.aiNote)}</div>` : '<p class="muted">✦ AI 只整理原话里说到的内容，没提到的不猜，留给你补。</p>'}
      <div class="card list form">
        <label class="row"><span>药名</span><input data-f="name" value="${esc(f.name)}" placeholder="必填"></label>
        <label class="row"><span>每次</span><input data-f="dose" value="${esc(f.dose)}" placeholder="例如 1片"></label>
        <label class="row"><span>时间</span><input data-f="times" value="${esc(f.times)}" placeholder="08:00, 20:00"></label>
        <label class="row"><span>吃法</span><input data-f="method" value="${esc(f.method)}" placeholder="例如 饭后，温水送服"></label>
        <label class="row"><span>放在</span><select data-f="slot">${[1, 2, 3, 4, 5, 6].map(i => `<option value="${i}" ${+f.slot === i ? 'selected' : ''}>第 ${i} 格</option>`).join('')}</select></label>
        <label class="row"><span>还剩</span><input data-f="stock" type="number" min="0" value="${esc(f.stock)}" placeholder="选填，快吃完时提醒你"></label></div>
      <div class="two"><label class="dash">${IC.camera}<span>${f.photo ? '换一张照片' : '拍药盒照片'}</span><input type="file" accept="image/*" capture="environment" data-photo hidden></label>
        <div class="dash shape"><span>颜色和形状</span><div class="sel3"><select data-f="box">${Object.entries(BOX).map(([k, x]) => `<option value="${k}" ${f.box === k ? 'selected' : ''}>${x[0]}盒</option>`).join('')}</select><select data-f="pill">${Object.entries(PILL).map(([k, x]) => `<option value="${k}" ${f.pill === k ? 'selected' : ''}>${x[0]}</option>`).join('')}</select><select data-f="shape">${Object.entries(SHAPE).map(([k, x]) => `<option value="${k}" ${f.shape === k ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div></div>
      <div class="preview">妈妈会看到：${art({ ...f, name: f.name || '药名' }, .8)}</div>
      ${f.err ? `<div class="err">${esc(f.err)}</div>` : ''}
      ${btn('核对无误，保存', 'save', 'blue')}</div>`;
  }
  return null;
}

function childHTML() {
  if (S.call) {
    const talking = S.call.stage === 'talking';
    return sbar('dark') + `<div class="incall"><div class="avatar">妈</div><div class="who">妈妈</div><div class="cst">${talking ? '通话中' : '正在呼叫…'}</div>
      ${talking ? `<div class="callrec"><small>问完以后，记录一下结果：</small><button class="row big" data-act="callok"><div><b>妈妈已经吃了</b><small>记为“电话确认”</small></div>${IC.chev}</button><button class="row big" data-act="calllater"><div><b>妈妈还没吃</b><small>15 分钟后再响铃提醒妈妈</small></div>${IC.chev}</button></div>` : ''}</div>`;
  }
  const b = S.banner ? `<div class="banner ${S.banner.type}" data-act="${S.banner.dose && open(dose(S.banner.dose)) ? 'detail' : 'cback'}" data-dose="${S.banner.dose || ''}"><div class="b-app">安心药箱 · 现在</div><b>${esc(S.banner.title)}</b><div>${esc(S.banner.text)}</div></div>` : '';
  const sub = childView();
  if (sub) return sbar() + b + sub;
  let body = '';
  if (S.tab === 'home') {
    const done = S.doses.filter(d => d.status === 'done'), help = S.doses.filter(d => d.status === 'help');
    const waiting = S.doses.filter(d => d.status === 'pending' && !d.skip).length, total = S.doses.filter(d => !d.skip).length || S.doses.length;
    const last = done.slice().sort((a, b) => b.at - a.at)[0];
    const pct = total ? done.length / total : 0;
    body = navbar('安心药箱', { right: `<button class="nav-r" data-act="settings" aria-label="提醒设置">${IC.gear}</button>` }) + `<div class="c-body">
      <div class="card sum"><div class="sum-top"><span class="ava">妈</span><div><b>妈妈今天</b><small>10 月 9 日 周五 · 妈妈手机在线</small></div>
        <svg class="ringp" viewBox="0 0 44 44"><circle cx="22" cy="22" r="18" fill="none" stroke="#E7ECF8" stroke-width="5"/><circle cx="22" cy="22" r="18" fill="none" stroke="#0052D9" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(pct * 113).toFixed(1)} 113" transform="rotate(-90 22 22)"/><text x="22" y="26" text-anchor="middle" font-size="11" font-weight="700" fill="#1A1A1A">${done.length}/${total}</text></svg></div>
        <div class="sum-n"><div><b class="g">${done.length}</b><small>已确认</small></div><div><b>${waiting}</b><small>待提醒</small></div><div><b class="${help.length ? 'o' : ''}">${help.length}</b><small>求助</small></div></div></div>
      ${S.doses.filter(open).map(d => d.status === 'help'
        ? `<div class="card warm"><span class="warn-ic">${IC.alert}</span><div><b>${d.time} 妈妈需要帮忙</b><p>妈妈说“${esc(d.reason)}”${d.reason === UNSURE ? '，已提醒她先别再吃' : ''}</p>${btn(IC.phone + '给妈妈打电话', 'call', 'blue', `data-dose="${d.id}"`)}<button class="link" data-act="detail" data-dose="${d.id}">查看详情${IC.chev}</button></div></div>`
        : `<div class="card warm"><span class="warn-ic">${IC.alert}</span><div><b>${d.time} 的药妈妈还没确认</b><p>提醒了 2 次，${S.waitMin} 分钟没确认${d.follow != null ? `；${fmt(d.follow)} 会再响铃` : ''}</p>${contactBtns(d)}<button class="link" data-act="detail" data-dose="${d.id}">查看详情${IC.chev}</button></div></div>`).join('')}
      ${last ? `<div class="card okcard"><span class="okdot">${IC.check}</span><div><b>妈妈 ${fmt(last.at)} ${last.by === 'call' ? '电话确认' : '自己确认'}吃好了</b><small>${esc(names(last))}</small></div></div>` : ''}
      <div class="sec-h"><b>今日安排</b><small>共 ${S.doses.length} 次</small></div>
      <div class="card list">${S.doses.map(d => `<div class="row dose"><div class="t"><b>${d.time}</b><small>${period(d.time)}</small></div><span class="dm">${esc(medsOf(d).map(m => short(m.name)).join('、'))}</span>${doseTag(d)}</div>`).join('')}</div>
      ${lowStock().map(m => `<button class="card refill" data-tab="meds">${IC.pill}<div><b>${esc(short(m.name))}还剩 ${daysLeft(m)} 天</b><small>还剩 ${m.stock} ${unit(m)} · 记得帮妈妈买药</small></div>${IC.chev}</button>`).join('')}</div>`;
  } else if (S.tab === 'week') {
    body = navbar('这一周') + `<div class="c-body">${weekHTML()}${findings()}<p class="muted">这里是规则统计，不是大模型：从最近 7 天的确认记录（过去 6 天为示例数据）算出规律，再按规则给建议；什么时候提醒、什么时候通知你仍由固定规则决定。</p></div>`;
  } else {
    body = navbar('药品', { right: `<button class="nav-r txt" data-act="add">＋ 添加</button>` }) + `<div class="c-body">
      ${S.note ? `<div class="okbar">${esc(S.note)}</div>` : ''}
      ${S.meds.map(m => { const left = daysLeft(m), low = left != null && left <= S.refillDays;
        return `<div class="card medrow"><div class="mr-art">${art(m, .55)}</div><div class="grow"><b>${esc(short(m.name))} · ${esc(m.dose)}</b><small>${m.times.join('、')} · 第 ${m.slot} 格 · ${esc(m.method)}</small>
          <div class="stock ${low ? 'low' : ''}">${left == null ? (m.stock == null ? '没填药量，不会提醒买药' : '剂量单位不是片/粒，暂不推算') : `剩 ${m.stock} ${unit(m)} · 约够 ${left} 天${low ? ' · 该买药了' : ''}`}</div>${left != null && (low || S.restock === m.id) ? restockForm(m) : left != null ? `<button class="link" data-act="restock" data-med="${m.id}">＋ 补药量</button>` : ''}</div></div>`; }).join('')}
      ${btn('＋ 添加药品', 'add', 'blue')}</div>`;
  }
  const tabs = [['home', IC.home, '今天'], ['meds', IC.pill, '药品'], ['week', IC.chart, '这一周']].map(([k, i, n]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${i}<span>${n}</span></button>`).join('');
  return sbar() + b + body + `<nav class="tabbar">${tabs}</nav>`;
}

function guideHTML() {
  const sc = SC[S.sc], st = sc.steps[S.step];
  const tabs = Object.entries(SC).map(([k, v]) => `<button data-sc="${k}" class="sc ${k === S.sc ? 'on' : ''}">${v.title}</button>`).join('');
  let box;
  if (S.sc === 'free') box = '<p>随意操作两部手机：左边是妈妈的，右边是你的。用下面的按钮让时间往前走。想试试录入新药，点右边手机底部的【药品】→【＋ 添加药品】，可以打字或语音说出用法。</p>';
  else box = `<div class="stepno">第 ${S.step + 1} 步 / 共 ${sc.steps.length} 步</div><p>${st.text}</p>${st.ff ? `<button id="g-ff" data-act="ff" data-to="${st.ff}" class="primary">⏩ 快进到 ${st.ff}</button>` : ''}${st.end ? '<button data-act="restart" class="primary">↺ 再来一遍</button>' : ''}`;
  const free = S.sc === 'free' ? '<button data-act="next">⏩ 快进到下一次提醒</button><button data-act="plus15">+15 分钟</button>' : '';
  return `<div class="sc-row"><span class="pick">选一个情景体验：</span>${tabs}</div><div class="stepbox">${box}</div><div class="timebar"><span>🕗 现在 <b>${fmt(S.min)}</b></span>${free}<button data-act="sound">${sound ? '🔊 声音：开' : '🔇 声音：关'}</button><button data-act="restart">↺ 重新开始</button></div>`;
}

function render() {
  if (!BROWSER) return;
  $('#guide').innerHTML = guideHTML();
  $('#parent').innerHTML = parentHTML();
  const cs = $('#child').querySelector('.c-body')?.scrollTop || 0;
  $('#child').innerHTML = childHTML();
  const cb = $('#child').querySelector('.c-body'); if (cb) cb.scrollTop = cs;
  $('#parentPhone').classList.toggle('ringing', S.parent === 'ring' && !S.call);
  const st = SC[S.sc]?.steps[S.step];
  if (st?.target) { const el = document.querySelector(st.target); if (el) { el.classList.add('pulse'); el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
}
if (!BROWSER) module.exports = { fresh, start, tick, check, confirm, ring, nextEvent, medsOf, instruction, aiParse, groundCheck, rxPrompt, weekStats, askHelp, dose, perDose, daysLeft, restock, WEEK, get S() { return S; } };
else {

// ---------- 交互 ----------
function toGuide(d) { S.parent = 'guide'; S.active = d.id; S.medIdx = 0; if (d.guideAt == null) d.guideAt = S.min; say(instruction(d)); }
const callDose = el => dose(S.call?.dose || el.dataset.dose);
function sayDone() { const nx = S.doses.find(x => x.status === 'pending' && !x.skip && toMin(x.time) > S.min); say(`好的，吃好了，已经告诉女儿了。${nx ? `下一次是${spokenTime(nx.time)}。` : '今天的药都吃完了。'}`); }

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act],[data-tab],[data-sc],[data-reason]'); if (!el) return;
  ac()?.resume?.();
  const d = dose(S.active);
  if (el.dataset.sc) return start(el.dataset.sc);
  if (el.dataset.tab) { S.tab = el.dataset.tab; S.view = null; S.banner = null; S.note = ''; emit('tab:' + S.tab); return render(); }
  if (el.dataset.reason) { askHelp(d, el.dataset.reason); emit('help'); return render(); }
  switch (el.dataset.act) {
    case 'ff': return tick(toMin(el.dataset.to));
    case 'next': { const n = nextEvent(); return n == null ? alert('今天没有待提醒的事了。可以在你手机的【药品】页添加新药。') : tick(n); }
    case 'plus15': return tick(S.min + 15);
    case 'sound': sound = !sound; if (!sound) hush(); break;
    case 'restart': return start(S.sc);
    case 'answer': stopRing(); if (d.answeredAt == null) d.answeredAt = S.min; toGuide(d); emit('answer'); break;
    case 'snoozeOpen': stopRing(); if (d.answeredAt == null) d.answeredAt = S.min; S.parent = 'later'; say(VOICE.later); emit('snoozeOpen'); break;
    case 'laterBack': S.parent = 'ring'; break;
    case 'snooze': {
      const mins = +el.dataset.min, why = el.dataset.why;
      snooze(d, mins, why); S.parent = 'home'; say(`好的，${mins >= 60 ? mins / 60 + '小时' : mins + '分钟'}后再提醒您。`);
      notify({ type: 'sent', dose: d.id, title: '⏰ 妈妈说待会再吃', text: `妈妈说${why}，${fmt(d.base)} 再提醒。这不算没确认。` }, true);
      emit('snooze'); break;
    }
    case 'eatnow': toGuide(d); break;
    case 'replay': speak(S.lastSpeech); break;
    case 'nextmed': S.medIdx++; { const m = medsOf(d)[S.medIdx]; if (m) say(`${stepName(m, S.medIdx)}：打开药盒第${m.slot}格，拿${BOX[m.box][0]}盒子的${short(m.name)}，吃${m.dose}。${m.method}。`); } break;
    case 'prevmed': S.medIdx = 0; break;
    case 'done': S.parent = 'confirm'; say(VOICE.confirm); emit('doneClick'); break;
    case 'no': toGuide(d); break;
    case 'yes': confirm(d, 'self'); S.parent = 'done'; sayDone(); emit('confirmed'); break;
    case 'askyes': confirm(d, 'self'); S.parent = 'done'; sayDone(); emit('confirmed'); break;
    case 'askno': toGuide(d); break;
    case 'help': stopRing(); if (d.answeredAt == null) d.answeredAt = S.min; S.parent = 'help'; say(VOICE.help); emit('helpClick'); break;
    case 'back': toGuide(d); break;
    case 'home': hush(); S.parent = 'home'; break;
    case 'gotake': toGuide(dose(S.psms.dose)); S.psms = null; break;
    case 'weekend': S.weekend = true; break;
    case 'weekendNo': S.weekendSkip = true; break;
    case 'detail': { const x = dose(el.dataset.dose); if (x) { S.view = (x.status === 'help' ? 'help:' : 'alert:') + x.id; S.banner = null; emit('detail'); } break; }
    case 'cback': S.view = null; S.banner = null; break;
    case 'settings': S.view = 'settings'; break;
    case 'setwait': S.waitMin = +el.dataset.v; break;
    case 'setrefill': S.refillDays = +el.dataset.v; break;
    case 'sms': sendSms(dose(el.dataset.dose)); emit('sms'); break;
    case 'call': {
      hush(); S.call = { dose: el.dataset.dose, stage: 'calling' }; S.banner = null; emit('call');
      setTimeout(() => { if (S.call) { S.call.stage = 'talking'; render(); } }, 1300); break;
    }
    case 'callok': { const cd = callDose(el); S.call = null; S.view = null; S.active = cd.id; confirm(cd, 'call'); S.parent = 'done'; S.tab = 'home'; emit('callResult'); break; }
    case 'calllater': {
      const cd = callDose(el); S.call = null; S.view = null; S.parent = 'home'; S.tab = 'home';
      cd.follow = S.min + 15; cd.recheck = null;
      notify({ type: 'sent', dose: cd.id, title: '⏰ 已设好再次提醒', text: `${fmt(cd.follow)} 妈妈的手机会再响铃提醒；如果之后 15 分钟还没确认，会再通知你。` }, true);
      emit('later'); break;
    }
    case 'add':
      S.note = ''; S.view = 'add'; S.draft = { text: '', name: '', dose: '', times: '', method: '', stock: '', slot: '3', box: 'green', pill: 'white', shape: 'capsule', photo: '' };
      emit('add'); break;
    case 'voice': if (!S.listening) voiceInput(); return;
    case 'ai': {
      const f = S.draft, text = f.text.trim();
      if (!text) { f.aiNote = '请先说一句或贴一段用法。'; break; }
      const fill = (r, how) => {
        Object.assign(f, { name: r.name || f.name, dose: r.dose || f.dose, times: r.times.join(', ') || f.times, method: r.method || f.method });
        const miss = [!r.name && '药名', !r.dose && '每次吃多少', !r.times.length && '具体几点', !r.method && '怎么吃'].filter(Boolean);
        f.aiNote = `${how}，已整理出能确定的内容。` +
          (r.dropped && r.dropped.length ? `AI 给出的「${r.dropped.join('、')}」在原话里找不到依据，已去掉。` : '') +
          (miss.length ? `原话里没说清楚的（${miss.join('、')}）请你补上，AI 不会瞎猜。` : '请核对一遍。');
      };
      f.aiNote = '正在整理…'; render();
      llmParse(text).then(raw => { fill(groundCheck(text, raw), '由 DeepSeek 整理并逐项核对原文'); })
        .catch(() => { fill(aiParse(text), '大模型暂时没连上，已用规则整理'); })
        .then(() => { emit('ai'); render(); });
      break;
    }
    case 'cancel': S.draft = null; S.view = null; break;
    case 'restock': S.restock = el.dataset.med; break;
    case 'restockSave': {
      const m = S.meds.find(x => x.id === el.dataset.med), n = +document.querySelector('#restockN')?.value;
      if (!m || !Number.isInteger(n) || n < 1 || n > 999) return;
      restock(m, n); S.restock = null; S.note = `✅ 已给「${short(m.name)}」补上 ${n} ${unit(m)}，现在约够吃 ${daysLeft(m)} 天。`; emit('restock'); break;
    }
    case 'save': {
      const f = S.draft, times = f.times.split(/[,，、\s]+/).filter(Boolean).map(t => t.replace('：', ':').padStart(5, '0'));
      if (!f.name.trim() || !f.dose.trim() || !f.method.trim()) { f.err = '请填写药名、每次吃多少和怎么吃。'; break; }
      if (!times.length || times.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) { f.err = '吃药时间请写成 08:00 这样的格式。'; break; }
      const stock = String(f.stock ?? '').trim();
      if (stock && !/^\d{1,3}$/.test(stock)) { f.err = '剩余药量请填 0–999 的整数，不知道可以空着。'; break; }
      S.meds.push({ id: 'm' + Date.now(), name: f.name.trim(), dose: f.dose.trim(), method: f.method.trim(), slot: +f.slot, box: f.box, pill: f.pill, shape: f.shape, photo: f.photo, times: [...new Set(times)], stock: stock ? +stock : null });
      buildDoses(); S.draft = null; S.view = null; S.tab = 'meds'; S.note = `✅ 已保存「${short(f.name)}」，到点会提醒妈妈。`; emit('setup'); break;
    }
    default: return;
  }
  render();
});

const refreshPreview = () => { const p = document.querySelector('.preview'); if (p && S.draft) p.innerHTML = '妈妈会看到：' + art({ ...S.draft, name: S.draft.name || '药名' }, .8); };
document.addEventListener('input', e => {
  const k = e.target.dataset.f;
  if (k && S.draft) { S.draft[k] = e.target.value; if (['box', 'pill', 'shape', 'name'].includes(k)) refreshPreview(); }
});
document.addEventListener('change', async e => {
  if (e.target.dataset.photo === undefined || !S.draft) return;
  const file = e.target.files[0]; if (!file) return;
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) { S.draft.err = '请选择 10MB 以内的图片。'; return render(); }
  try { S.draft.photo = await readPhoto(file); S.draft.err = ''; } catch { S.draft.err = '图片读取失败，请换一张。'; }
  render();
});

start('normal');
}

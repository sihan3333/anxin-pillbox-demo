// 安心药箱 MVP 共用代码：配置编码、服药顺序、语音朗读、记录存取。纯前端，不上传任何数据。
const MVP = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmt = m => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const period = t => { const h = +t.slice(0, 2); return h < 11 ? '早上' : h < 14 ? '中午' : h < 18 ? '下午' : '晚上'; };
  const spokenTime = t => { const h = +t.slice(0, 2), m = +t.slice(3); return `${period(t)}${h > 12 ? h - 12 : h}点${m ? (m === 30 ? '半' : m + '分') : ''}`; };
  const today = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const nowMin = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

  // 配置放在链接的 # 后面：只在家人之间传递，不经过任何服务器
  const encode = cfg => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(cfg)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decode = s => { try { const b = atob(s.replace(/-/g, '+').replace(/_/g, '/')); return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, c => c.charCodeAt(0)))); } catch { return null; } };
  const fromHash = () => location.hash.length > 1 ? decode(location.hash.slice(1)) : null;

  // 同一时刻多种药：饭前 → 和饭一起 → 饭后 → 睡前；没写饭点的排在“和饭一起”一档并保持录入顺序
  const MEAL = [[/空腹|饭前|餐前/, '饭前'], [/和饭|随餐|吃饭时|进餐时|餐中|与食物同服/, '吃饭时'], [/饭后|餐后/, '饭后'], [/睡前/, '睡前']];
  const mealStep = m => { const i = MEAL.findIndex(([r]) => r.test(m.method || '')); return i < 0 ? { rank: 1, label: '' } : { rank: i, label: MEAL[i][1] }; };
  const CN = '一二三四五六七八';

  function doses(cfg) {
    const times = [...new Set(cfg.meds.flatMap(m => m.times))].sort();
    return times.map(time => ({ time, meds: cfg.meds.filter(m => m.times.includes(time)).sort((a, b) => mealStep(a).rank - mealStep(b).rank) }));
  }
  // 当前该看哪一顿：最近一个已到点、且没过 3 小时的；否则下一顿
  function currentDose(list, m = nowMin()) {
    const past = list.filter(d => toMin(d.time) <= m && m - toMin(d.time) <= 180);
    if (past.length) return past[past.length - 1];
    return list.find(d => toMin(d.time) > m) || list[0];
  }
  const stepName = (m, i) => `第${CN[i]}种${mealStep(m).label ? `，${mealStep(m).label}吃` : ''}`;
  function instruction(d) {
    const seq = d.meds.length > 1;
    return `该吃${spokenTime(d.time)}的药了。` + (seq ? `一共${d.meds.length}种，请按顺序吃。` : '') +
      d.meds.map((m, i) => `${seq ? stepName(m, i) + '：' : ''}${m.slot ? `打开药盒第${m.slot}格，` : ''}拿${m.look ? m.look + '的' : ''}${m.name}，吃${m.dose}。${m.method ? m.method + '。' : ''}`).join('') +
      `${seq ? '都' : ''}吃好以后，请按绿色的“我吃好了”。如果遇到问题，请按橙色的“我需要帮忙”。`;
  }

  // 浏览器朗读长句会中途停、取消后立刻朗读会被吞，所以按句拆开排队并稍等再读
  let speakTimer, queue = [];
  const TTS = typeof speechSynthesis !== 'undefined';
  if (TTS) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }
  function speak(t) {
    if (!TTS || !t) return;
    clearTimeout(speakTimer); speechSynthesis.cancel();
    const vs = speechSynthesis.getVoices().filter(v => /^zh[-_]CN/i.test(v.lang)), v = vs.find(x => /Xiaoxiao|Natural/i.test(x.name)) || vs[0];
    queue = (t.match(/[^。！？]+[。！？]?/g) || [t]).map(p => { const u = new SpeechSynthesisUtterance(p); u.lang = 'zh-CN'; u.rate = 0.85; if (v) u.voice = v; return u; });
    speakTimer = setTimeout(() => { speechSynthesis.resume(); queue.forEach(u => speechSynthesis.speak(u)); }, 150);
  }

  // iOS 和安卓都能识别的短信链接写法
  const smsLink = (phone, body) => `sms:${phone || ''}?&body=${encodeURIComponent(body)}`;

  const store = {
    get: (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
  };

  return { esc, pad, toMin, fmt, period, spokenTime, today, nowMin, encode, decode, fromHash, mealStep, doses, currentDose, stepName, instruction, speak, smsLink, store };
})();
if (typeof module !== 'undefined') module.exports = MVP;

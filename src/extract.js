function extractMock(text) {
  const lines = text.split(/[\n；;]/).map(x => x.trim()).filter(Boolean);
  if (lines.length > 8) throw new Error('Too many items');
  const items = lines.map(line => {
    const name = line.split(/[，,：:]/)[0].trim();
    const dose = line.match(/(?:每次\s*)?(\d+(?:\.\d+)?\s*(?:片|粒|袋|滴|毫升|mL|ml|mg|毫克))/);
    const days = line.match(/(?:连续|持续|共|用|服用)?\s*(\d+)\s*天/);
    const times = [...line.matchAll(/(?:^|[^\d])(\d{1,2}[:：]\d{2})(?!\d)/g)].map(x => x[1].replace('：', ':')).filter(t => /^([01]?\d|2[0-3]):[0-5]\d$/.test(t)).map(t => t.padStart(5, '0'));
    return { name, dose: dose ? dose[1] : '', days: days ? Number(days[1]) : null, times: [...new Set(times)].sort(), evidence: { name, dose: dose ? dose[0] : '', days: days ? days[0] : '', times: times.length ? line : '' }, source: line };
  });
  return { items, warning: 'AI Mock：规则提取，仅支持逐行药名、数字剂量、数字天数、明确 HH:MM。请逐项核对；“早晚/每日几次/饭后”等不会自动换算为时刻。' };
}
function validateExtraction(data, text) {
  if (!data || !Array.isArray(data.items) || !data.items.length || data.items.length > 8) throw new Error('Invalid items');
  const items = data.items.map(item => {
    if (!item || typeof item !== 'object') throw new Error('Invalid item');
    const ev = item.evidence || {};
    const supported = field => typeof ev[field] === 'string' && ev[field].length > 0 && text.includes(ev[field]);
    const name = typeof item.name === 'string' && supported('name') && ev.name.includes(item.name) ? item.name.trim() : '';
    const dose = typeof item.dose === 'string' && supported('dose') && ev.dose.includes(item.dose) ? item.dose.trim() : '';
    const days = Number.isInteger(item.days) && item.days >= 1 && item.days <= 30 && supported('days') && new RegExp(`(^|[^0-9])${item.days}\\s*天`).test(ev.days) ? item.days : null;
    const times = Array.isArray(item.times) && supported('times') ? item.times.filter(t => typeof t === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) && ev.times.includes(t)) : [];
    return { name, dose, days, times: [...new Set(times)].sort(), evidence: ev, source: text };
  });
  return { items, warning: '真实模型输出已经过原文证据约束；仍可能漏项或错误匹配，创建前必须人工核对。' };
}
if (typeof module !== 'undefined') module.exports = { extractMock, validateExtraction };
else window.Extract = { extractMock, validateExtraction };

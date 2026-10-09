(function (root) {
  const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  function validate(items, start) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || dateKey(new Date(start+'T12:00:00')) !== start) return '请选择有效的开始日期。';
    if (start < dateKey(new Date())) return '演示版仅支持今天或未来开始，不重建过去的服药记录。';
    if (!Array.isArray(items) || !items.length || items.length > 8) return '需录入 1–8 个药品。';
    for (const item of items) {
      if (!item.name.trim() || !item.dose.trim()) return '药品名称和每次剂量不能为空，请核对原安排。';
      if (item.name.length > 80 || item.dose.length > 80) return '名称或剂量过长。';
      if (!Number.isInteger(item.days) || item.days < 1 || item.days > 30) return '天数需为 1–30 的整数；未注明时请核对原安排。';
      if (!item.times.length || item.times.length > 8 || item.times.some(t => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) return '请填写已有安排明确的 24 小时时刻，例如 08:00,20:00；不能只写“早晚”。';
      if (new Set(item.times).size !== item.times.length) return '同一药品存在重复时刻，请核对。';
    }
    return '';
  }
  function generate(items, start) {
    const error = validate(items,start); if(error) throw new Error(error);
    const tasks = [];
    items.forEach((item,i) => { for(let n=0;n<item.days;n++) { const day = new Date(start+'T12:00:00'); day.setDate(day.getDate()+n); for (const time of item.times) tasks.push({ id:`${i}-${n}-${time}`, name:item.name, dose:item.dose, day:dateKey(day), time, status:'pending', events:[] }); } });
    return tasks.sort((a,b)=>(a.day+a.time).localeCompare(b.day+b.time));
  }
  function transition(task, next, now = new Date().toISOString()) {
    if (!['done','unsure','skipped','pending'].includes(next)) throw new Error('Invalid status');
    if (task.status === next) return false;
    task.events.push({ from:task.status, to:next, at:now }); task.status=next; return true;
  }
  function displayStatus(task, now = new Date()) {
    if(task.status !== 'pending') return task.status;
    return new Date(`${task.day}T${task.time}:00`) < now ? 'overdue' : 'pending';
  }
  const api = { dateKey, validate, generate, transition, displayStatus };
  if(typeof module !== 'undefined') module.exports=api; else root.PlanCore=api;
})(typeof window !== 'undefined' ? window : globalThis);

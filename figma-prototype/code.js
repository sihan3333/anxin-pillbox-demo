// 安心药箱 · 一键生成原型 v3（Figma 开发插件）
// 视觉参考主流开源移动端设计规范：品牌蓝、浅色标签、白卡片 + 轻阴影、单元格列表、底部标签栏。
// 运行后新建一页「安心药箱 原型 v3」：
//   父母端 9 屏（适老化大字）+ 子女端 9 屏 + 状态规范板 + 成功指标板，每屏下方附设计说明；
//   颜色变量、文字样式、阴影样式和点击跳转一并建好。

const C = {
  brand: '#0052D9', brandLight: '#F2F3FF', brandLight2: '#D9E1FF',
  green: '#008858', greenLight: '#E3F9E9',
  orange: '#BE5A00', orangeLight: '#FFF1E9',
  text: '#1A1A1A', text2: '#666666', line: '#E7E7E7', bg: '#F3F3F3', white: '#FFFFFF', gray: '#EEEEEE',
  lit: '#FFE7A3', litEdge: '#F5BA18', box: '#3A3F4B', boxCell: '#4B5160'
};
const COLOR_NAMES = {
  brand: '品牌/主色', brandLight: '品牌/浅色-1', brandLight2: '品牌/浅色-2',
  green: '功能/成功', greenLight: '功能/成功-浅', orange: '功能/警示', orangeLight: '功能/警示-浅',
  text: '文字/主要', text2: '文字/次要', line: '中性/描边', bg: '中性/页面背景', white: '中性/白', gray: '中性/浅灰',
  lit: '药盒/当前格', litEdge: '药盒/当前格描边', box: '药盒/盒身', boxCell: '药盒/格子'
};
// [字号, 是否加粗, 样式名]
const TS = {
  P_h1: [36, 1, '父母端/大标题 36'], P_h2: [26, 1, '父母端/标题 26'], P_btn: [24, 1, '父母端/按钮 24'],
  P_body: [20, 0, '父母端/正文 20'], P_bodyB: [20, 1, '父母端/正文加粗 20'], P_small: [17, 0, '父母端/说明 17'],
  K_nav: [17, 1, '子女端/导航标题 17'], K_h1: [22, 1, '子女端/大标题 22'], K_h2: [16, 1, '子女端/小标题 16'],
  K_body: [15, 0, '子女端/正文 15'], K_bodyB: [15, 1, '子女端/正文加粗 15'], K_small: [13, 0, '子女端/说明 13'],
  K_btn: [16, 1, '子女端/按钮 16'], K_tab: [11, 0, '子女端/标签栏 11']
};
const ICONS = {
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  close: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  speaker: '<path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 17v5"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 7v6"/><path d="M12 16.5v.5"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  pill: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="m8.5 8.5 7 7"/>',
  chart: '<path d="M4 20V11"/><path d="M10 20V5"/><path d="M16 20v-6"/><path d="M21 20H3"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
  bulb: '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.6.6 1 1.4 1 2.5h6c0-1.1.4-1.9 1-2.5A6 6 0 0 0 12 3z"/>',
  camera: '<path d="M3 8h4l2-3h6l2 3h4v11H3z"/><circle cx="12" cy="13" r="4"/>',
  shapes: '<circle cx="8" cy="8" r="4.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  offline: '<path d="M2 2l20 20"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.6a10 10 0 0 1 3.2-1.8"/><path d="M15.3 11a10 10 0 0 1 3.7 1.6"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M10.7 5.1A15 15 0 0 1 22 8.8"/><path d="M12 20h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'
};
const SHADOW = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.06 }, offset: { x: 0, y: 4 }, radius: 16, spread: 0, visible: true, blendMode: 'NORMAL' }];
const GLOW = [{ type: 'DROP_SHADOW', color: { r: 0.96, g: 0.73, b: 0.09, a: 0.6 }, offset: { x: 0, y: 0 }, radius: 14, spread: 1, visible: true, blendMode: 'NORMAL' }];

const V = 'v3';
const COL = 470;            // 屏与屏的横向间距
const ROW_P = 300;          // 父母端这一排的 y
const ROW_K = 1700;         // 子女端这一排的 y
const ROW_SPEC = 2960;      // 规范与指标板的 y

let F = null;          // { r: 常规字体, b: 粗体 }
let EFF = null;        // 阴影样式
const VARS = {};       // 颜色值 → 颜色变量
const STY = {};        // 样式键 → 文字样式
const pending = [];    // 异步设置样式
const links = [];      // [节点, 目标屏键]
const S = {};          // 屏键 → 画板

function rgb(h) {
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16 & 255) / 255, g: (n >> 8 & 255) / 255, b: (n & 255) / 255 };
}
function solid(h) {
  let p = { type: 'SOLID', color: rgb(h) };
  const v = VARS[h];
  if (v) { try { p = figma.variables.setBoundVariableForPaint(p, 'color', v); } catch (e) { } }
  return [p];
}

async function pickFont() {
  const all = await figma.listAvailableFontsAsync();
  const families = ['PingFang SC', 'Noto Sans SC', 'Source Han Sans SC', 'Source Han Sans CN', 'Noto Sans CJK SC', 'Microsoft YaHei'];
  for (const fam of families) {
    const styles = all.filter(f => f.fontName.family === fam).map(f => f.fontName.style);
    if (!styles.length) continue;
    const r = styles.find(s => /^(Regular|Normal)$/i.test(s)) || styles[0];
    const b = styles.find(s => /^(Semibold|SemiBold)$/i.test(s)) || styles.find(s => /^Bold$/i.test(s)) || styles.find(s => /Bold|Medium/i.test(s)) || r;
    return { r: { family: fam, style: r }, b: { family: fam, style: b } };
  }
  throw new Error('没有找到可用的中文字体（苹方 / Noto Sans SC / 微软雅黑）');
}

function setupVars() {
  try {
    const col = figma.variables.createVariableCollection('安心药箱 ' + V + ' 颜色');
    const mode = col.modes[0].modeId;
    for (const k of Object.keys(C)) {
      const v = figma.variables.createVariable(COLOR_NAMES[k], col, 'COLOR');
      v.setValueForMode(mode, rgb(C[k]));
      VARS[C[k]] = v;
    }
  } catch (e) { console.warn('颜色变量创建失败，改用普通颜色', e); }
}
function setupStyles() {
  for (const k of Object.keys(TS)) {
    try {
      const [size, bold, name] = TS[k];
      const s = figma.createTextStyle();
      s.name = V + '/' + name;
      s.fontName = bold ? F.b : F.r;
      s.fontSize = size;
      s.lineHeight = { value: 140, unit: 'PERCENT' };
      STY[k] = s;
    } catch (e) { console.warn('文字样式创建失败', e); }
  }
  try {
    EFF = figma.createEffectStyle();
    EFF.name = V + '/卡片阴影';
    EFF.effects = SHADOW;
  } catch (e) { EFF = null; }
}

// ---------- 基础积木 ----------

function box(name, o = {}) {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = o.dir || 'VERTICAL';
  f.itemSpacing = o.gap || 0;
  const p = o.pad === undefined ? 0 : o.pad;
  const [t, r, b, l] = Array.isArray(p) ? p : [p, p, p, p];
  f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.primaryAxisAlignItems = o.align || 'MIN';
  f.counterAxisAlignItems = o.cross || 'MIN';
  f.fills = o.fill ? solid(o.fill) : [];
  f.cornerRadius = o.radius || 0;
  f.clipsContent = false;
  if (o.stroke) { f.strokes = solid(o.stroke); f.strokeWeight = o.strokeW || 1; f.strokeAlign = 'INSIDE'; }
  return f;
}
function fixed(f, w, h) {
  f.primaryAxisSizingMode = 'FIXED';
  f.counterAxisSizingMode = 'FIXED';
  f.resize(w, h);
  return f;
}
function txt(s, st, color = C.text, align = 'LEFT', noStyle = false) {
  const [size, bold] = TS[st];
  const t = figma.createText();
  t.fontName = bold ? F.b : F.r;
  t.characters = s;
  t.fontSize = size;
  t.lineHeight = { value: 140, unit: 'PERCENT' };
  t.fills = solid(color);
  t.textAlignHorizontal = align;
  t.name = s ? s.replace(/\n/g, ' ').slice(0, 20) : '空白';
  if (STY[st] && !noStyle) pending.push(t.setTextStyleIdAsync(STY[st].id).catch(() => { }));
  return t;
}
// w: 'FILL' | 'HUG' | null（不改）；tall: 竖向填满
function put(parent, child, w = 'FILL', tall = false) {
  if (child.type === 'TEXT' && w === 'FILL') child.textAutoResize = 'HEIGHT';
  parent.appendChild(child);
  if (w) child.layoutSizingHorizontal = w;
  if (tall) child.layoutSizingVertical = 'FILL';
  return child;
}
function fixedText(parent, s, st, color, width, align) {
  const t = txt(s, st, color, align || 'LEFT');
  t.textAutoResize = 'HEIGHT';
  parent.appendChild(t);
  t.resize(width, t.height);
  return t;
}
function ico(name, color, size, sw) {
  const n = figma.createNodeFromSvg(
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw || 2}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`);
  n.name = '图标/' + name;
  n.resize(size, size);
  return n;
}
function shade(n) {
  n.effects = SHADOW;
  if (EFF) pending.push(n.setEffectStyleIdAsync(EFF.id).catch(() => { }));
  return n;
}
function spacer(parent) { return put(parent, box('留白'), 'FILL', true); }
function link(node, to) { links.push([node, to]); return node; }
function divider(parent) {
  const r = figma.createRectangle();
  r.name = '分割线';
  r.resize(10, 1);
  r.fills = solid(C.line);
  parent.appendChild(r);
  r.layoutSizingHorizontal = 'FILL';
  return r;
}
function circ(name, size, fill, child) {
  const f = fixed(box(name, { fill, radius: size / 2, align: 'CENTER', cross: 'CENTER' }), size, size);
  if (child) put(f, child, child.type === 'TEXT' ? 'HUG' : null);
  return f;
}
function bottomLine(f) {
  f.strokes = solid(C.line);
  f.strokeAlign = 'INSIDE';
  f.strokeTopWeight = 0; f.strokeLeftWeight = 0; f.strokeRightWeight = 0; f.strokeBottomWeight = 1;
  return f;
}
function row(parent, name, gap, cross) {
  const r = box(name, { dir: 'HORIZONTAL', gap: gap === undefined ? 8 : gap, cross: cross || 'CENTER' });
  put(parent, r);
  return r;
}
function col(parent, name, gap) {
  const c = box(name, { gap: gap || 0 });
  put(parent, c);
  return c;
}

// 按钮：primary 品牌蓝 / success 确认绿 / warnLine 橙色描边 / line 灰描边 / light 浅蓝
function btn(label, kind, st, h, icon) {
  const K = {
    primary: [C.brand, C.white, null], success: [C.green, C.white, null],
    warnLine: [C.white, C.orange, C.orange], line: [C.white, C.text, C.line], light: [C.brandLight, C.brand, null]
  }[kind];
  const big = st[0] === 'P';
  const f = fixed(box('按钮/' + label, { dir: 'HORIZONTAL', gap: 8, pad: [0, 12, 0, 12], fill: K[0], radius: big ? 14 : 8, align: 'CENTER', cross: 'CENTER', stroke: K[2], strokeW: big ? 2 : 1 }), 200, h);
  if (icon) put(f, ico(icon, K[1], big ? 28 : 18), null);
  put(f, txt(label, st, K[1], 'CENTER'), 'HUG');
  return f;
}
// 标签：success / warning / brand / gray
function tag(label, theme, big, icon) {
  const T = { success: [C.greenLight, C.green], warning: [C.orangeLight, C.orange], brand: [C.brandLight, C.brand], gray: [C.gray, C.text2] }[theme];
  const f = box('标签/' + label, { dir: 'HORIZONTAL', gap: 4, pad: big ? [6, 12, 6, 12] : [2, 8, 2, 8], fill: T[0], radius: big ? 8 : 4, cross: 'CENTER' });
  if (icon) put(f, ico(icon, T[1], big ? 18 : 14), null);
  put(f, txt(label, big ? 'P_small' : 'K_small', T[1]), 'HUG');
  return f;
}
function card(name, o = {}) {
  const f = box(name, { gap: o.gap === undefined ? 12 : o.gap, pad: o.pad === undefined ? 16 : o.pad, fill: o.fill || C.white, radius: o.radius || 12, dir: o.dir, cross: o.cross });
  if (!o.fill || o.fill === C.white) shade(f);
  return f;
}
function voice(s) {
  const f = box('语音朗读', { dir: 'HORIZONTAL', gap: 12, pad: [12, 16, 12, 16], fill: C.brandLight, radius: 12, cross: 'CENTER' });
  put(f, circ('朗读中', 36, C.brand, ico('speaker', C.white, 20)), null);
  put(f, txt(s, 'P_small', C.text));
  return f;
}

// ---------- 页面骨架 ----------

function statusBar(onDark) {
  const c = onDark ? C.white : C.text;
  const bar = fixed(box('状态栏', { dir: 'HORIZONTAL', pad: [0, 24, 0, 32], align: 'SPACE_BETWEEN', cross: 'CENTER' }), 390, 44);
  put(bar, txt('9:41', 'K_bodyB', c), 'HUG');
  const icons = figma.createNodeFromSvg(
    `<svg width="68" height="12" viewBox="0 0 68 12" fill="none"><rect x="0" y="8" width="3" height="4" rx="1" fill="${c}"/><rect x="5" y="6" width="3" height="6" rx="1" fill="${c}"/><rect x="10" y="3" width="3" height="9" rx="1" fill="${c}"/><rect x="15" y="0" width="3" height="12" rx="1" fill="${c}"/><path d="M24 4.5a9 9 0 0 1 12 0M26.5 7.5a5 5 0 0 1 7 0" stroke="${c}" stroke-width="1.6" stroke-linecap="round"/><circle cx="30" cy="10.5" r="1.3" fill="${c}"/><rect x="42.5" y="0.5" width="22" height="11" rx="3" stroke="${c}" stroke-opacity="0.5"/><rect x="44.5" y="2.5" width="16" height="7" rx="1.5" fill="${c}"/><rect x="66" y="4" width="1.5" height="4" rx="0.75" fill="${c}" fill-opacity="0.5"/></svg>`);
  icons.name = '信号/电量';
  put(bar, icons, null);
  return bar;
}
function navBar(title, o = {}) {
  const big = !!o.parent;
  const bar = bottomLine(fixed(box('导航栏', { dir: 'HORIZONTAL', pad: [0, 8, 0, 8], fill: C.white, cross: 'CENTER' }), 390, big ? 56 : 48));
  const side = big ? 124 : 104;
  const left = fixed(box('左侧', { dir: 'HORIZONTAL', gap: 2, cross: 'CENTER', pad: [0, 0, 0, 4] }), side, 44);
  put(bar, left, null);
  if (o.back) {
    put(left, ico('back', C.text, big ? 26 : 22), null);
    put(left, txt('返回', big ? 'P_small' : 'K_body', C.text), 'HUG');
  }
  put(bar, txt(title, big ? 'P_bodyB' : 'K_nav', C.text, 'CENTER'));
  const right = fixed(box('右侧', { dir: 'HORIZONTAL', align: 'MAX', cross: 'CENTER', pad: [0, 4, 0, 0] }), side, 44);
  put(bar, right, null);
  if (o.right) put(right, o.right, 'HUG');
  return { bar, left, right: o.right || null };
}
function tabBar(active) {
  const bar = box('标签栏', { dir: 'HORIZONTAL', pad: [6, 8, 22, 8], fill: C.white });
  bar.strokes = solid(C.line); bar.strokeAlign = 'INSIDE';
  bar.strokeTopWeight = 1; bar.strokeLeftWeight = 0; bar.strokeRightWeight = 0; bar.strokeBottomWeight = 0;
  const items = {};
  for (const [name, icon] of [['今天', 'home'], ['药品', 'pill'], ['这一周', 'chart']]) {
    const on = name === active;
    const it = fixed(box('标签/' + name, { gap: 2, align: 'CENTER', cross: 'CENTER' }), 100, 46);
    put(bar, it, 'FILL');
    put(it, ico(icon, on ? C.brand : C.text2, 22, on ? 2.2 : 1.8), null);
    put(it, txt(name, 'K_tab', on ? C.brand : C.text2, 'CENTER'), 'HUG');
    items[name] = it;
  }
  return { bar, items };
}
// 画板下方的设计说明
function note(x, y, s) {
  const t = txt('设计说明：' + s, 'K_body', C.text2);
  t.textAutoResize = 'HEIGHT';
  t.resize(390, t.height);
  t.x = x; t.y = y;
  t.name = '设计说明';
  figma.currentPage.appendChild(t);
}
// 返回 { s: 画板, body: 内容区, nav, tab }
function screen(key, name, col, y, o = {}) {
  const x = col * COL;
  const s = fixed(box(name, { fill: o.bg || C.bg }), 390, 844);
  s.x = x; s.y = y;
  s.clipsContent = true;
  figma.currentPage.appendChild(s);
  S[key] = s;
  put(s, statusBar(!!o.dark));
  let nav = null;
  if (o.nav) { nav = navBar(o.nav, { back: o.back, right: o.right, parent: o.parent }); put(s, nav.bar); }
  const body = box('内容', { gap: o.parent ? 16 : 12, pad: o.parent ? [16, 20, 28, 20] : [16, 16, 16, 16] });
  put(s, body, 'FILL', true);
  let tab = null;
  if (o.tab) { tab = tabBar(o.tab); put(s, tab.bar); }
  if (o.note) note(x, y + 844 + 24, o.note);
  return { s, body, nav, tab };
}

// ---------- 父母端零件 ----------

function pillbox(lit, o = {}) {
  const wrap = box(o.name || '药盒示意', { gap: 10, pad: 14, fill: C.box, radius: 16 });
  const head = box('药盒标题', { dir: 'HORIZONTAL', cross: 'CENTER', gap: 8 });
  put(wrap, head);
  put(head, txt(o.title || '妈妈的药盒', 'P_small', C.white));
  const tagText = o.tag || (lit.length ? '打开第 ' + lit.join('、') + ' 格' : '');
  if (tagText) put(head, tag(tagText, o.tagTheme || 'warning', true), 'HUG');
  const r = box('格子', { dir: 'HORIZONTAL', gap: 8 });
  put(wrap, r);
  for (let i = 1; i <= 4; i++) {
    const on = lit.includes(i);
    const c = fixed(box('第' + i + '格' + (on ? '（这一格）' : ''), { gap: 0, fill: on ? C.lit : C.boxCell, radius: 10, align: 'CENTER', cross: 'CENTER', stroke: on ? C.litEdge : null, strokeW: 2 }), 60, 72);
    if (on) c.effects = GLOW;
    put(r, c, 'FILL');
    put(c, txt(String(i), 'P_h2', on ? C.text : C.white, 'CENTER'), 'HUG');
    put(c, txt(on ? '这格' : '格', 'P_small', on ? C.text : C.white, 'CENTER'), 'HUG');
  }
  return wrap;
}
function fact(parent, k, v) {
  const r = row(parent, '信息/' + k, 12);
  fixedText(r, k, 'P_small', C.text2, 64);
  put(r, txt(v, 'P_bodyB'));
}
function helpCell(n, label, last) {
  const f = fixed(box('选项 ' + n + ' ' + label, { dir: 'HORIZONTAL', gap: 14, pad: [0, 16, 0, 16], cross: 'CENTER' }), 300, 76);
  if (!last) bottomLine(f);
  put(f, circ('序号', 44, C.orangeLight, txt(String(n), 'P_h2', C.orange, 'CENTER')), null);
  put(f, txt(label, 'P_bodyB'));
  put(f, ico('right', C.text2, 24), null);
  return f;
}
function bullet(parent, icon, color, s, st) {
  const r = row(parent, s, 12);
  put(r, ico(icon, color, st[0] === 'P' ? 26 : 18, 2.4), null);
  put(r, txt(s, st));
}

// ---------- 子女端零件 ----------

function ring(frac, label) {
  const f = figma.createFrame();
  f.name = '今日进度';
  f.resize(72, 72);
  f.fills = [];
  f.clipsContent = false;
  const bgRing = figma.createEllipse();
  bgRing.resize(72, 72); bgRing.fills = solid(C.brandLight2);
  bgRing.arcData = { startingAngle: 0, endingAngle: 2 * Math.PI, innerRadius: 0.8 };
  f.appendChild(bgRing);
  const fg = figma.createEllipse();
  fg.resize(72, 72); fg.fills = solid(C.brand);
  fg.arcData = { startingAngle: -Math.PI / 2, endingAngle: -Math.PI / 2 + 2 * Math.PI * frac, innerRadius: 0.8 };
  f.appendChild(fg);
  const t = txt(label, 'K_h2', C.text, 'CENTER');
  f.appendChild(t);
  t.x = (72 - t.width) / 2; t.y = (72 - t.height) / 2;
  return f;
}
function stat(parent, num, label, color) {
  const f = box('统计/' + label, { gap: 0, cross: 'CENTER' });
  put(parent, f);
  put(f, txt(num, 'K_h1', color || C.text, 'CENTER'), 'HUG');
  put(f, txt(label, 'K_small', C.text2, 'CENTER'), 'HUG');
}
function schedCell(parent, time, when, meds, t, last) {
  const r = box(time + ' ' + when, { dir: 'HORIZONTAL', gap: 12, pad: [12, 16, 12, 16], cross: 'CENTER' });
  if (!last) bottomLine(r);
  put(parent, r);
  const tc = box('时间', { gap: 0 });
  put(r, tc, null);
  tc.resize(48, tc.height);
  tc.layoutSizingHorizontal = 'FIXED';
  put(tc, txt(time, 'K_bodyB'));
  put(tc, txt(when, 'K_small', C.text2));
  put(r, txt(meds, 'K_body'));
  put(r, t, 'HUG');
}
function navCell(parent, label, sub, last, right) {
  const r = box(label, { dir: 'HORIZONTAL', gap: 8, pad: [12, 16, 12, 16], cross: 'CENTER' });
  if (!last) bottomLine(r);
  put(parent, r);
  const c = col(r, '文字');
  put(c, txt(label, 'K_bodyB'));
  if (sub) put(c, txt(sub, 'K_small', C.text2));
  if (right) put(r, right, right.layoutMode && right.layoutMode !== 'NONE' ? 'HUG' : null);
  else put(r, ico('right', C.text2, 18), null);
  return r;
}
function timeline(parent, items) {
  items.forEach(([time, desc, hot], i) => {
    const r = box('节点 ' + time, { dir: 'HORIZONTAL', gap: 12 });
    put(parent, r);
    const rail = box('轴', { cross: 'CENTER', pad: [5, 0, 0, 0] });
    put(r, rail, null);
    const dot = figma.createEllipse();
    dot.resize(10, 10); dot.fills = solid(hot ? C.orange : C.brand);
    rail.appendChild(dot);
    if (i < items.length - 1) {
      const l = figma.createRectangle();
      l.resize(2, 38); l.fills = solid(C.brandLight2);
      rail.appendChild(l);
    }
    const c = box('内容', { gap: 0, pad: [0, 0, 6, 0] });
    put(r, c);
    put(c, txt(time, 'K_bodyB', hot ? C.orange : C.text));
    put(c, txt(desc, 'K_body', C.text2));
  });
}
function stepRow(parent, n, s) {
  const r = row(parent, '第' + n + '步', 10, 'MIN');
  put(r, circ('序号', 22, C.brandLight, txt(String(n), 'K_small', C.brand, 'CENTER')), null);
  put(r, txt(s, 'K_body'));
}
function formRow(parent, k, v, warn, last) {
  const r = box('字段/' + k, { dir: 'HORIZONTAL', gap: 12, pad: [11, 16, 11, 16], cross: warn ? 'MIN' : 'CENTER' });
  if (!last) bottomLine(r);
  put(parent, r);
  fixedText(r, k, 'K_body', C.text2, 56);
  if (!warn) { put(r, txt(v, 'K_bodyB', C.brand, 'RIGHT')); return; }
  const c = box('待补充', { gap: 0, cross: 'MAX' });
  put(r, c);
  put(c, txt(v + ' ›', 'K_bodyB', C.orange, 'RIGHT'));
  put(c, txt(warn, 'K_small', C.orange, 'RIGHT'));
}
function uploadTile(parent, icon, label) {
  const f = fixed(box('上传/' + label, { gap: 4, align: 'CENTER', cross: 'CENTER', fill: C.white, radius: 8, stroke: '#C5C5C5' }), 160, 76);
  f.dashPattern = [4, 4];
  put(parent, f, 'FILL');
  put(f, ico(icon, C.text2, 22), null);
  put(f, txt(label, 'K_small', C.text2, 'CENTER'), 'HUG');
}
function toggle(on) {
  const f = fixed(box('开关/' + (on ? '开' : '关'), { dir: 'HORIZONTAL', pad: 2, fill: on ? C.brand : C.line, radius: 13, align: on ? 'MAX' : 'MIN', cross: 'CENTER' }), 44, 26);
  put(f, shade(circ('圆点', 22, C.white)), null);
  return f;
}
function segmented(options, idx) {
  const f = box('分段选择', { dir: 'HORIZONTAL', gap: 2, pad: 2, fill: C.gray, radius: 8 });
  options.forEach((o, i) => {
    const on = i === idx;
    const it = fixed(box(o, { fill: on ? C.white : null, radius: 6, align: 'CENTER', cross: 'CENTER' }), 64, 30);
    if (on) shade(it);
    put(f, it, null);
    put(it, txt(o, on ? 'K_bodyB' : 'K_body', on ? C.text : C.text2, 'CENTER'), 'HUG');
  });
  return f;
}
function sectionTitle(parent, s) {
  const t = txt(s, 'K_h2');
  put(parent, t);
  return t;
}
function avatar(ch, size) {
  return circ('头像/' + ch, size || 36, C.brandLight, txt(ch, size && size > 40 ? 'K_h1' : 'K_bodyB', C.brand, 'CENTER'));
}

// ---------- 父母端 9 屏 ----------

function buildParent() {
  const Y = ROW_P;
  let s, body, nav;

  // ① 到点提醒：像来电一样
  ({ s, body } = screen('Main', '父母 ① 到点提醒', 0, Y, { parent: true, dark: true, bg: C.brand,
    note: '像来电一样响铃 + 语音，老人不用解锁、不用找 App。整屏只有一个主操作：接听；遇到问题随时按橙色按钮。' }));
  body.paddingTop = 8; body.paddingLeft = 0; body.paddingRight = 0; body.paddingBottom = 0; body.itemSpacing = 0;
  const hero = box('来电区', { gap: 8, pad: [12, 24, 28, 24] });
  put(body, hero);
  put(hero, tag('早上 8:00 · 吃药时间', 'brand', true), 'HUG');
  put(hero, txt('该吃药了', 'P_h1', C.white));
  put(hero, txt('早上有 2 种药，在药盒第 1、2 格', 'P_body', C.white));
  const sheet = box('白色面板', { gap: 18, pad: [24, 20, 28, 20], fill: C.white });
  sheet.cornerRadius = 0; sheet.topLeftRadius = 28; sheet.topRightRadius = 28;
  put(body, sheet, 'FILL', true);
  put(sheet, pillbox([1, 2]));
  put(sheet, voice('正在朗读：“该吃药了，请按绿色的接听键”'));
  spacer(sheet);
  const answer = box('接听', { gap: 6, cross: 'CENTER' });
  put(sheet, answer);
  // 响铃中的波纹：三圈由浅到深，中间是接听键
  const pulse = figma.createFrame();
  pulse.name = '响铃波纹';
  pulse.resize(140, 140);
  pulse.fills = [];
  pulse.clipsContent = false;
  for (const [d, a] of [[140, 0.08], [118, 0.14], [100, 0.22]]) {
    const e = figma.createEllipse();
    e.name = '波纹';
    e.resize(d, d);
    e.x = (140 - d) / 2; e.y = (140 - d) / 2;
    e.fills = [{ type: 'SOLID', color: rgb(C.green), opacity: a }];
    pulse.appendChild(e);
  }
  const ac = circ('接听键', 88, C.green, ico('phone', C.white, 40));
  ac.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0.53, b: 0.35, a: 0.3 }, offset: { x: 0, y: 8 }, radius: 20, spread: 0, visible: true, blendMode: 'NORMAL' }];
  pulse.appendChild(ac);
  ac.x = 26; ac.y = 26;
  put(answer, pulse, null);
  link(ac, 'Guide');
  put(answer, txt('接听', 'P_h2', C.text, 'CENTER'), 'HUG');
  const later = box('现在不方便吃', { dir: 'HORIZONTAL', gap: 4, pad: [4, 8, 4, 8], cross: 'CENTER' });
  put(answer, later, 'HUG');
  put(later, txt('现在不方便吃？', 'P_bodyB', C.brand), 'HUG');
  put(later, ico('right', C.brand, 22), null);
  link(later, 'Later');
  link(put(sheet, btn('我需要帮忙', 'warnLine', 'P_btn', 60)), 'Help');

  // ② 吃药指引
  ({ s, body } = screen('Guide', '父母 ② 吃药指引', 1, Y, { parent: true, nav: '吃药指引', right: tag('再听一遍', 'brand', true, 'speaker'),
    note: '同一时刻多种药按“饭前 → 随餐 → 饭后 → 睡前”排先后；用“第几格、什么颜色”代替药名术语。底部提示：说“吃好了”也能确认。' }));
  const prog = col(body, '进度', 8);
  put(prog, txt('第 1 种，共 2 种', 'P_small', C.text2));
  const seg = row(prog, '进度条', 6);
  for (const c of [C.brand, C.brandLight2]) {
    const r = figma.createRectangle(); r.resize(10, 6); r.cornerRadius = 3; r.fills = solid(c);
    seg.appendChild(r); r.layoutSizingHorizontal = 'FILL';
  }
  const c1 = card('第 1 种药', { pad: 20, gap: 14 });
  put(body, c1);
  put(c1, tag('吃饭时吃', 'success', true), 'HUG');
  const vis = row(c1, '药的样子', 16);
  const photo = fixed(box('药盒照片（可替换为实拍）', { fill: C.brandLight2, radius: 10, align: 'CENTER', cross: 'CENTER', dir: 'HORIZONTAL', gap: 8 }), 104, 72);
  put(vis, photo, null);
  const boxShape = figma.createRectangle(); boxShape.name = '蓝色药盒'; boxShape.resize(40, 28); boxShape.cornerRadius = 4; boxShape.fills = solid(C.brand);
  photo.appendChild(boxShape);
  const pill = figma.createEllipse(); pill.name = '白色圆片'; pill.resize(26, 26); pill.fills = solid(C.white); pill.strokes = solid(C.text2); pill.strokeWeight = 1.5;
  photo.appendChild(pill);
  const vt = col(vis, '说明', 2);
  put(vt, txt('蓝色盒子', 'P_bodyB'));
  put(vt, txt('白色圆片', 'P_small', C.text2));
  divider(c1);
  fact(c1, '在哪', '药盒第 1 格（贴着 1 号）');
  fact(c1, '吃几片', '1 片');
  fact(c1, '怎么吃', '和早饭一起吃，温水送服');
  const c2 = card('第 2 种药', { dir: 'HORIZONTAL', cross: 'CENTER', gap: 12 });
  put(body, c2);
  put(c2, circ('序号', 40, C.gray, txt('2', 'P_bodyB', C.text2, 'CENTER')), null);
  const c2t = col(c2, '文字');
  put(c2t, txt('饭后吃 · 第 2 格', 'P_bodyB'));
  put(c2t, txt('1 片 · 黄色小长片', 'P_small', C.text2));
  put(c2, tag('下一种', 'gray', true), 'HUG');
  spacer(body);
  link(put(body, btn('我吃好了', 'success', 'P_btn', 64, 'check')), 'Confirm');
  const hint = row(body, '也可以说', 8);
  hint.primaryAxisAlignItems = 'CENTER';
  put(hint, ico('mic', C.brand, 22), null);
  put(hint, txt('也可以直接说“吃好了”', 'P_small', C.brand), 'HUG');
  link(hint, 'CloseLid');
  link(put(body, btn('我需要帮忙', 'warnLine', 'P_btn', 60)), 'Help');

  // ③ 再确认一次
  ({ s, body } = screen('Confirm', '父母 ③ 再确认一次', 2, Y, { parent: true, nav: '确认一下',
    note: '二次确认防误按；列出刚才的药，让“确认”有具体对象。确认后子女端立刻显示“妈妈自己确认”。' }));
  spacer(body);
  const q = col(body, '问题', 14);
  q.counterAxisAlignItems = 'CENTER';
  put(q, circ('确认图标', 96, C.greenLight, ico('check', C.green, 48, 2.4)), null);
  put(q, txt('您都吃好了吗？', 'P_h1', C.text, 'CENTER'));
  const list = card('刚才的药', { gap: 0, pad: [4, 20, 4, 20] });
  put(body, list);
  for (const [i, s2] of [['1', '第 1 格 · 降糖药 · 1 片'], ['2', '第 2 格 · 降压药 · 1 片']]) {
    const r = box('药 ' + i, { dir: 'HORIZONTAL', gap: 12, pad: [14, 0, 14, 0], cross: 'CENTER' });
    if (i === '1') bottomLine(r);
    put(list, r);
    put(r, txt(s2, 'P_body'));
    put(r, ico('check', C.green, 24, 2.4), null);
  }
  put(body, voice('正在朗读：“您都吃好了吗？”'));
  spacer(body);
  link(put(body, btn('都吃好了', 'success', 'P_btn', 64, 'check')), 'ChildHome');
  link(put(body, btn('还没有，回去看看', 'line', 'P_btn', 60)), 'Guide');

  // ④ 我需要帮忙
  ({ s, body, nav } = screen('Help', '父母 ④ 我需要帮忙', 3, Y, { parent: true, nav: '我需要帮忙', back: true,
    note: '求助不用等超时，按下就通知子女；序号 + 朗读，不识字也能选。' }));
  link(nav.left, 'Guide');
  const hh = col(body, '标题区', 4);
  put(hh, txt('需要什么帮助？', 'P_h1'));
  put(hh, txt('按号码，或者直接说出来', 'P_small', C.text2));
  const cells = card('求助选项', { gap: 0, pad: 0 });
  put(body, cells);
  put(cells, helpCell(1, '找不到药'));
  put(cells, helpCell(2, '不知道怎么吃'));
  link(put(cells, helpCell(3, '记不清吃没吃')), 'NotSure');
  put(cells, helpCell(4, '让孩子给我打电话', true));
  put(body, voice('正在朗读：“第 1，找不到药；第 2，不知道怎么吃……”'));
  spacer(body);
  link(put(body, btn('返回', 'line', 'P_btn', 60)), 'Guide');

  // ⑤ 记不清吃没吃
  ({ s, body, nav } = screen('NotSure', '父母 ⑤ 记不清吃没吃', 4, Y, { parent: true, nav: '我需要帮忙', back: true,
    note: '最危险的是重复服药：先让老人停下，补不补吃由家人决定，产品不替他们判断。' }));
  link(nav.left, 'Help');
  const warn = card('先别吃', { fill: C.orangeLight, pad: 20, gap: 10 });
  put(body, warn);
  put(warn, circ('提醒图标', 52, C.white, ico('alert', C.orange, 30)), null);
  put(warn, txt('先不要再吃这一次的药', 'P_h1'));
  put(warn, txt('已经告诉女儿，她马上给您打电话。', 'P_body', C.text));
  const tip = card('等电话时', { gap: 12 });
  put(body, tip);
  put(tip, txt('等电话的时候，看看第 1、2 格里的药还在不在。', 'P_body'));
  put(tip, pillbox([1, 2]));
  put(body, voice('正在朗读：“先不要再吃这一次的药……”'));
  spacer(body);
  link(put(body, btn('好的，我等电话', 'primary', 'P_btn', 64)), 'ChildHelp');

  // ⑥ 手机追问（降低“忘按确认”的误报）
  ({ s, body } = screen('CloseLid', '父母 ⑥ 手机追问', 5, Y, { parent: true, nav: '确认一下',
    note: '针对最关键的假设“老人会忘按确认”：看完指引 10 分钟还没确认，手机主动问一句，说“吃好了”即可确认。追问不能太早，并说清是哪一顿的药。' }));
  put(body, pillbox([1, 2], { tag: '早上 8 点的药', tagTheme: 'success' }));
  put(body, txt('早上 8 点的药，\n吃好了吗？', 'P_h1'));
  const listen = col(body, '语音确认', 10);
  listen.counterAxisAlignItems = 'CENTER';
  const micc = circ('正在听', 96, C.brandLight, ico('mic', C.brand, 44));
  micc.strokes = solid(C.brandLight2); micc.strokeWeight = 8; micc.strokeAlign = 'OUTSIDE';
  put(listen, micc, null);
  put(listen, txt('正在听：直接说“吃好了”就行', 'P_bodyB', C.text, 'CENTER'), 'HUG');
  const orBtn = box('或者按按钮', { gap: 4, pad: [12, 16, 12, 16], fill: C.white, radius: 12, cross: 'CENTER' });
  put(body, orBtn);
  put(orBtn, txt('不想说话也没关系', 'P_bodyB', C.text, 'CENTER'), 'HUG');
  put(orBtn, txt('按下面的绿色按钮，一样能告诉女儿', 'P_small', C.text2, 'CENTER'), 'HUG');
  spacer(body);
  link(put(body, btn('吃好了', 'success', 'P_btn', 64, 'check')), 'ChildHome');
  link(put(body, btn('还没吃', 'line', 'P_btn', 60)), 'Guide');

  // ⑦ 第一次使用：父母本人同意
  ({ s, body } = screen('Consent', '父母 ⑦ 第一次：同意分享', 6, Y, { parent: true, nav: '开始使用',
    note: '服药记录属于敏感个人信息，必须父母本人单独同意；写清楚分享什么、不分享什么，随时可以关掉。没有同意就不开始记录。' }));
  put(body, txt('女儿想知道\n您有没有按时吃药', 'P_h1'));
  const share = card('会分享', { gap: 12, pad: 16 });
  put(body, share);
  put(share, txt('同意后，女儿能看到：', 'P_small', C.text2));
  bullet(share, 'check', C.green, '每次吃药的时间', 'P_bodyB');
  bullet(share, 'check', C.green, '有没有确认吃好了', 'P_bodyB');
  bullet(share, 'check', C.green, '您按了“我需要帮忙”', 'P_bodyB');
  const noShare = card('不分享', { gap: 12, pad: 16 });
  put(body, noShare);
  put(noShare, txt('不会分享：', 'P_small', C.text2));
  bullet(noShare, 'close', C.text2, '您在哪里', 'P_body');
  bullet(noShare, 'close', C.text2, '通话和聊天内容', 'P_body');
  put(body, txt('以后随时可以在设置里关掉。', 'P_small', C.text2));
  spacer(body);
  link(put(body, btn('同意', 'success', 'P_btn', 64, 'check')), 'ChildHome');
  put(body, btn('先不用', 'line', 'P_btn', 60));

  // ⑧ 每周装药
  ({ s, body } = screen('RefillParent', '父母 ⑧ 每周装药', 7, Y, { parent: true, nav: '装药',
    note: '装错药是整个闭环的隐患：逐格显示、逐格朗读要放什么、放几片；装完拍一张照片给子女核对。' }));
  const rp = col(body, '进度', 8);
  put(rp, txt('第 1 格，共 3 格', 'P_small', C.text2));
  const rseg = row(rp, '进度条', 6);
  for (const c of [C.brand, C.brandLight2, C.brandLight2]) {
    const r = figma.createRectangle(); r.resize(10, 6); r.cornerRadius = 3; r.fills = solid(c);
    rseg.appendChild(r); r.layoutSizingHorizontal = 'FILL';
  }
  put(body, pillbox([1], { tag: '正在装第 1 格' }));
  const what = card('要放的药', { pad: 20, gap: 10 });
  put(body, what);
  put(what, tag('降糖药 · 蓝色盒子', 'brand', true), 'HUG');
  put(what, txt('放 14 片白色圆片', 'P_h2'));
  put(what, txt('早饭、午饭各吃 1 片，够吃一周', 'P_body', C.text2));
  put(body, voice('正在朗读：“第 1 格，放 14 片蓝色盒子里的白色圆片”'));
  spacer(body);
  put(body, btn('放好了，下一格', 'success', 'P_btn', 64, 'check'));
  link(put(body, btn('全部装好，拍照给女儿', 'line', 'P_btn', 60, 'camera')), 'RefillCheck');

  // ⑨ 现在不方便吃：随餐药还没开饭 / 人不在家
  ({ s, body, nav } = screen('Later', '父母 ⑨ 现在不方便吃', 8, Y, { parent: true, nav: '待会再吃', back: true,
    note: '来自模拟推演：随餐药接听时常常还没开饭，或者人不在家。给一个“待会再吃”的出口，延后期间不算“没确认”，避免误报；子女端只显示“妈妈说待会再吃”。' }));
  link(nav.left, 'Main');
  put(body, txt('什么时候再提醒您？', 'P_h1'));
  const opts = card('延后选项', { gap: 0, pad: 0 });
  put(body, opts);
  const o1 = box('还没开饭', { dir: 'HORIZONTAL', gap: 14, pad: [16, 16, 16, 16], cross: 'CENTER' });
  bottomLine(o1);
  put(opts, o1);
  put(o1, circ('图标', 44, C.greenLight, txt('饭', 'P_bodyB', C.green, 'CENTER')), null);
  const o1t = col(o1, '文字', 2);
  put(o1t, txt('还没开饭', 'P_bodyB'));
  put(o1t, txt('开饭了再提醒我 · 20 分钟后', 'P_small', C.text2));
  put(o1, ico('right', C.text2, 24), null);
  const o2 = box('我不在家', { gap: 12, pad: [16, 16, 16, 16] });
  put(opts, o2);
  const o2h = row(o2, '标题', 14);
  put(o2h, circ('图标', 44, C.brandLight, ico('home', C.brand, 24)), null);
  const o2t = col(o2h, '文字', 2);
  put(o2t, txt('我不在家', 'P_bodyB'));
  put(o2t, txt('回去再吃，多久后提醒？', 'P_small', C.text2));
  const choices = row(o2, '时间选项', 8);
  for (const c of ['30 分钟', '1 小时', '2 小时']) {
    const b = btn(c, c === '1 小时' ? 'primary' : 'light', 'P_small', 48);
    put(choices, b);
  }
  const tell = card('女儿会看到', { fill: C.brandLight, gap: 6, pad: 16 });
  put(body, tell);
  put(tell, txt('女儿那边只会看到：', 'P_small', C.text2));
  put(tell, txt('“妈妈说不在家，10:00 再提醒”', 'P_bodyB'));
  put(tell, txt('不会说您没吃药。', 'P_small', C.text2));
  put(body, voice('正在朗读：“还没开饭，按第 1 个；不在家，按第 2 个”'));
  spacer(body);
  link(put(body, btn('现在就吃', 'success', 'P_btn', 64)), 'Guide');
}

// ---------- 子女端 9 屏 ----------

function buildChild() {
  const Y = ROW_K;
  let s, body, nav, tab;

  // ① 今天
  const gear = box('设置', { pad: 4 });
  put(gear, ico('gear', C.text, 22), null);
  ({ s, body, nav, tab } = screen('ChildHome', '子女 ① 今天', 0, Y, { nav: '安心药箱', right: gear, tab: '今天',
    note: '每条记录都写清楚“谁、怎么确认的”（自己确认 / 电话确认），只写看到的事实，不写推断。药快吃完时提前提醒补药。' }));
  link(gear, 'Settings');
  const sum = card('妈妈今天', { gap: 12 });
  put(body, sum);
  const who = row(sum, '概览', 12);
  put(who, avatar('妈', 48), null);
  const wt = col(who, '文字');
  put(wt, txt('妈妈今天', 'K_h1'));
  put(wt, txt('10 月 22 日 周四 · 妈妈手机在线', 'K_small', C.text2));
  put(who, ring(1 / 3, '1/3'), null);
  divider(sum);
  const stats = box('统计', { dir: 'HORIZONTAL', align: 'SPACE_BETWEEN', pad: [0, 12, 0, 12] });
  put(sum, stats);
  stat(stats, '1', '已确认', C.green);
  stat(stats, '2', '待提醒');
  stat(stats, '0', '求助');
  const noti = card('通知：已确认', { fill: C.greenLight, dir: 'HORIZONTAL', gap: 12, cross: 'CENTER', pad: 14 });
  put(body, noti);
  put(noti, circ('已确认', 32, C.green, ico('check', C.white, 18, 2.4)), null);
  const nt = col(noti, '文字');
  put(nt, txt('妈妈 08:03 自己确认吃好了', 'K_bodyB'));
  put(nt, txt('降糖药、降压药各 1 片 · 妈妈自己确认', 'K_small', C.text2));
  const sh = box('小标题', { dir: 'HORIZONTAL', cross: 'CENTER', pad: [4, 4, 0, 4] });
  put(body, sh);
  put(sh, txt('今日安排', 'K_h2'));
  put(sh, txt('共 3 次', 'K_small', C.text2), 'HUG');
  const sched = card('今日安排', { gap: 0, pad: 0 });
  put(body, sched);
  schedCell(sched, '08:00', '早上', '降糖药、降压药', tag('自己确认 08:03', 'success', false, 'check'));
  schedCell(sched, '12:30', '中午', '降糖药', tag('待提醒', 'gray'));
  schedCell(sched, '21:00', '睡前', '降脂药', tag('待提醒', 'gray'), true);
  const stock = card('余量提醒', { fill: C.orangeLight, dir: 'HORIZONTAL', gap: 12, cross: 'CENTER', pad: 14 });
  put(body, stock);
  put(stock, ico('pill', C.orange, 22), null);
  const stt = col(stock, '文字');
  put(stt, txt('降糖药还剩 3 天', 'K_bodyB'));
  put(stt, txt('按每天 2 片推算 · 周日装药前记得补', 'K_small', C.text2));
  put(stock, ico('right', C.text2, 18), null);
  link(stock, 'RefillCheck');
  link(tab.items['药品'], 'Meds'); link(tab.items['这一周'], 'Week');

  // ② 还没确认
  ({ s, body, nav } = screen('ChildAlert', '子女 ② 还没确认', 1, Y, { nav: '提醒详情', back: true,
    note: '写“还没确认”而不是“没吃”；先给行动（打电话），电话后可设 15 分钟后再响铃，或记为“电话确认”。' }));
  link(nav.left, 'ChildHome');
  const al = card('通知：还没确认', { fill: C.orangeLight, dir: 'HORIZONTAL', gap: 12, pad: 14 });
  put(body, al);
  put(al, ico('alert', C.orange, 22), null);
  const alt = col(al, '文字', 2);
  put(alt, txt('08:30 妈妈还没确认早上的药', 'K_bodyB'));
  put(alt, txt('提醒已经响了 2 次。还没确认不等于没吃，先打个电话问问。', 'K_body', C.text2));
  sectionTitle(body, '发生了什么');
  const tl = card('时间线', { gap: 0 });
  put(body, tl);
  timeline(tl, [['08:00', '第 1 次响铃，没有接'], ['08:15', '第 2 次响铃，没有接'], ['08:30', '到了家里约定的 30 分钟，通知你', true]]);
  const acts = row(body, '操作', 12);
  put(acts, btn('给妈妈打电话', 'primary', 'K_btn', 48, 'phone'));
  put(acts, btn('发短信', 'light', 'K_btn', 48, 'message'));
  sectionTitle(body, '打完电话后');
  const after = card('电话后', { gap: 0, pad: 0 });
  put(body, after);
  navCell(after, '妈妈还没吃', '15 分钟后妈妈手机再响铃，仍未确认会再通知你');
  navCell(after, '妈妈说吃过了', '记为“电话确认”，和“自己确认”分开显示', true);

  // ③ 妈妈求助
  ({ s, body, nav } = screen('ChildHelp', '子女 ③ 妈妈求助', 2, Y, { nav: '妈妈求助', back: true,
    note: '同步显示妈妈那边正在看到的内容，子女知道妈妈已被要求“先别吃”；给出核对步骤，但补不补吃由家人决定。' }));
  link(nav.left, 'ChildHome');
  const hb = card('通知：求助', { fill: C.orangeLight, gap: 8, pad: 14 });
  put(body, hb);
  const hbr = row(hb, '标题', 8);
  put(hbr, ico('alert', C.orange, 20), null);
  put(hbr, txt('08:06 妈妈按了“我需要帮忙”', 'K_bodyB'));
  put(hb, tag('她选了：3 记不清吃没吃', 'warning'), 'HUG');
  const shown = card('妈妈那边', { gap: 8 });
  put(body, shown);
  put(shown, txt('妈妈的手机上正在显示', 'K_small', C.text2));
  const mini = box('预览', { dir: 'HORIZONTAL', gap: 8, pad: 12, fill: C.orangeLight, radius: 8, cross: 'CENTER' });
  put(shown, mini);
  put(mini, ico('alert', C.orange, 18), null);
  put(mini, txt('先不要再吃这一次的药，等女儿打电话', 'K_bodyB'));
  sectionTitle(body, '建议这样做');
  const steps = card('建议步骤', { gap: 12 });
  put(body, steps);
  stepRow(steps, 1, '先请妈妈看看药盒第 1、2 格，药还在不在');
  stepRow(steps, 2, '药还在，再决定要不要补吃；拿不准就先别吃');
  stepRow(steps, 3, '需要时问医生或药师');
  const facts = card('参考信息', { gap: 6, fill: C.brandLight });
  put(body, facts);
  put(facts, txt('参考：08:00 的提醒妈妈 08:01 接听了', 'K_bodyB', C.brand));
  put(facts, txt('接听不代表吃了，只供电话里核对用。', 'K_small', C.text2));
  spacer(body);
  put(body, btn('给妈妈打电话', 'primary', 'K_btn', 48, 'phone'));

  // ④ 录入新药
  ({ s, body, nav, tab } = screen('Meds', '子女 ④ 录入新药', 3, Y, { nav: '添加药品', back: true, tab: '药品',
    note: 'AI 只提取原话里明确的内容，并用蓝字标出来源；原话没说的标橙色让子女补，不猜剂量和时间。保存前必须人工核对。' }));
  link(nav.left, 'ChildHome');
  const inp = card('说出用法', { gap: 12 });
  put(body, inp);
  const ir = row(inp, '标题行', 10);
  const irt = col(ir, '文字');
  put(irt, txt('说出或粘贴用法', 'K_h2'));
  put(irt, txt('也可以拍药盒或处方', 'K_small', C.text2));
  put(ir, circ('拍药盒或处方', 44, C.brandLight, ico('camera', C.brand, 22)), null);
  put(ir, circ('语音输入', 44, C.brand, ico('mic', C.white, 22)), null);
  const quote = box('原话', { pad: 12, fill: C.bg, radius: 8 });
  put(inp, quote);
  const qs = '“这是降脂药，每次一片，晚上九点吃，睡前用温水送服”';
  const qt = txt(qs, 'K_body', C.text, 'LEFT', true);
  for (const ph of ['降脂药', '一片', '晚上九点', '睡前用温水送服']) {
    const i = qs.indexOf(ph);
    if (i >= 0) { qt.setRangeFills(i, i + ph.length, solid(C.brand)); qt.setRangeFontName(i, i + ph.length, F.b); }
  }
  put(quote, qt);
  const ai = row(body, '草稿说明', 8);
  put(ai, tag('AI 整理的草稿', 'brand', false, 'sparkle'), 'HUG');
  put(ai, txt('蓝字是从原话里找到的；没提到的不猜', 'K_small', C.text2));
  const form = card('药品信息', { gap: 0, pad: 0 });
  put(body, form);
  formRow(form, '药名', '降脂药');
  formRow(form, '每次', '1 片');
  formRow(form, '时间', '每天 21:00');
  formRow(form, '吃法', '睡前，温水送服');
  formRow(form, '放在', '请选择第几格', '原话没提到，请补充', true);
  const up = row(body, '药盒样子', 12);
  uploadTile(up, 'camera', '拍药盒照片');
  uploadTile(up, 'shapes', '选颜色和形状');
  put(body, btn('核对无误，保存', 'primary', 'K_btn', 48));
  link(tab.items['今天'], 'ChildHome'); link(tab.items['这一周'], 'Week');

  // ⑤ 这一周
  ({ s, body, nav, tab } = screen('Week', '子女 ⑤ 这一周的情况', 4, Y, { nav: '这一周', tab: '这一周',
    note: '规则统计，不是大模型：按确认来源统计，找出“周末早上要再提醒”这类规律；建议必须子女点确认才生效。大模型只负责把结论写成好懂的话。' }));
  const wh = row(body, '标题行', 8);
  const wht = col(wh, '文字');
  put(wht, txt('10 月 16 日 – 22 日', 'K_h2'));
  put(wht, txt('示例记录 · 本人确认 19/21', 'K_small', C.text2));
  put(wh, tag('规则统计，不是大模型', 'gray'), 'HUG');
  const grid = card('一周记录', { gap: 8 });
  put(body, grid);
  const days = ['五', '六', '日', '一', '二', '三', '四'];
  const NAMES = { '1': '自己确认', '2': '第 2 次提醒后确认', p: '电话确认', o: '求助' };
  const rows = [['', days], ['早上', ['1', '2', '2', '1', '1', '1', '1']], ['中午', ['1', '1', '1', '1', 'o', '1', '1']], ['睡前', ['1', '1', '1', '1', '1', 'p', '1']]];
  for (const [label, cells] of rows) {
    const r = row(grid, label || '星期', 6);
    fixedText(r, label, 'K_small', C.text2, 34);
    for (let i = 0; i < 7; i++) {
      const v = cells[i];
      const isHead = !label;
      const bg = isHead ? null : { '1': C.greenLight, '2': C.orangeLight, p: C.brandLight, o: C.gray }[v];
      const cell = fixed(box(isHead ? '周' + v : days[i] + '：' + NAMES[v], { fill: bg, radius: 6, align: 'CENTER', cross: 'CENTER' }), 30, isHead ? 20 : 30);
      put(r, cell, 'FILL');
      if (isHead) put(cell, txt(v, 'K_small', C.text2, 'CENTER'), 'HUG');
      else if (v === 'p') put(cell, ico('phone', C.brand, 16), null);
      else put(cell, txt({ '1': '√', '2': '2', o: '○' }[v], 'K_bodyB', { '1': C.green, '2': C.orange, o: C.text2 }[v], 'CENTER'), 'HUG');
    }
  }
  const legend = box('图例', { dir: 'HORIZONTAL', gap: 6, pad: [0, 2, 0, 2] });
  legend.layoutWrap = 'WRAP'; legend.counterAxisSpacing = 6;
  put(body, legend);
  put(legend, tag('√ 自己确认', 'success'), 'HUG');
  put(legend, tag('2 第 2 次提醒后确认', 'warning'), 'HUG');
  put(legend, tag('电话确认', 'brand', false, 'phone'), 'HUG');
  put(legend, tag('○ 求助', 'gray'), 'HUG');
  const ins = card('发现与建议', { fill: C.brandLight, gap: 8 });
  put(body, ins);
  const ih = row(ins, '标题', 6);
  put(ih, ico('bulb', C.brand, 20), null);
  put(ih, txt('发现', 'K_h2', C.brand));
  put(ins, txt('周末早上 2/2 天要第 2 次提醒才确认，工作日 0/5 天。', 'K_body'));
  put(ins, txt('要把周末早上的提醒改到 9:00 吗？', 'K_bodyB'));
  const br = box('按钮', { dir: 'HORIZONTAL', gap: 12, pad: [4, 0, 0, 0] });
  put(ins, br);
  put(br, btn('改到 9:00', 'primary', 'K_btn', 40));
  put(br, btn('先不改', 'line', 'K_btn', 40));
  link(tab.items['今天'], 'ChildHome'); link(tab.items['药品'], 'Meds');

  // ⑥ 妈妈手机离线
  ({ s, body, nav } = screen('ChildOffline', '子女 ⑥ 妈妈手机离线', 5, Y, { nav: '提醒详情', back: true,
    note: '手机故障 ≠ 没吃：离线单独提示，提醒可能没响，建议直接打个电话，避免子女误判、也避免漏提醒。' }));
  link(nav.left, 'ChildHome');
  const off = card('通知：妈妈手机离线', { fill: C.gray, dir: 'HORIZONTAL', gap: 12, pad: 14 });
  put(body, off);
  put(off, ico('offline', C.text2, 22), null);
  const oft = col(off, '文字', 2);
  put(oft, txt('妈妈手机离线 1 小时 50 分', 'K_bodyB'));
  put(oft, txt('这不代表妈妈没吃药，只是手机上的提醒可能没有响。', 'K_body', C.text2));
  sectionTitle(body, '发生了什么');
  const otl = card('时间线', { gap: 0 });
  put(body, otl);
  timeline(otl, [['06:10', '妈妈手机最后一次在线，电量 5%'], ['08:00', '早上的提醒没有送到妈妈手机', true], ['08:01', '已通知你，建议打个电话']]);
  sectionTitle(body, '可能的原因');
  const why = card('原因', { gap: 12 });
  put(body, why);
  stepRow(why, 1, '手机没电了，请妈妈充上电');
  stepRow(why, 2, '家里的网络断了');
  stepRow(why, 3, '手机关机或开了飞行模式');
  spacer(body);
  const oacts = row(body, '操作', 12);
  put(oacts, btn('给妈妈打电话', 'primary', 'K_btn', 48, 'phone'));
  put(oacts, btn('发短信', 'light', 'K_btn', 48, 'message'));

  // ⑦ 装药核对 + 余量
  ({ s, body, nav } = screen('RefillCheck', '子女 ⑦ 装药核对', 6, Y, { nav: '本周装药', back: true,
    note: '照片 + 清单逐格核对：AI 比对照片只作参考，看不清就请妈妈重拍，不替子女判断“对没对”。余量按每日用量推算，提前提醒补药。' }));
  link(nav.left, 'ChildHome');
  const pc = card('妈妈拍的照片', { gap: 10 });
  put(body, pc);
  const pch = row(pc, '标题', 8);
  const pct = col(pch, '文字');
  put(pct, txt('妈妈 10 月 18 日 19:20 装好了', 'K_bodyB'));
  put(pct, txt('每周日装一次', 'K_small', C.text2));
  put(pch, tag('AI 比对 · 仅供参考', 'brand', false, 'sparkle'), 'HUG');
  put(pc, pillbox([], { name: '妈妈拍的药盒照片（示意）', title: '照片', tag: '19:20 拍摄', tagTheme: 'gray' }));
  const chk = card('逐格核对', { gap: 0, pad: 0 });
  put(body, chk);
  navCell(chk, '第 1 格 · 降糖药', '应放 14 片白色圆片', false, tag('对上了', 'success', false, 'check'));
  navCell(chk, '第 2 格 · 降压药', '应放 7 片黄色小长片', false, tag('对上了', 'success', false, 'check'));
  navCell(chk, '第 3 格 · 降脂药', '应放 7 片，照片里看不清', false, tag('请确认', 'warning'));
  navCell(chk, '第 4 格', '空着', true, tag('不用放', 'gray'));
  const st2 = card('余量', { fill: C.orangeLight, dir: 'HORIZONTAL', gap: 12, cross: 'CENTER', pad: 14 });
  put(body, st2);
  put(st2, ico('pill', C.orange, 22), null);
  const st2t = col(st2, '文字');
  put(st2t, txt('降糖药还剩 3 天', 'K_bodyB'));
  put(st2t, txt('下次装药前需要补', 'K_small', C.text2));
  put(st2, btn('提醒我买药', 'light', 'K_btn', 36), 'HUG');
  spacer(body);
  const racts = row(body, '操作', 12);
  put(racts, btn('都对，确认', 'primary', 'K_btn', 48, 'check'));
  put(racts, btn('请妈妈重拍', 'light', 'K_btn', 48, 'camera'));

  // ⑧ 家庭与提醒设置
  ({ s, body, nav } = screen('Settings', '子女 ⑧ 提醒设置', 7, Y, { nav: '提醒设置', back: true,
    note: '通知分级：正常时每晚一条汇总，异常按顺序升级给家人，避免几个人同时打电话；夜间免打扰，但求助和手机离线除外。等待时间是家庭沟通参数，不是医学安全时间。' }));
  link(nav.left, 'ChildHome');
  sectionTitle(body, '没确认时');
  const s1 = card('没确认时', { gap: 0, pad: 0 });
  put(body, s1);
  navCell(s1, '再响一次铃', '没接听时', false, txt('15 分钟后', 'K_body', C.text2));
  navCell(s1, '通知家人', '仍没确认时', true, segmented(['30 分钟', '60 分钟'], 0));
  sectionTitle(body, '通知谁（按顺序）');
  const s2 = card('通知顺序', { gap: 0, pad: 0 });
  put(body, s2);
  for (const [i, ch2, name, rule, t2] of [[1, '我', '我（女儿）', '立即通知', tag('主要联系人', 'brand')], [2, '哥', '哥哥', '我 15 分钟没处理时通知', null], [3, '王', '王阿姨（保姆）', '哥哥也没处理时通知', null]]) {
    const r = box('第' + i + '位', { dir: 'HORIZONTAL', gap: 12, pad: [10, 16, 10, 16], cross: 'CENTER' });
    bottomLine(r);
    put(s2, r);
    put(r, avatar(ch2, 36), null);
    const c = col(r, '文字');
    put(c, txt(name, 'K_bodyB'));
    put(c, txt(rule, 'K_small', C.text2));
    if (t2) put(r, t2, 'HUG');
  }
  const add = box('添加家人', { dir: 'HORIZONTAL', gap: 6, pad: [12, 16, 12, 16], cross: 'CENTER' });
  put(s2, add);
  put(add, ico('plus', C.brand, 18), null);
  put(add, txt('添加家人', 'K_bodyB', C.brand));
  sectionTitle(body, '少打扰');
  const s3 = card('少打扰', { gap: 0, pad: 0 });
  put(body, s3);
  navCell(s3, '正常时只发每晚汇总', '每晚 21:30 一条', false, toggle(true));
  navCell(s3, '22:00–07:00 免打扰', '求助和手机离线除外', true, toggle(true));
  const s4 = card('妈妈的播报', { gap: 0, pad: 0 });
  put(body, s4);
  navCell(s4, '妈妈那边的播报', '普通话 · 大音量 · 可选方言', true);

  // ⑨ 第一次使用
  ({ s, body, nav } = screen('Onboarding', '子女 ⑨ 第一次使用', 8, Y, { nav: '开通安心药箱',
    note: '三步开通：绑定妈妈的手机 → 邀请家人 → 妈妈本人同意。妈妈不同意，就不开始记录。' }));
  const stepper = box('步骤条', { dir: 'HORIZONTAL', gap: 6, cross: 'CENTER', pad: [4, 4, 4, 4] });
  put(body, stepper);
  const stepDefs = [['绑定妈妈手机', 'done'], ['邀请家人', 'now'], ['妈妈同意', 'todo']];
  stepDefs.forEach(([label, st], i) => {
    const it = box('步骤/' + label, { dir: 'HORIZONTAL', gap: 6, cross: 'CENTER' });
    put(stepper, it, 'HUG');
    const fill = st === 'done' ? C.green : st === 'now' ? C.brand : C.gray;
    put(it, circ('序号', 24, fill, st === 'done' ? ico('check', C.white, 14, 2.6) : txt(String(i + 1), 'K_small', st === 'todo' ? C.text2 : C.white, 'CENTER')), null);
    put(it, txt(label, st === 'now' ? 'K_bodyB' : 'K_body', st === 'todo' ? C.text2 : C.text), 'HUG');
    if (i < stepDefs.length - 1) {
      const l = figma.createRectangle(); l.resize(10, 2); l.fills = solid(st === 'done' ? C.green : C.line);
      stepper.appendChild(l); l.layoutSizingHorizontal = 'FILL';
    }
  });
  const dev = card('妈妈的手机', { dir: 'HORIZONTAL', gap: 12, cross: 'CENTER' });
  put(body, dev);
  put(dev, circ('手机图标', 44, C.brand, ico('phone', C.white, 22)), null);
  const devt = col(dev, '文字');
  put(devt, txt('妈妈的手机 138****2041', 'K_bodyB'));
  put(devt, txt('已开启提醒和语音朗读', 'K_small', C.text2));
  put(dev, tag('已绑定', 'success', false, 'check'), 'HUG');
  sectionTitle(body, '邀请家人一起照看');
  const fam = card('家人', { gap: 0, pad: 0 });
  put(body, fam);
  for (const [ch2, name, rule, t2] of [['妈', '妈妈', '用药的人', tag('需要她同意', 'warning')], ['哥', '哥哥', '一起照看', tag('已加入', 'success')], ['王', '王阿姨（保姆）', '白天在家', tag('邀请中', 'gray')]]) {
    const r = box(name, { dir: 'HORIZONTAL', gap: 12, pad: [10, 16, 10, 16], cross: 'CENTER' });
    bottomLine(r);
    put(fam, r);
    put(r, avatar(ch2, 36), null);
    const c = col(r, '文字');
    put(c, txt(name, 'K_bodyB'));
    put(c, txt(rule, 'K_small', C.text2));
    put(r, t2, 'HUG');
  }
  const add2 = box('添加家人', { dir: 'HORIZONTAL', gap: 6, pad: [12, 16, 12, 16], cross: 'CENTER' });
  put(fam, add2);
  put(add2, ico('plus', C.brand, 18), null);
  put(add2, txt('发邀请链接', 'K_bodyB', C.brand));
  const pv = card('妈妈会看到什么', { fill: C.brandLight, dir: 'HORIZONTAL', gap: 10, cross: 'CENTER', pad: 14 });
  put(body, pv);
  put(pv, ico('shield', C.brand, 22), null);
  const pvt = col(pv, '文字');
  put(pvt, txt('妈妈同意后才开始记录', 'K_bodyB'));
  put(pvt, txt('看看妈妈手机上会看到什么', 'K_small', C.brand));
  put(pv, ico('right', C.text2, 18), null);
  link(pv, 'Consent');
  const next = card('开通之后', { gap: 10 });
  put(body, next);
  put(next, txt('开通之后会怎样', 'K_h2'));
  stepRow(next, 1, '妈妈手机上会收到一页大字说明，她点“同意”才开始');
  stepRow(next, 2, '从下一次吃药提醒开始记录，之前的不补记');
  stepRow(next, 3, '任何一位家人都可以随时退出，妈妈也可以随时关掉');
  spacer(body);
  link(put(body, btn('发给妈妈确认', 'primary', 'K_btn', 48)), 'Consent');
}

// ---------- 规范与指标板 ----------

function table(parent, widths, header, rows) {
  const hr = box('表头', { dir: 'HORIZONTAL', gap: 24, pad: [0, 0, 10, 0] });
  bottomLine(hr);
  put(parent, hr);
  header.forEach((h, i) => fixedText(hr, h, 'K_small', C.text2, widths[i]));
  rows.forEach((cells, ri) => {
    const r = box('行 ' + (ri + 1), { dir: 'HORIZONTAL', gap: 24, pad: [14, 0, 14, 0], cross: 'CENTER' });
    if (ri < rows.length - 1) bottomLine(r);
    put(parent, r);
    cells.forEach((c, i) => {
      if (typeof c === 'string') fixedText(r, c, i === 1 ? 'K_bodyB' : 'K_body', C.text, widths[i]);
      else {
        const holder = fixed(box('单元格', { dir: 'HORIZONTAL', cross: 'CENTER' }), widths[i], 28);
        put(r, holder, null);
        put(holder, c, 'HUG');
      }
    });
  });
}
function board(name, x, y, w, title, sub) {
  const b = box(name, { gap: 16, pad: 32, fill: C.white, radius: 16 });
  b.counterAxisSizingMode = 'FIXED';
  b.resize(w, 100);
  b.primaryAxisSizingMode = 'AUTO';
  b.x = x; b.y = y;
  figma.currentPage.appendChild(b);
  shade(b);
  put(b, txt(title, 'K_h1'));
  put(b, txt(sub, 'K_body', C.text2));
  return b;
}
function buildSpecs() {
  const Y = ROW_SPEC;
  const st = board('规范：服药状态体系', 0, Y, 1640, '服药状态体系：只写看到的事实，不写推断',
    '子女端所有页面统一用这 6 种状态。“还没确认”不等于“没吃”；手机故障单独成一种状态，不和“没确认”混在一起。');
  table(st, [200, 150, 420, 300, 370],
    ['子女端显示', '状态', '什么时候出现', '子女该做什么', '会不会通知子女'],
    [
      [tag('自己确认 08:03', 'success', false, 'check'), '本人确认', '妈妈按了“吃好了”，或在手机追问时说了“吃好了”', '不用做什么', '默认并入每晚汇总，可改为实时'],
      [tag('电话确认', 'brand', false, 'phone'), '电话确认', '子女打电话后，选择“妈妈说吃过了”', '不用做什么', '不通知（是子女自己记的）'],
      [tag('待会再吃 · 10:00', 'brand'), '父母主动延后', '父母选了“还没开饭”或“我不在家”', '不用做什么', '不通知；到延后时间仍没确认，按“还没确认”处理'],
      [tag('求助中', 'warning'), '父母求助', '妈妈按了“我需要帮忙”并选了原因', '马上打电话；记不清时先请妈妈看药盒格子', '立即通知，不用等超时'],
      [tag('还没确认', 'warning', false, 'alert'), '未确认', '到约定时间还没有确认', '打电话；之后可设 15 分钟再响铃', '通知，按设置的顺序升级给家人'],
      [tag('手机离线', 'gray', false, 'offline'), '手机离线', '超过 30 分钟联系不上妈妈的手机', '打电话，请妈妈检查手机', '通知，并写明“提醒可能没响，不代表没吃”']
    ]);

  const mt = board('成功指标（待验证）', 1720, Y, 1000, '成功指标：先找 3–5 个家庭试用 2 周验证',
    '目标值都是假设，需要试用数据校准。护栏指标一旦越线，优先修复，不追求北极星。');
  table(mt, [90, 210, 330, 210],
    ['类型', '指标', '怎么算', '目标（假设）'],
    [
      [tag('北极星', 'brand'), '子女例行确认电话', '每周只为确认“吃没吃”打的电话次数，试用前后对比', '下降一半'],
      [tag('过程', 'gray'), '父母本人确认率', '本人确认次数 ÷ 提醒次数', '≥ 80%'],
      [tag('过程', 'gray'), '误报率', '实际吃了却被报“还没确认” ÷ 全部“还没确认”', '< 20%'],
      [tag('护栏', 'warning'), '重复服药事件', '因提醒或求助流程导致的重复吃药', '0 次'],
      [tag('护栏', 'warning'), '非紧急打扰', '子女每天收到的非紧急推送条数', '≤ 1 条（每晚汇总）']
    ]);
}

function rowTitle(s, sub, y) {
  const t = txt(s, 'P_h1');
  t.x = 0; t.y = y;
  figma.currentPage.appendChild(t);
  const d = txt(sub, 'P_small', C.text2);
  d.x = 0; d.y = y + 56;
  figma.currentPage.appendChild(d);
}

async function main() {
  F = await pickFont();
  await figma.loadFontAsync(F.r);
  await figma.loadFontAsync(F.b);
  const page = figma.createPage();
  page.name = '安心药箱 原型 ' + V;
  await figma.setCurrentPageAsync(page);
  page.backgrounds = [{ type: 'SOLID', color: rgb('#E9EBEF') }];
  setupVars();
  setupStyles();

  rowTitle('父母端 · 9 屏', '适老化：大字、语音、一页只做一个决定。①–⑤ 主流程，⑥ 降低误报，⑦ 首次同意，⑧ 每周装药，⑨ 现在不方便吃', ROW_P - 180);
  buildParent();
  rowTitle('子女端 · 9 屏', '一眼看清吃没吃，只在需要时介入。①–⑤ 主流程，⑥ 手机离线，⑦ 装药核对与余量，⑧ 通知分级，⑨ 第一次使用', ROW_K - 180);
  buildChild();
  rowTitle('规范与指标', '给研发、设计和测试对齐用', ROW_SPEC - 180);
  buildSpecs();

  await Promise.all(pending);
  let linkFails = 0;
  for (const [node, to] of links) {
    try {
      await node.setReactionsAsync([{
        trigger: { type: 'ON_CLICK' },
        actions: [{ type: 'NODE', destinationId: S[to].id, navigation: 'NAVIGATE', transition: null, preserveScrollPosition: false }]
      }]);
    } catch (e) { linkFails++; console.warn('跳转设置失败', e); }
  }
  try {
    page.flowStartingPoints = [
      { nodeId: S.Main.id, name: '① 按时吃药 / ③ 记不清' },
      { nodeId: S.ChildAlert.id, name: '② 忘了吃药（子女端）' },
      { nodeId: S.ChildOffline.id, name: '④ 妈妈手机离线' },
      { nodeId: S.RefillParent.id, name: '⑤ 每周装药' },
      { nodeId: S.Onboarding.id, name: '⑥ 第一次使用' },
      { nodeId: S.ChildHome.id, name: '子女端首页' }
    ];
  } catch (e) { console.warn(e); }

  figma.viewport.scrollAndZoomIntoView(page.children);
  figma.closePlugin('安心药箱原型 ' + V + ' 已生成：18 屏 + 2 张规范板' + (linkFails ? `（${linkFails} 个跳转没设上，可在 Prototype 面板手动连）` : ''));
}

main().catch(e => figma.closePlugin('生成失败：' + (e && e.message ? e.message : e)));

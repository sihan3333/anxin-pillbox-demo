// 安心药箱 / 三三作息簿 · AI 中转（Cloudflare Worker）
// 网页把提示词发过来，Worker 用 Secret 里的 Key 转给大模型，再把 JSON 结果返回。密钥只存在 Cloudflare 后台。
//   POST /        {prompt}         → DeepSeek 文字模型（医嘱整理、作息簿共用，行为与之前一致）
//   POST /vision  {prompt, image}  → 通义千问 VL 看图模型（拍一拍核对：只抄药盒上的字）
// 照片只转发给模型做这一次识别，Worker 不保存、不记录。
//
// 需要在 Cloudflare 后台 Settings → Variables and Secrets 配置：
//   DEEPSEEK_API_KEY   Secret，原有
//   DASHSCOPE_API_KEY  Secret，新增：阿里云百炼的 API Key
//   ALLOWED_ORIGINS    Text，原有：允许调用的网页来源，逗号分隔
//   QWEN_VL_MODEL      Text，可选：默认 qwen3-vl-plus
const MAX_PROMPT = 8000;
const MAX_IMAGE = 2_000_000; // data URL 字符数，约 1.5MB 图片
const DASHSCOPE = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : (allowed[0] || ''),
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const reply = (status, body) => new Response(JSON.stringify(body), {
      status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' },
    });
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method === 'GET') return statusPage(env);
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' });
    if (!allowed.includes(origin)) return reply(403, { error: 'origin_not_allowed' });
    let body;
    try { body = await request.json(); } catch { return reply(400, { error: 'bad_json' }); }
    const { prompt, image } = body || {};
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT) {
      return reply(400, { error: 'bad_prompt' });
    }
    const path = new URL(request.url).pathname.replace(/\/+$/, '');

    if (path === '/vision') {
      if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp);base64,/.test(image) || image.length > MAX_IMAGE) {
        return reply(400, { error: 'bad_image' });
      }
      const r = await fetch(DASHSCOPE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.DASHSCOPE_API_KEY },
        body: JSON.stringify({
          model: env.QWEN_VL_MODEL || 'qwen3-vl-plus',
          temperature: 0,
          max_tokens: 400,
          messages: [
            { role: 'system', content: '你只输出一个 JSON 对象，不输出任何解释文字。' },
            { role: 'user', content: [{ type: 'image_url', image_url: { url: image } }, { type: 'text', text: prompt }] },
          ],
        }),
      });
      // 带上上游的错误说明（不含密钥），方便排查型号或地域配置
      if (!r.ok) return reply(502, { error: 'upstream_' + r.status, detail: (await r.text()).slice(0, 300) });
      const data = await r.json();
      // 看图模型有时会包一层 ```json，取第一个 { 到最后一个 } 之间的内容
      const text = String(data?.choices?.[0]?.message?.content ?? '');
      const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
      // 模糊照片上偶尔多写一个 }（如 "specs":["□mg"]},"box"），只修这一种已知的格式错误，修不好就按失败处理
      const parse = s => { try { return JSON.parse(s); } catch { return null; } };
      const result = parse(json) || parse(json.replace(/\]\}\s*,\s*"/g, '],"'));
      if (result) return reply(200, { result });
      return reply(502, { error: 'invalid_model_json', finish: data?.choices?.[0]?.finish_reason, detail: text.slice(0, 300) });
    }

    if (path !== '') return reply(404, { error: 'not_found' });
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.DEEPSEEK_API_KEY },
      body: JSON.stringify({
        model: 'deepseek-chat',
        temperature: 0,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: '你只输出一个 JSON 对象，不输出任何解释文字。' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!r.ok) return reply(502, { error: 'upstream_' + r.status });
    const data = await r.json();
    try {
      return reply(200, { result: JSON.parse(data.choices[0].message.content) });
    } catch {
      return reply(502, { error: 'invalid_model_json' });
    }
  },
};

// 在浏览器里直接打开时显示的状态页：只说明服务在线、各通道是否配置好，不显示任何密钥
function statusPage(env) {
  const row = (name, use, ok) => `<tr><td>${name}</td><td>${use}</td><td class="${ok ? 'ok' : 'no'}">${ok ? '● 正常' : '○ 未配置'}</td></tr>`;
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI 中转服务</title><style>
:root{--bg:#f7f5ef;--card:#fff;--ink:#1f2a24;--sub:#66706a;--line:#e3e0d6;--ok:#2f7d4f;--no:#a05a2c}
@media (prefers-color-scheme:dark){:root{--bg:#161a17;--card:#1f2420;--ink:#e8ece9;--sub:#9aa39d;--line:#2e3530;--ok:#6cc58f;--no:#e0a070}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
main{max-width:640px;margin:48px auto;padding:0 16px}h1{font-size:22px;margin:0 0 6px}p{color:var(--sub);margin:0 0 20px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:6px 16px;overflow-x:auto}
table{width:100%;border-collapse:collapse}td,th{padding:10px 6px;text-align:left;border-bottom:1px solid var(--line)}tr:last-child td{border-bottom:0}
th{font-size:13px;color:var(--sub);font-weight:500}.ok{color:var(--ok);white-space:nowrap}.no{color:var(--no);white-space:nowrap}code{font-size:13px}
</style></head><body><main>
<h1>AI 中转服务 · 在线</h1>
<p>给安心药箱和三三作息簿调用大模型用。网页把请求发到这里，由这里带上存在 Cloudflare 后台的密钥转给模型；照片和文字只用于这一次识别，不保存。浏览器直接打开只能看到这个状态页，功能只接受这两个网页发来的请求。</p>
<div class="card"><table><tr><th>地址</th><th>用途</th><th>状态</th></tr>
${row('<code>POST /</code>', '三三作息簿一句话改日程、安心药箱整理医嘱（DeepSeek）', !!env.DEEPSEEK_API_KEY)}
${row('<code>POST /vision</code>', '安心药箱拍一拍核对，读药盒上的字（通义千问 VL）', !!env.DASHSCOPE_API_KEY)}
</table></div></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

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

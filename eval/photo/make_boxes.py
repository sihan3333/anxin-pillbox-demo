"""生成「拍一拍核对」评测用的仿真药盒照片，以及 Demo 的示例药盒图。

全部是程序画的：真实通用名和规格，印在自拟品牌、自拟配色的包装上，不仿任何药企的真实包装。
再叠加倾斜、反光、模糊、遮挡、过暗等变化，覆盖设计文档第 7 节的 9 类情况。

用法：python make_boxes.py            生成评测集 eval/photo/img/*.jpg 和 eval/photo/photo_cases.json
     python make_boxes.py --samples  生成 Demo 示例图 img/samples/*.jpg
固定随机种子，重复运行结果一致。
"""
import json, math, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
FONT = 'C:/Windows/Fonts/msyh.ttc'
FONT_B = 'C:/Windows/Fonts/msyhbd.ttc'
font = lambda size, bold=False: ImageFont.truetype(FONT_B if bold else FONT, size)

# 评测用的药品清单：评测时假定家里登记的就是这 5 种
LIST = [
    {'id': 'a', 'name': '降压药', 'boxName': '苯磺酸氨氯地平片', 'boxSpec': '5mg', 'times': ['08:00']},
    {'id': 'b', 'name': '降糖药', 'boxName': '盐酸二甲双胍片', 'boxSpec': '0.5g', 'times': ['08:00', '20:00']},
    {'id': 'c', 'name': '降脂药', 'boxName': '阿托伐他汀钙片', 'boxSpec': '20mg', 'times': ['21:00']},
    {'id': 'd', 'name': '阿司匹林', 'boxName': '阿司匹林肠溶片', 'boxSpec': '100mg', 'times': ['08:00']},
    {'id': 'e', 'name': '硝苯地平', 'boxName': '硝苯地平控释片', 'boxSpec': '30mg', 'times': ['20:00']},
]
# 名字相近、但不在清单里的药：同成分不同剂型、不同规格、只差一两个字
LOOKALIKE = [
    ('苯磺酸左旋氨氯地平片', '2.5mg', 'a'), ('苯磺酸氨氯地平片', '10mg', 'a'), ('马来酸氨氯地平片', '5mg', 'a'),
    ('盐酸二甲双胍缓释片', '0.5g', 'b'), ('盐酸二甲双胍肠溶片', '0.25g', 'b'), ('盐酸二甲双胍片', '0.85g', 'b'),
    ('阿托伐他汀钙片', '10mg', 'c'), ('阿托伐他汀钙胶囊', '20mg', 'c'), ('瑞舒伐他汀钙片', '20mg', 'c'),
    ('阿司匹林泡腾片', '100mg', 'd'), ('阿司匹林肠溶片', '25mg', 'd'), ('硝苯地平片', '10mg', 'e'),
    ('硝苯地平缓释片', '20mg', 'e'), ('硝苯地平控释片', '60mg', 'e'),
]
# 清单外的常见药
OTHER = [('格列美脲片', '2mg'), ('氯沙坦钾片', '50mg'), ('厄贝沙坦片', '150mg'), ('辛伐他汀片', '20mg'),
         ('美托洛尔缓释片', '47.5mg'), ('阿卡波糖片', '50mg'), ('氯吡格雷片', '75mg'), ('瑞格列奈片', '1mg'),
         ('缬沙坦胶囊', '80mg'), ('非洛地平缓释片', '5mg'), ('吲达帕胺片', '2.5mg'), ('格列齐特缓释片', '30mg')]
BRANDS = ['禾川制药', '岚溪药业', '知远制药', '橙屿药业', '初云制药', '青棠药业', '远汀制药', '麓石药业']
COLORS = [(37, 99, 235), (234, 88, 12), (22, 163, 74), (124, 58, 237), (220, 38, 38), (13, 148, 136), (202, 138, 4), (71, 85, 105)]


def box_face(name, spec, rnd, w=900, h=520):
    """一个药盒正面：顶部色带和品牌、居中大字通用名、规格行。"""
    col = rnd.choice(COLORS)
    im = Image.new('RGB', (w, h), (250, 250, 247))
    d = ImageDraw.Draw(im)
    band = rnd.randint(90, 130)
    d.rectangle([0, 0, w, band], fill=col)
    d.text((36, band / 2), rnd.choice(BRANDS), font=font(40, True), fill='white', anchor='lm')
    d.text((w - 36, band / 2), '处方药', font=font(30), fill='white', anchor='rm')
    size = min(96, int((w - 80) / max(len(name), 1)))
    d.text((w / 2, band + (h - band) * 0.42), name, font=font(size, True), fill=(20, 20, 20), anchor='mm')
    d.text((w / 2, band + (h - band) * 0.72), f'规格：{spec}    {rnd.choice([14, 24, 28, 30, 48])}片/盒', font=font(36), fill=(60, 60, 60), anchor='mm')
    d.rectangle([0, h - 24, w, h], fill=col)
    # 侧边一道深色，看起来像立体盒子
    return im


def background(rnd, size=(1024, 768)):
    base = rnd.choice([(196, 160, 120), (225, 222, 215), (150, 120, 95), (205, 210, 214), (238, 232, 220)])
    bg = Image.new('RGB', size, base)
    noise = Image.effect_noise(size, rnd.randint(8, 20)).convert('RGB')
    return Image.blend(bg, noise, 0.08)


def place(bg, face, rnd, angle=None, scale=None, at=None):
    angle = rnd.uniform(-8, 8) if angle is None else angle
    scale = rnd.uniform(0.7, 0.85) if scale is None else scale
    f = face.resize((int(face.width * scale), int(face.height * scale)))
    shadow = Image.new('RGBA', (f.width + 40, f.height + 40), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rectangle([20, 26, f.width + 20, f.height + 26], fill=(0, 0, 0, 90))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10)).rotate(angle, expand=True)
    rgba = f.convert('RGBA').rotate(angle, expand=True)
    x, y = at or ((bg.width - rgba.width) // 2 + rnd.randint(-30, 30), (bg.height - rgba.height) // 2 + rnd.randint(-20, 20))
    bg.paste(shadow, (x - 10, y - 4), shadow)
    bg.paste(rgba, (x, y), rgba)
    return bg


def glare(im, rnd, strength=200):
    g = Image.new('L', im.size, 0)
    cx, cy = rnd.randint(300, 700), rnd.randint(250, 500)
    ImageDraw.Draw(g).ellipse([cx - 160, cy - 90, cx + 160, cy + 90], fill=strength)
    g = g.filter(ImageFilter.GaussianBlur(60))
    return Image.composite(Image.new('RGB', im.size, 'white'), im, g)


def finger(im, rnd, box):
    d = ImageDraw.Draw(im)
    x0, y0, x1, y1 = box
    d.rounded_rectangle([x0, y0, x1, y1], radius=60, fill=(224, 172, 140))
    d.rounded_rectangle([x0 + 10, y0 + 10, x0 + 70, y0 + 60], radius=20, fill=(238, 200, 180))
    return im


def blister(rnd):
    im = Image.new('RGB', (760, 420), (205, 208, 212))
    d = ImageDraw.Draw(im)
    for r in range(3):
        for c in range(5):
            x, y = 90 + c * 140, 80 + r * 130
            d.ellipse([x - 40, y - 40, x + 40, y + 40], fill=(232, 234, 236), outline=(160, 163, 168), width=4)
    return im


def nonbox(rnd, kind):
    bg = background(rnd)
    d = ImageDraw.Draw(bg)
    if kind == 'cup':
        d.rounded_rectangle([380, 220, 640, 560], radius=30, fill=rnd.choice(COLORS))
        d.ellipse([600, 300, 720, 450], outline=rnd.choice(COLORS), width=24)
    elif kind == 'remote':
        d.rounded_rectangle([420, 140, 600, 640], radius=40, fill=(40, 40, 44))
        for i in range(6):
            d.ellipse([470, 200 + i * 65, 550, 250 + i * 65], fill=(90, 90, 96))
    elif kind == 'paper':
        d.rectangle([220, 160, 820, 620], fill=(246, 244, 236))
        for i, t in enumerate(['今日天气 晴转多云', '社区通知', '周六上午九点', '老年活动中心', '欢迎参加']):
            d.text((260, 200 + i * 80), t, font=font(44, i == 0), fill=(40, 40, 40))
    else:
        d.rounded_rectangle([400, 120, 640, 640], radius=36, fill=(30, 30, 34))
        d.rounded_rectangle([414, 160, 626, 600], radius=12, fill=(70, 110, 170))
    return bg


def finish(im):
    im = im.convert('RGB')
    im.thumbnail((1024, 1024))
    return im


def save(im, path, q=80):
    path.parent.mkdir(parents=True, exist_ok=True)
    finish(im).save(path, 'JPEG', quality=q)


# ---------- 评测集 ----------
def case_plan(rnd, current=None):
    """随机选一顿：当前该吃的药 m 和这一顿的全部药 D。"""
    t = rnd.choice(['08:00', '20:00'])
    dose = [x['id'] for x in LIST if t in x['times']]
    m = current if current in dose else rnd.choice(dose)
    return {'time': t, 'current': m, 'dose': dose}


def build_eval():
    rnd = random.Random(20261025)
    out, n = [], 0
    imgdir = ROOT / 'eval' / 'photo' / 'img'

    def add(cat, im, plan, truth, accept, note):
        nonlocal n
        n += 1
        cid = f'p{n:03d}'
        save(im, imgdir / f'{cid}.jpg')
        out.append({'id': cid, 'category': cat, 'file': f'img/{cid}.jpg', 'plan': plan, 'truth': truth, 'accept': accept, 'note': note})

    byid = {x['id']: x for x in LIST}

    def expect_other(plan, other_id):
        # 拍到清单里的另一种药：同一顿 → sameDose，不同顿 → wrong
        return 'sameDose' if other_id in plan['dose'] else 'wrong'

    # 1 正确药盒，正面清晰
    for i in range(16):
        x = LIST[i % 5]; plan = case_plan(rnd, x['id'])
        if plan['current'] != x['id']:
            plan = {'time': x['times'][0], 'current': x['id'], 'dose': [y['id'] for y in LIST if x['times'][0] in y['times']]}
        im = place(background(rnd), box_face(x['boxName'], x['boxSpec'], rnd), rnd)
        add('1 正确清晰', im, plan, {'names': [x['boxName']], 'specs': [x['boxSpec']]}, ['ok'], '正面清晰')

    # 2 正确药盒，有倾斜、反光、非关键处遮挡、侧拍、竖放
    kinds = ['倾斜', '反光', '遮挡角落', '侧拍', '竖放']
    for i in range(16):
        x = LIST[i % 5]; k = kinds[i % 5]
        plan = {'time': x['times'][0], 'current': x['id'], 'dose': [y['id'] for y in LIST if x['times'][0] in y['times']]}
        face = box_face(x['boxName'], x['boxSpec'], rnd)
        if k == '倾斜': im = place(background(rnd), face, rnd, angle=rnd.choice([-1, 1]) * rnd.uniform(18, 30))
        elif k == '反光': im = glare(place(background(rnd), face, rnd), rnd, 150)
        elif k == '遮挡角落': im = finger(place(background(rnd), face, rnd), rnd, (130, 520, 330, 760))
        elif k == '侧拍': im = place(background(rnd), face.resize((int(face.width * 0.62), face.height)), rnd, scale=1.0)
        else: im = place(background(rnd, (768, 1024)), face, rnd, angle=90 + rnd.uniform(-5, 5), scale=0.8)
        add('2 正确有干扰', im, plan, {'names': [x['boxName']], 'specs': [x['boxSpec']]}, ['ok', 'unclear'], k)

    # 3 清单里的另一种药（真正的拿错，或同一顿的另一种）
    for i in range(14):
        plan = case_plan(rnd)
        other = rnd.choice([y for y in LIST if y['id'] != plan['current']])
        im = place(background(rnd), box_face(other['boxName'], other['boxSpec'], rnd), rnd)
        exp = expect_other(plan, other['id'])
        add('3 清单内另一种', im, plan, {'names': [other['boxName']], 'specs': [other['boxSpec']]}, [exp, 'unclear'], f'拍到{byid[other["id"]]["name"]}')

    # 4 名字相近：同成分不同剂型、不同规格、只差一两个字
    for i in range(18):
        name, spec, near = LOOKALIKE[i % len(LOOKALIKE)]
        x = byid[near]
        plan = {'time': x['times'][0], 'current': near, 'dose': [y['id'] for y in LIST if x['times'][0] in y['times']]}
        im = place(background(rnd), box_face(name, spec, rnd), rnd)
        add('4 名字相近', im, plan, {'names': [name], 'specs': [spec]}, ['notInList', 'unclear'], f'像{x["boxName"]}{x["boxSpec"]}')

    # 5 清单外的药
    for i in range(12):
        name, spec = OTHER[i]
        plan = case_plan(rnd)
        im = place(background(rnd), box_face(name, spec, rnd), rnd)
        add('5 清单外', im, plan, {'names': [name], 'specs': [spec]}, ['notInList', 'unclear'], '清单外')

    # 6 只有药板，没有药盒
    for i in range(10):
        plan = case_plan(rnd)
        im = place(background(rnd), blister(rnd), rnd)
        add('6 只有药板', im, plan, {'names': [], 'specs': []}, ['unclear'], '药板上没有字')

    # 7 模糊、过暗、只拍到一角；一半是正确的药，一半是错的药
    kinds = ['模糊', '过暗', '只拍到一角']
    for i in range(14):
        k = kinds[i % 3]; plan = case_plan(rnd)
        right = i % 2 == 0
        x = byid[plan['current']] if right else rnd.choice([y for y in LIST if y['id'] != plan['current']] + [{'id': None, 'boxName': n_, 'boxSpec': s_} for n_, s_ in OTHER[:4]])
        face = box_face(x['boxName'], x['boxSpec'], rnd)
        if k == '模糊': im = place(background(rnd), face, rnd).filter(ImageFilter.GaussianBlur(rnd.uniform(7, 11)))
        elif k == '过暗': im = ImageEnhance.Brightness(place(background(rnd), face, rnd)).enhance(rnd.uniform(0.08, 0.14))
        else:
            big = place(background(rnd, (2400, 1600)), face.resize((face.width * 3, face.height * 3)), rnd, scale=1.0, angle=0)
            im = big.crop((0, 0, 1024, 768))
        accept = ['unclear', 'ok'] if right else ['unclear', 'notInList', 'wrong', 'sameDose']
        add('7 模糊过暗一角', im, plan, {'names': [], 'specs': []}, accept, f'{k}，{"正确的药" if right else "不是该吃的药"}')

    # 8 一张照片两盒药
    for i in range(10):
        plan = case_plan(rnd)
        a, b = rnd.sample(LIST, 2)
        bg = background(rnd)
        place(bg, box_face(a['boxName'], a['boxSpec'], rnd), rnd, scale=0.5, at=(30, 120 + rnd.randint(-40, 40)))
        place(bg, box_face(b['boxName'], b['boxSpec'], rnd), rnd, scale=0.5, at=(520, 380 + rnd.randint(-40, 40)))
        add('8 两盒药', bg, plan, {'names': [a['boxName'], b['boxName']], 'specs': [a['boxSpec'], b['boxSpec']]}, ['unclear'], '两盒')

    # 9 不是药盒
    for i in range(10):
        plan = case_plan(rnd)
        add('9 不是药盒', nonbox(rnd, ['cup', 'remote', 'paper', 'phone'][i % 4]), plan, {'names': [], 'specs': []}, ['unclear', 'notInList'], '不是药盒')

    build_hard(add, byid)

    # 分层划分 seed / dev / holdout，约 25% / 45% / 30%
    split_rnd = random.Random(7)
    for cat in sorted({c['category'] for c in out}):
        cs = [c for c in out if c['category'] == cat]
        split_rnd.shuffle(cs)
        k1, k2 = round(len(cs) * 0.25), round(len(cs) * 0.70)
        for j, c in enumerate(cs):
            c['split'] = 'seed' if j < k1 else 'dev' if j < k2 else 'holdout'
    data = {'version': 'photo-v1', 'list': LIST, 'cases': out}
    (ROOT / 'eval' / 'photo' / 'photo_cases.json').write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding='utf-8')
    print(len(out), 'cases')


# ---------- 难例（第 2 轮加入）：更像真实药盒，专门测会不会误判「对了」 ----------
TRADE = ['安平宁', '舒络欣', '糖立稳', '脂必清', '心护宁', '平压达', '康维诺', '素利安']


def rich_face(rnd, generic, spec, trade=None, extra=False, w=900, h=560):
    """更像真实药盒：可选的大号商品名、小号「通用名称」行、英文名、厂家和批准文号等干扰文字。
    返回图片和每段文字的位置，方便遮住某几个字。"""
    col = rnd.choice(COLORS)
    im = Image.new('RGB', (w, h), (250, 250, 247))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, w, 70], fill=col)
    d.text((30, 35), rnd.choice(BRANDS), font=font(30, True), fill='white', anchor='lm')
    d.text((w - 30, 35), '处方药', font=font(26), fill='white', anchor='rm')
    pos = {}
    y = 120
    if trade:
        d.text((w / 2, y + 40), trade, font=font(110, True), fill=col, anchor='mm')
        y += 120
        f = font(34, True)
        text = f'通用名称：{generic}'
        x0 = w / 2 - d.textlength(text, font=f) / 2
        d.text((x0, y), text, font=f, fill=(30, 30, 30))
        pre = d.textlength('通用名称：', font=f)
        pos['generic'] = (x0 + pre, y, f)
        y += 60
    else:
        f = font(min(84, int((w - 80) / len(generic))), True)
        x0 = w / 2 - d.textlength(generic, font=f) / 2
        d.text((x0, y), generic, font=f, fill=(20, 20, 20))
        pos['generic'] = (x0, y, f)
        y += 110
    fs = font(30)
    text = f'规格：{spec}'
    x0 = w / 2 - d.textlength(text, font=fs) / 2
    d.text((x0, y), text + '    ' + f'{rnd.choice([14, 28, 30])}片/盒', font=fs, fill=(60, 60, 60))
    pos['spec'] = (x0 + d.textlength('规格：', font=fs), y, fs, spec)
    y += 50
    if extra:
        for t in ['Amlodipine Besylate Tablets' if '氨氯地平' in generic else 'Tablets for oral use',
                  f'国药准字H{rnd.randint(10000000, 99999999)}', '适应症：详见说明书。贮藏：密封，阴凉干燥处保存。', '本品为白色或类白色片']:
            d.text((40, y), t, font=font(22), fill=(110, 110, 110))
            y += 32
    d.rectangle([0, h - 20, w, h], fill=col)
    return im, pos


def cover(im, pos, key, sub, full_text):
    """用手指样的色块盖住某段文字中的 sub 这几个字。"""
    x0, y, f = pos[key][:3]
    d = ImageDraw.Draw(im)
    i = full_text.index(sub)
    a = x0 + d.textlength(full_text[:i], font=f)
    b = x0 + d.textlength(full_text[:i + len(sub)], font=f)
    hgt = f.size
    d.rounded_rectangle([a - 6, y - 6, b + 6, y + hgt * 1.35], radius=18, fill=(224, 172, 140))
    return im


def build_hard(add, byid):
    rnd = random.Random(20261026)
    plan_of = lambda mid: {'time': byid[mid]['times'][0], 'current': mid, 'dose': [y['id'] for y in LIST if byid[mid]['times'][0] in y['times']]}

    # H1 商品名大、通用名小：正确的药，只能读通用名，别把商品名当药名
    for i in range(8):
        x = LIST[i % 5]
        face, _ = rich_face(rnd, x['boxName'], x['boxSpec'], trade=TRADE[i], extra=i % 2 == 1)
        add('H1 商品名大通用名小', place(background(rnd), face, rnd), plan_of(x['id']), {'names': [x['boxName']], 'specs': [x['boxSpec']]}, ['ok', 'unclear'], f'商品名{TRADE[i]}')

    # H2 关键字被盖住：其实是名字相近的另一种药，盖住「缓释」「左旋」等字后看起来像清单里的药
    risky = [('盐酸二甲双胍缓释片', '0.5g', 'b', '缓释'), ('苯磺酸左旋氨氯地平片', '5mg', 'a', '左旋'), ('阿托伐他汀钙胶囊', '20mg', 'c', '胶囊'),
             ('阿司匹林泡腾片', '100mg', 'd', '泡腾'), ('盐酸二甲双胍肠溶片', '0.5g', 'b', '肠溶'), ('苯磺酸左旋氨氯地平片', '5mg', 'a', '左'),
             ('硝苯地平缓释片', '30mg', 'e', '缓释'), ('盐酸二甲双胍缓释片', '0.5g', 'b', '缓')]
    for name, spec, near, sub in risky:
        face, pos = rich_face(rnd, name, spec)
        cover(face, pos, 'generic', sub, name)
        add('H2 关键字被遮挡', place(background(rnd), face, rnd), plan_of(near), {'names': [name], 'specs': [spec]}, ['notInList', 'unclear'], f'{name}，盖住「{sub}」')

    # H3 规格被盖住：名字和清单一样，但规格其实不同
    wrong_spec = [('苯磺酸氨氯地平片', '10mg', 'a'), ('盐酸二甲双胍片', '0.85g', 'b'), ('阿托伐他汀钙片', '40mg', 'c'), ('阿司匹林肠溶片', '25mg', 'd'),
                  ('硝苯地平控释片', '60mg', 'e'), ('苯磺酸氨氯地平片', '2.5mg', 'a'), ('阿托伐他汀钙片', '10mg', 'c')]
    for name, spec, near in wrong_spec:
        face, pos = rich_face(rnd, name, spec)
        x0, y, f, s = pos['spec']
        cover(face, {'spec': (x0, y, f)}, 'spec', s, s)
        add('H3 规格被遮挡', place(background(rnd), face, rnd), plan_of(near), {'names': [name], 'specs': []}, ['unclear', 'notInList'], f'{name}{spec}，规格被盖住')

    # H4 远拍小字：药盒很小，压缩得厉害；一半正确一半是相近的药
    for i in range(8):
        if i % 2 == 0:
            x = LIST[i % 5]; name, spec, mid, accept = x['boxName'], x['boxSpec'], x['id'], ['ok', 'unclear']
        else:
            name, spec, mid = LOOKALIKE[i]; accept = ['notInList', 'unclear']
        face, _ = rich_face(rnd, name, spec, extra=True)
        im = place(background(rnd, (1600, 1200)), face, rnd, scale=rnd.uniform(0.2, 0.26))
        im = im.resize((800, 600))
        add('H4 远拍小字', im, plan_of(mid), {'names': [name], 'specs': [spec]}, accept, f'{name}{spec}，远拍')

    # H5 晃动模糊：名字相近的药，中等程度的运动模糊，看会不会被读成清单里的药
    for i in range(7):
        name, spec, near = [LOOKALIKE[k] for k in (0, 3, 4, 9, 11, 12, 6)][i]
        face, _ = rich_face(rnd, name, spec)
        im = place(background(rnd), face, rnd)
        k = rnd.choice([9, 11, 13])
        im = motion(im, k)
        add('H5 晃动模糊', im, plan_of(near), {'names': [name], 'specs': [spec]}, ['notInList', 'unclear'], f'{name}{spec}，晃动')


def motion(im, k):
    """水平方向的运动模糊：把图片左右错开 k 次叠加。"""
    acc = None
    for dx in range(-(k // 2), k // 2 + 1):
        sh = im.transform(im.size, Image.AFFINE, (1, 0, dx * 2, 0, 1, 0))
        acc = sh if acc is None else Image.blend(acc, sh, 1 / (dx + k // 2 + 1))
    return acc


# ---------- Demo 示例图 ----------
def build_samples():
    rnd = random.Random(3)
    d = ROOT / 'img' / 'samples'
    save(place(background(rnd), box_face('苯磺酸氨氯地平片', '5mg', random.Random(1)), rnd), d / 'amlodipine.jpg', 78)
    save(place(background(rnd), box_face('盐酸二甲双胍片', '0.5g', random.Random(2)), rnd), d / 'metformin.jpg', 78)
    save(place(background(rnd), box_face('阿托伐他汀钙片', '20mg', random.Random(4)), rnd), d / 'atorvastatin.jpg', 78)
    save(place(background(rnd), box_face('盐酸二甲双胍片', '0.5g', random.Random(2)), rnd).filter(ImageFilter.GaussianBlur(9)), d / 'blurry.jpg', 78)
    print('samples ok')


if __name__ == '__main__':
    build_samples() if '--samples' in sys.argv else build_eval()

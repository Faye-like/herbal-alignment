# -*- coding: utf-8 -*-
"""接口层：Flask 应用，提供页面路由与 RESTful API。

启动：python app.py  然后访问 http://127.0.0.1:5000
"""
import uuid
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, jsonify, request, render_template, redirect

import db
from matcher import build_profile, rank_resources, _loads
import quiz

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

# 管理员登录令牌（内存态，重启即失效，满足比赛演示即可）
ADMIN_TOKENS = set()
# 普通用户登录令牌（内存态）：token -> user_id
USER_TOKENS = {}


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------
def _now():
    return datetime.now().strftime('%Y-%m-%d %H:%M:%S')


def resource_to_dict(row):
    d = dict(row)
    d['theme_tags'] = _loads(d.get('theme_tags'))
    d['concerns'] = _loads(d.get('concerns'))
    return d


def require_admin(fn):
    """管理端写操作鉴权：校验 X-Admin-Token 请求头。"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        token = request.headers.get('X-Admin-Token', '')
        if token not in ADMIN_TOKENS:
            return jsonify(ok=False, message='未登录或登录已失效，请重新登录'), 401
        return fn(*args, **kwargs)
    return wrapper


def _current_user():
    """根据 X-User-Token 请求头解析当前登录用户，返回 app_user 行或 None。

    令牌同时落库（user_token 表），服务重启后仍能识别已登录状态；
    内存字典只作为命中缓存。
    """
    token = request.headers.get('X-User-Token', '')
    if not token:
        return None
    uid = USER_TOKENS.get(token)
    conn = db.get_conn()
    try:
        if not uid:
            row = conn.execute('SELECT user_id FROM user_token WHERE token=?', (token,)).fetchone()
            if not row:
                return None
            uid = row['user_id']
            USER_TOKENS[token] = uid
        return conn.execute('SELECT * FROM app_user WHERE id=?', (uid,)).fetchone()
    finally:
        conn.close()


def _save_token(token, uid):
    """登录成功后签发令牌：写入内存缓存并持久化到数据库。"""
    USER_TOKENS[token] = uid
    conn = db.get_conn()
    conn.execute(
        'INSERT OR REPLACE INTO user_token(token, user_id, created_at) VALUES (?,?,?)',
        (token, uid, _now()))
    conn.commit()
    conn.close()


def user_to_dict(row):
    """app_user 行 -> 对外安全字段（不含密码）。"""
    return {
        'id': row['id'],
        'user_id': row['username'],
        'username': row['username'],
        'gender': row['gender'] or '保密',
        'province': row['province'] or '',
    }


def require_user(fn):
    """普通用户写操作鉴权：校验 X-User-Token 请求头。"""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _current_user()
        if not user:
            return jsonify(ok=False, message='请先登录后再操作'), 401
        request.current_user = user
        return fn(*args, **kwargs)
    return wrapper


def _current_profile():
    """读取最近一次关注点采集记录并构造画像。

    优先使用登录用户身份（X-User-Token），否则回退到请求中的 user_id。
    """
    user = _current_user()
    uid = user['username'] if user else (request.args.get('user_id') or '')
    if not uid:
        return None
    conn = db.get_conn()
    row = conn.execute(
        'SELECT * FROM questionnaire WHERE user_id=? ORDER BY id DESC LIMIT 1', (uid,)).fetchone()
    conn.close()
    return build_profile(row) if row else None


# ---------------------------------------------------------------------------
# 页面路由
# ---------------------------------------------------------------------------
@app.route('/')
def page_index():
    return render_template('index.html')


@app.route('/recommend')
def page_recommend():
    # 「智能匹配推荐」已并入「我的养生方案」，保留旧地址重定向
    return redirect('/mine')


@app.route('/mine')
def page_mine():
    return render_template('mine.html')


@app.route('/resources')
def page_resources():
    return render_template('resources.html')


@app.route('/resource')
def page_resource_detail():
    return render_template('resource.html')


@app.route('/care')
def page_care():
    return render_template('care.html')


@app.route('/insights')
def page_insights():
    return render_template('insights.html')


@app.route('/user-login')
def page_user_login():
    return render_template('user-login.html')


@app.route('/profile')
def page_profile():
    return render_template('profile.html')


@app.route('/about')
def page_about():
    return render_template('about.html')


@app.route('/quiz')
def page_quiz():
    return render_template('quiz.html')


@app.route('/report')
def page_report():
    return render_template('report.html')


@app.route('/herbs')
def page_herbs():
    return render_template('herbs.html')


@app.route('/disclaimer')
def page_disclaimer():
    return render_template('disclaimer.html')


@app.route('/login')
def page_login():
    return render_template('admin-login.html')


@app.route('/admin')
def page_admin_home():
    return redirect('/admin/resources')


@app.route('/admin/resources')
def page_admin_resources():
    return render_template('admin-resources.html')


@app.route('/admin/stats')
def page_admin_stats():
    return render_template('admin-stats.html')


# ---------------------------------------------------------------------------
# 元数据：筛选选项
# ---------------------------------------------------------------------------
@app.route('/api/meta')
def api_meta():
    return jsonify(ok=True, data={
        'concerns': db.CONCERNS,
        'resource_types': db.RESOURCE_TYPES,
        'theme_tags': db.THEME_TAGS,
        'care_categories': db.CARE_CATEGORIES,
        'provinces': db.PROVINCES,
        'genders': db.GENDERS,
        'suggestion_categories': db.SUGGESTION_CATEGORIES,
    })


# ---------------------------------------------------------------------------
# 养生关注点采集（前端一键点选后提交，复用 questionnaire 表存储）
# ---------------------------------------------------------------------------
@app.route('/api/questionnaire/submit', methods=['POST'])
def api_questionnaire_submit():
    body = request.get_json(silent=True) or {}
    user = _current_user()
    if user:
        user_id = user['username']
        province = user['province'] or body.get('province') or ''
    else:
        user_id = str(body.get('user_id') or uuid.uuid4().hex[:12])
        province = body.get('province') or ''
    conn = db.get_conn()
    conn.execute(
        'INSERT INTO questionnaire(user_id, concerns, province, created_at) VALUES (?,?,?,?)',
        (user_id, db._j(body.get('concerns', [])), province, _now()))
    conn.commit()
    row = conn.execute(
        'SELECT * FROM questionnaire WHERE user_id=? ORDER BY id DESC LIMIT 1', (user_id,)).fetchone()
    conn.close()
    profile = build_profile(row)
    return jsonify(ok=True, user_id=user_id, profile=profile, tags=profile['tags'],
                   questionnaire_id=row['id'])


# ---------------------------------------------------------------------------
# 养生自查问卷：题目 + 提交匹配药材塑
# ---------------------------------------------------------------------------
@app.route('/api/quiz')
def api_quiz_questions():
    """返回完整评估问卷：5 个躯体维度 + 思虑内耗 + 行为问卷（均不含得分）。"""
    safe_questions = []
    for q in quiz.QUESTIONS:
        safe_questions.append({
            'id': q['id'],
            'dim': q.get('dim', ''),
            'q': q['q'],
            'type': q.get('type', 'single'),
            'hint': q.get('hint', ''),
            'options': [{'text': o['text']} for o in q['options']],
        })
    return jsonify(ok=True, questions=safe_questions, total=len(safe_questions),
                   assessment={
                       'scale': quiz.SCALE_OPTIONS,
                       'body_questions': quiz.BODY_QUESTIONS,
                       'body_dimensions': [{'id': k, 'name': v['name'], 'label': v['label']}
                                           for k, v in quiz.BODY_DIMENSIONS.items()],
                       'mind_questions': quiz.MIND_QUESTIONS,
                       'concerns': db.CONCERNS,
                       'supplements': quiz.SUPPLEMENTS,
                       'mind_notice': '思虑内耗状态参考 ≠ 心理测评，仅观察日常思虑习惯；'
                                      '如果长期情绪痛苦，建议寻求专业心理支持。',
                   })


@app.route('/api/quiz/submit', methods=['POST'])
@require_user
def api_quiz_submit():
    """提交完整问卷 → 身心状态 + 草本人格 + 调理方案。"""
    body = request.get_json(silent=True) or {}
    answers = body.get('answers') or {}
    if not isinstance(answers, dict) or len(answers) < len(quiz.QUESTIONS):
        return jsonify(ok=False, message='请完成所有题目后再提交'), 400
    report = quiz.build_full_report(body)

    # 匿名汇总本次结果，供后台「身心联动」统计使用（不存原始逐题答案）
    uid = request.current_user['username']
    persona = report.get('persona') or {}
    mind = report.get('mind') or {}
    conn = db.get_conn()
    conn.execute(
        'INSERT INTO quiz_result(user_id, top_id, herb_name, school, body_labels, mind_level, mind_score, supplements, created_at) '
        'VALUES (?,?,?,?,?,?,?,?,?)',
        (uid, report.get('top_id'), (report.get('herb') or {}).get('name'), persona.get('school'),
         db._j((report.get('body') or {}).get('labels') or []), mind.get('level'), mind.get('score'),
         db._j(body.get('supplements') or []), _now()))
    conn.commit()
    conn.close()

    return jsonify(ok=True, report=report)


@app.route('/api/herbs')
def api_herbs():
    """药材塑图鉴：12 种药材塑的性格与养生方向。"""
    items = []
    for hid, info in quiz.HERB_TYPES.items():
        d = dict(info)
        d['id'] = hid
        d['mind_tip'] = quiz.HERB_MIND_TIPS.get(hid, '')
        items.append(d)
    return jsonify(ok=True, items=items, total=len(items))


@app.route('/api/user/profile')
def api_user_profile():
    profile = _current_profile()
    if not profile:
        return jsonify(ok=False, message='未找到该用户画像，请先点选养生关注点'), 404
    return jsonify(ok=True, profile=profile, tags=profile['tags'])


# ---------------------------------------------------------------------------
# 智能匹配推荐
# ---------------------------------------------------------------------------
@app.route('/api/recommend/resources')
def api_recommend_resources():
    limit = int(request.args.get('limit', 6))
    profile = _current_profile()
    conn = db.get_conn()
    rows = conn.execute('SELECT * FROM resource').fetchall()
    conn.close()
    resources = [resource_to_dict(r) for r in rows]
    items = rank_resources(resources, profile, limit)
    return jsonify(ok=True, personalized=bool(profile),
                   tags=profile['tags'] if profile else [],
                   items=items)


# ---------------------------------------------------------------------------
# 《青年养生知识手册》：目录 / 正文 / 附录 / 自测查阅指引
# ---------------------------------------------------------------------------
def manual_sections():
    """读取 resource 表 → 按 MANUAL_SECTIONS 顺序分组的手册章节。

    一条 resource = 手册的一章；type 存分册名。组内按 id 升序，
    生成 no（1.1 / 2.3 …）与 anchor（ch-{id}）。
    每个 section 带上 cover（取同 type 第一章的封面，同 type 共用）。
    """
    conn = db.get_conn()
    rows = conn.execute('SELECT * FROM resource ORDER BY id ASC').fetchall()
    conn.close()
    by_type = {}
    for r in rows:
        d = resource_to_dict(r)
        by_type.setdefault(d['type'], []).append(d)

    sections = []
    for si, sec in enumerate(db.MANUAL_SECTIONS, start=1):
        chapters = []
        for ci, d in enumerate(by_type.get(sec['type'], []), start=1):
            chapters.append({
                'id': d['id'],
                'no': '%d.%d' % (si, ci),
                'title': d['title'],
                'anchor': 'ch-%d' % d['id'],
                'content': d['content'],
                'type': d['type'],
                'cover': d.get('cover') or '',
                'theme_tags': d['theme_tags'],
                'concerns': d['concerns'],
                'publish_time': d['publish_time'],
            })
        if not chapters:
            continue
        # 分册封面：取同 type 第一章的 cover（同 type 共用）
        section_cover = chapters[0].get('cover') or ''
        sections.append({
            'label': sec['label'],
            'type': sec['type'],
            'sub': sec['sub'],
            'cover': section_cover,
            'chapters': chapters,
        })
    return sections


@app.route('/api/manual')
def api_manual():
    return jsonify(ok=True, data={
        'title': db.MANUAL_META['title'],
        'subtitle': db.MANUAL_META['subtitle'],
        'desc': db.MANUAL_META['desc'],
        'sections': manual_sections(),
        'boundary': db.MANUAL_BOUNDARY,
        'sources': db.MANUAL_APPENDIX['sources'],
    })


@app.route('/api/manual/appendix')
def api_manual_appendix():
    return jsonify(ok=True, data={
        'disclaimer': db.MANUAL_APPENDIX['disclaimer'],
        'groups': db.MANUAL_APPENDIX['groups'],
        'sources': db.MANUAL_APPENDIX['sources'],
    })


@app.route('/api/guide')
def api_guide():
    """查阅指引：按关注点给出中性描述 + 知识查阅指引。

    只给「去手册读哪一章」的指引，不生成任何食疗 / 补剂推荐。
    """
    raw = request.args.get('concerns', '')
    cons = [c for c in (raw.split(',') if raw else []) if c in db.CONCERNS]
    if not cons:
        return jsonify(ok=True, title=db.MANUAL_META['title'],
                       concerns=[], boundary=db.MANUAL_BOUNDARY)

    sections = manual_sections()
    items = []
    for c in cons:
        note = db.CONCERN_GUIDE_NOTE.get(c, '')
        chapters = []
        for sec in sections:
            for ch in sec['chapters']:
                if c in (ch['concerns'] or []):
                    chapters.append({
                        'id': ch['id'], 'no': ch['no'], 'title': ch['title'],
                        'anchor': ch['anchor'], 'section': sec['type'], 'why': note,
                    })
        risk = db.CONCERN_RISK_LEVEL.get(c, {})
        items.append({
            'concern': c,
            'level': risk.get('level', ''),
            'tips': risk.get('tips', []),
            'see_doctor': risk.get('see_doctor', []),
            'why': note,
            'chapters': chapters,
        })
    return jsonify(ok=True, title=db.MANUAL_META['title'],
                   concerns=items, boundary=db.MANUAL_BOUNDARY)


# ---------------------------------------------------------------------------
# 科普资源
# ---------------------------------------------------------------------------
@app.route('/api/resources')
def api_resources():
    rtype = request.args.get('type', '')
    theme = request.args.get('theme', '')
    concern = request.args.get('concern', '')
    q = (request.args.get('q') or '').strip()
    date_from = request.args.get('date_from', '')
    sort = request.args.get('sort', 'latest')

    conn = db.get_conn()
    rows = conn.execute('SELECT * FROM resource ORDER BY id DESC').fetchall()
    conn.close()
    items = [resource_to_dict(r) for r in rows]

    if rtype:
        items = [i for i in items if i['type'] == rtype]
    if theme:
        items = [i for i in items if theme in i['theme_tags']]
    if concern:
        items = [i for i in items if concern in i['concerns']]
    if date_from:
        items = [i for i in items if (i.get('publish_time') or '')[:10] >= date_from]
    if q:
        ql = q.lower()
        items = [i for i in items
                 if ql in i['title'].lower() or ql in (i['content'] or '').lower()
                 or any(ql in t.lower() for t in i['theme_tags'])]

    if sort == 'views':
        items.sort(key=lambda x: -x.get('views', 0))
    else:
        items.sort(key=lambda x: (x.get('publish_time', ''), x['id']), reverse=True)

    return jsonify(ok=True, total=len(items), items=items)


@app.route('/api/resources/<int:rid>')
def api_resource_detail(rid):
    conn = db.get_conn()
    row = conn.execute('SELECT * FROM resource WHERE id=?', (rid,)).fetchone()
    if not row:
        conn.close()
        return jsonify(ok=False, message='资源不存在'), 404
    conn.execute('UPDATE resource SET views=views+1 WHERE id=?', (rid,))
    conn.commit()
    item = resource_to_dict(row)
    item['views'] += 1

    # 相关推荐：同类型或同主题的资源
    rel_rows = conn.execute('SELECT * FROM resource WHERE id!=? ORDER BY id DESC', (rid,)).fetchall()
    conn.close()
    related = []
    for r in rel_rows:
        d = resource_to_dict(r)
        if d['type'] == item['type'] or set(d['theme_tags']) & set(item['theme_tags']):
            related.append({'id': d['id'], 'title': d['title'], 'type': d['type'], 'cover': d['cover']})
    return jsonify(ok=True, item=item, related=related[:4])


@app.route('/api/resources', methods=['POST'])
@require_admin
def api_resource_create():
    body = request.get_json(silent=True) or {}
    conn = db.get_conn()
    cur = conn.execute(
        'INSERT INTO resource(title, cover, content, type, theme_tags, concerns, publish_time, views) '
        'VALUES (?,?,?,?,?,?,?,0)',
        (body.get('title', ''), body.get('cover', ''), body.get('content', ''),
         body.get('type', ''), db._j(body.get('theme_tags', [])),
         db._j(body.get('concerns', [])), body.get('publish_time') or datetime.now().strftime('%Y-%m-%d')))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify(ok=True, id=new_id)


@app.route('/api/resources/<int:rid>', methods=['PUT'])
@require_admin
def api_resource_update(rid):
    body = request.get_json(silent=True) or {}
    conn = db.get_conn()
    row = conn.execute('SELECT * FROM resource WHERE id=?', (rid,)).fetchone()
    if not row:
        conn.close()
        return jsonify(ok=False, message='资源不存在'), 404
    conn.execute(
        'UPDATE resource SET title=?, cover=?, content=?, type=?, theme_tags=?, concerns=?, publish_time=? WHERE id=?',
        (body.get('title', row['title']), body.get('cover', row['cover']), body.get('content', row['content']),
         body.get('type', row['type']), db._j(body.get('theme_tags', _loads(row['theme_tags']))),
         db._j(body.get('concerns', _loads(row['concerns']))),
         body.get('publish_time', row['publish_time']), rid))
    conn.commit()
    conn.close()
    return jsonify(ok=True, id=rid)


@app.route('/api/resources/<int:rid>', methods=['DELETE'])
@require_admin
def api_resource_delete(rid):
    conn = db.get_conn()
    conn.execute('DELETE FROM resource WHERE id=?', (rid,))
    conn.execute('DELETE FROM feedback WHERE resource_id=?', (rid,))
    conn.commit()
    conn.close()
    return jsonify(ok=True, id=rid)


@app.route('/api/resources/<int:rid>/feedback', methods=['POST'])
def api_resource_feedback(rid):
    body = request.get_json(silent=True) or {}
    ftype = body.get('type', '')
    if ftype not in ('useful', 'useless', 'confusing'):
        return jsonify(ok=False, message='反馈类型不合法'), 400
    conn = db.get_conn()
    conn.execute('INSERT INTO feedback(resource_id, type, user_id, created_at) VALUES (?,?,?,?)',
                 (rid, ftype, body.get('user_id', ''), _now()))
    conn.commit()
    conn.close()
    return jsonify(ok=True)


# ---------------------------------------------------------------------------
# 病症调理方案
# ---------------------------------------------------------------------------
@app.route('/api/care-plans')
def api_care_plans():
    concern = request.args.get('concern', '')
    conn = db.get_conn()
    if concern:
        rows = conn.execute('SELECT * FROM care_plan WHERE concern=? ORDER BY sort_order, id',
                            (concern,)).fetchall()
    else:
        rows = conn.execute('SELECT * FROM care_plan ORDER BY id').fetchall()
    conn.close()
    items = []
    for r in rows:
        d = dict(r)
        d['steps'] = _loads(d.get('steps'))
        items.append(d)
    return jsonify(ok=True, total=len(items), items=items)


# ---------------------------------------------------------------------------
# 补剂与病症关联（用于 care 页）
# ---------------------------------------------------------------------------
@app.route('/api/supplement-ref')
def api_supplement_ref():
    """按养生困扰查询关联补剂（含 note 与补剂详情）。"""
    concern = request.args.get('concern', '').strip()
    conn = db.get_conn()
    if concern:
        rows = conn.execute(
            '''SELECT sr.concern, sr.note, sr.sort_order AS ref_order,
                      s.*
                 FROM supplement_ref sr
                 JOIN supplement s ON s.id = sr.supplement_id
                WHERE sr.concern = ?
                ORDER BY sr.sort_order, s.sort_order''',
            (concern,)).fetchall()
    else:
        rows = conn.execute(
            '''SELECT sr.concern, sr.note, sr.sort_order AS ref_order,
                      s.*
                 FROM supplement_ref sr
                 JOIN supplement s ON s.id = sr.supplement_id
                ORDER BY sr.concern, sr.sort_order, s.sort_order''').fetchall()
    conn.close()
    items = [dict(r) for r in rows]
    return jsonify(ok=True, total=len(items), items=items)


# ---------------------------------------------------------------------------
# 我的养生方案：每日 / 每周计划（食谱 + 运动 + 补剂）
# ---------------------------------------------------------------------------
@app.route('/api/my-plan')
def api_my_plan():
    """按用户关注点生成每日 / 每周养生计划（多关注点治理合并版）。

    使用 db.build_resolved_plan 对运动 / 日常注意 / 补剂做智能合并：
    通用基础建议取并集去重、特有针对性动作按上限筛选，
    不因关注点增多而膨胀，始终保持科学、可执行。
    """
    raw = request.args.get('concerns', '')
    concerns = [c.strip() for c in raw.split(',') if c.strip() in db.CONCERNS]
    plan = db.build_resolved_plan(concerns)
    return jsonify(ok=True, **plan)


# ---------------------------------------------------------------------------
# 每日打卡（我的养生方案）
# ---------------------------------------------------------------------------
def _checkin_stats(user_id):
    """统计某用户的累计打卡天数与连续打卡天数。"""
    conn = db.get_conn()
    rows = conn.execute('SELECT date FROM checkin WHERE user_id=? ORDER BY date',
                        (user_id,)).fetchall()
    conn.close()
    dates = [r['date'] for r in rows]
    today = datetime.now().strftime('%Y-%m-%d')
    date_set = set(dates)

    # 连续天数：从今天（未打卡则从昨天）开始向前连续计数
    streak = 0
    cursor = datetime.strptime(today, '%Y-%m-%d')
    if today not in date_set:
        cursor -= timedelta(days=1)
    while cursor.strftime('%Y-%m-%d') in date_set:
        streak += 1
        cursor -= timedelta(days=1)

    return {
        'total': len(dates),
        'streak': streak,
        'checked_today': today in date_set,
        'last_date': dates[-1] if dates else '',
        'recent': dates[-7:],
    }


@app.route('/api/checkin', methods=['POST'])
@require_user
def api_checkin():
    user_id = request.current_user['username']
    today = datetime.now().strftime('%Y-%m-%d')
    conn = db.get_conn()
    conn.execute('INSERT OR IGNORE INTO checkin(user_id, date, created_at) VALUES (?,?,?)',
                 (user_id, today, _now()))
    conn.commit()
    conn.close()
    return jsonify(ok=True, data=_checkin_stats(user_id))


@app.route('/api/checkin')
def api_checkin_get():
    user = _current_user()
    user_id = user['username'] if user else (request.args.get('user_id') or '').strip()
    empty = {'total': 0, 'streak': 0, 'checked_today': False, 'last_date': '', 'recent': []}
    if not user_id:
        return jsonify(ok=True, data=empty)
    return jsonify(ok=True, data=_checkin_stats(user_id))


@app.route('/api/checkin/reset', methods=['POST'])
def api_checkin_reset():
    """重新填写自查报告后，清除当天的打卡记录，让打卡任务回到未打卡状态。"""
    body = request.get_json(silent=True) or {}
    user = _current_user()
    user_id = (user['username'] if user else str(body.get('user_id') or '')).strip()
    if not user_id:
        return jsonify(ok=False, message='缺少 user_id'), 400
    today = datetime.now().strftime('%Y-%m-%d')
    conn = db.get_conn()
    conn.execute('DELETE FROM checkin WHERE user_id=? AND date=?', (user_id, today))
    conn.commit()
    conn.close()
    return jsonify(ok=True, data=_checkin_stats(user_id))


# ---------------------------------------------------------------------------
# 数据统计
# ---------------------------------------------------------------------------
def _count_by(items, field):
    """按字段（标量或列表）统计数量，返回 [{'name','value'}] 降序。"""
    counter = {}
    for it in items:
        val = it.get(field)
        if isinstance(val, list):
            for v in val:
                counter[v] = counter.get(v, 0) + 1
        elif val:
            counter[val] = counter.get(val, 0) + 1
    return [{'name': k, 'value': v} for k, v in sorted(counter.items(), key=lambda x: -x[1])]


@app.route('/api/stats/questionnaire')
def api_stats_questionnaire():
    """关注点采集统计：面向年轻人的前台不再采集年龄段/片区/作息，仅统计关注点。"""
    conn = db.get_conn()
    rows = conn.execute('SELECT * FROM questionnaire').fetchall()
    conn.close()
    items = [build_profile(r) for r in rows]

    by_date = {}
    for r in rows:
        d = (r['created_at'] or '')[:10]
        if d:
            by_date[d] = by_date.get(d, 0) + 1

    return jsonify(ok=True, data={
        'total': len(items),
        'top_concerns': _count_by(items, 'concerns')[:5],
        'all_concerns': _count_by(items, 'concerns'),
        'by_date': [{'name': k, 'value': v} for k, v in sorted(by_date.items())],
    })


@app.route('/api/stats/resources')
def api_stats_resources():
    conn = db.get_conn()
    rows = conn.execute('SELECT * FROM resource').fetchall()
    fb = conn.execute('SELECT type, COUNT(*) AS c FROM feedback GROUP BY type').fetchall()
    conn.close()
    items = [resource_to_dict(r) for r in rows]

    total_views = sum(i.get('views', 0) for i in items)
    fb_map = {'useful': 0, 'useless': 0, 'confusing': 0}
    for r in fb:
        fb_map[r['type']] = r['c']
    fb_total = sum(fb_map.values())
    positive_rate = round(fb_map['useful'] / fb_total * 100, 1) if fb_total else 0

    return jsonify(ok=True, data={
        'total': len(items),
        'total_views': total_views,
        'by_type': _count_by(items, 'type'),
        'views_by_type': _count_by_views(items),
        'feedback': {**fb_map, 'total': fb_total, 'positive_rate': positive_rate},
        'top_viewed': [{'name': i['title'], 'value': i['views']}
                       for i in sorted(items, key=lambda x: -x['views'])[:5]],
    })


def _count_by_views(items):
    """按类型汇总浏览量。"""
    counter = {}
    for i in items:
        t = i.get('type') or '其他'
        counter[t] = counter.get(t, 0) + i.get('views', 0)
    return [{'name': k, 'value': v} for k, v in sorted(counter.items(), key=lambda x: -x[1])]


@app.route('/api/stats/geo')
def api_stats_geo():
    """健康数据地图：年轻人健康困扰的区域分布。

    数据由两部分构成：
      1) 全国调研基线——依据公开健康调研报告（丁香医生《国民健康洞察报告》系列、
         中科院心理所《中国国民心理健康发展报告》）的困扰发生率，叠加国家统计局
         《第七次全国人口普查公报》的各省人口规模推算得到；
      2) 本平台实时采集——用户在平台点选的养生关注点，按所填省份计入。
    两者相加得到展示值，随平台用户点选实时变化。
    """
    conn = db.get_conn()
    rows = conn.execute('SELECT * FROM questionnaire').fetchall()
    conn.close()

    total_pop = sum(db.PROVINCE_POP.values()) or 1
    baseline_sample = db.BASELINE_SAMPLE

    # 本平台实时采集：省 -> {病症: 计数}
    live_pc = {}
    live_records = 0
    for r in rows:
        prov = r['province'] or ''
        cons = _loads(r['concerns']) or []
        if not prov:
            continue
        live_records += 1
        pc = live_pc.setdefault(prov, {})
        for c in cons:
            pc[c] = pc.get(c, 0) + 1

    # 基线 + 实时：逐省逐病症合并
    # 注意：各困扰的区域分布（地图选困扰 / 高发区域 TOP5）只用全国调研基线，
    # 平台实时采集仅在「关注点总量」与「本平台实时采集」图表中单独呈现。
    by_province_concern = {}
    by_province = {}
    by_concern = {}
    for prov in db.PROVINCES:
        share = db.PROVINCE_POP.get(prov, 0) / total_pop
        base_prov = baseline_sample * share
        pc = {}
        total = 0
        for c in db.CONCERNS:
            base_c = round(base_prov * db.CONCERN_PREVALENCE.get(c, 0))
            live_c = live_pc.get(prov, {}).get(c, 0)
            pc[c] = base_c                 # 区域分布仅用调研基线
            total += base_c + live_c       # 省份总量 = 基线 + 平台实时
            by_concern[c] = by_concern.get(c, 0) + base_c
        by_province_concern[prov] = pc
        by_province[prov] = total

    # 每个病症的 TOP5 高发区域：按「每万人关注度指数」排序
    # （发生率 × 区域修正系数，避免结果被人口规模主导，导致所有困扰前五名完全相同）
    concern_top = []
    for c, total in sorted(by_concern.items(), key=lambda x: -x[1]):
        ranked = sorted(
            ((p, round(db.CONCERN_PREVALENCE.get(c, 0) * db.concern_region_factor(p, c) * 10000))
             for p in db.PROVINCES),
            key=lambda x: -x[1])[:5]
        concern_top.append({'concern': c, 'total': total, 'metric': '每万人关注度指数',
                            'provinces': [{'name': k, 'value': v} for k, v in ranked]})

    live_total = sum(v for pc in live_pc.values() for v in pc.values())
    return jsonify(ok=True, data={
        'baseline_sample': baseline_sample,
        'live_records': live_records,
        'live_total': live_total,
        'provinces': db.PROVINCES,
        'by_province': [{'name': k, 'value': v}
                        for k, v in sorted(by_province.items(), key=lambda x: -x[1])],
        'by_province_concern': by_province_concern,
        'by_concern': [{'name': k, 'value': v}
                       for k, v in sorted(by_concern.items(), key=lambda x: -x[1])],
        # 本平台实时采集（仅平台数据，用于展示实时增长）
        'live_by_concern': [{'name': c, 'value': sum(live_pc.get(p, {}).get(c, 0) for p in live_pc)}
                            for c in db.CONCERNS
                            if sum(live_pc.get(p, {}).get(c, 0) for p in live_pc) > 0],
        'concern_top': concern_top,
        'sources': [
            '国家统计局《第七次全国人口普查公报》（2021）· 各省人口规模',
            '中国科学院心理研究所《中国国民心理健康发展报告（2021—2022）》· 焦虑风险检出率',
            '丁香医生《国民健康洞察报告》系列（2019—2022）· 国民健康困扰发生率',
            '区域差异修正：综合各地气候、饮食结构与作息特征的公开调研口径整理的估算系数',
        ],
    })


@app.route('/api/stats/mind')
def api_stats_mind():
    """后台：思虑内耗与躯体困扰、草本人格、补剂偏好的匿名汇总。"""
    conn = db.get_conn()
    rows = conn.execute('SELECT * FROM quiz_result').fetchall()
    conn.close()

    body_agg = {}
    herb_agg = {}
    supp_agg = {}
    for r in rows:
        labels = _loads(r['body_labels']) or []
        is_high = r['mind_level'] == 'high'
        for lb in labels:
            a = body_agg.setdefault(lb, {'total': 0, 'high': 0})
            a['total'] += 1
            if is_high:
                a['high'] += 1
        h = herb_agg.setdefault(r['herb_name'] or '未匹配', {'high': 0, 'mild': 0, 'stable': 0})
        if r['mind_level'] in h:
            h[r['mind_level']] += 1
        if is_high:
            for s in (_loads(r['supplements']) or []):
                if s and s != '目前没有服用':
                    supp_agg[s] = supp_agg.get(s, 0) + 1

    body_high = [
        {'name': k, 'total': v['total'], 'high': v['high'],
         'rate': round(v['high'] / v['total'] * 100) if v['total'] else 0}
        for k, v in sorted(body_agg.items(), key=lambda x: -x[1]['total'])
    ]
    herb_mind = [
        {'name': k, 'high': v['high'], 'mild': v['mild'], 'stable': v['stable']}
        for k, v in sorted(herb_agg.items(), key=lambda x: -(x[1]['high'] + x[1]['mild'] + x[1]['stable']))
    ]
    supp_pref = [{'name': k, 'value': v} for k, v in sorted(supp_agg.items(), key=lambda x: -x[1])]

    return jsonify(ok=True, data={
        'total': len(rows),
        'body_high': body_high,
        'herb_mind': herb_mind,
        'supp_pref': supp_pref,
    })


# ---------------------------------------------------------------------------
# 普通用户账号体系（注册 / 登录 / 资料 / 意见反馈）
# ---------------------------------------------------------------------------
@app.route('/api/user/register', methods=['POST'])
def api_user_register():
    body = request.get_json(silent=True) or {}
    username = (body.get('username') or '').strip()
    password = body.get('password') or ''
    if len(username) < 3:
        return jsonify(ok=False, message='用户名至少 3 个字符'), 400
    if len(password) < 6:
        return jsonify(ok=False, message='密码至少 6 位'), 400
    conn = db.get_conn()
    exists = conn.execute('SELECT id FROM app_user WHERE username=?', (username,)).fetchone()
    if exists:
        conn.close()
        return jsonify(ok=False, message='该用户名已被注册'), 409
    conn.execute(
        'INSERT INTO app_user(username, password, gender, province, created_at) '
        'VALUES (?,?,?,?,?)',
        (username, db.hash_pw(password),
         body.get('gender') or '保密', body.get('province') or '', _now()))
    conn.commit()
    row = conn.execute('SELECT * FROM app_user WHERE username=?', (username,)).fetchone()
    conn.close()
    token = uuid.uuid4().hex
    _save_token(token, row['id'])
    return jsonify(ok=True, token=token, user=user_to_dict(row))


@app.route('/api/user/login', methods=['POST'])
def api_user_login():
    body = request.get_json(silent=True) or {}
    username = (body.get('username') or '').strip()
    password = body.get('password') or ''
    conn = db.get_conn()
    row = conn.execute('SELECT * FROM app_user WHERE username=?', (username,)).fetchone()
    conn.close()
    if not row or not db.verify_pw(password, row['password']):
        return jsonify(ok=False, message='用户名或密码错误'), 401
    token = uuid.uuid4().hex
    _save_token(token, row['id'])
    return jsonify(ok=True, token=token, user=user_to_dict(row))


@app.route('/api/user/logout', methods=['POST'])
def api_user_logout():
    token = request.headers.get('X-User-Token', '')
    USER_TOKENS.pop(token, None)
    if token:
        conn = db.get_conn()
        conn.execute('DELETE FROM user_token WHERE token=?', (token,))
        conn.commit()
        conn.close()
    return jsonify(ok=True)


@app.route('/api/user/me')
def api_user_me():
    user = _current_user()
    if not user:
        return jsonify(ok=False, message='未登录'), 401
    return jsonify(ok=True, user=user_to_dict(user))


@app.route('/api/user/profile', methods=['PUT'])
@require_user
def api_user_update_profile():
    body = request.get_json(silent=True) or {}
    user = request.current_user
    gender = body.get('gender', user['gender']) or '保密'
    province = body.get('province', user['province']) or ''
    if gender not in db.GENDERS:
        gender = '保密'
    if province and province not in db.PROVINCES:
        province = ''
    conn = db.get_conn()
    conn.execute('UPDATE app_user SET gender=?, province=? WHERE id=?',
                 (gender, province, user['id']))
    conn.commit()
    row = conn.execute('SELECT * FROM app_user WHERE id=?', (user['id'],)).fetchone()
    conn.close()
    return jsonify(ok=True, user=user_to_dict(row))


@app.route('/api/suggestions', methods=['POST'])
@require_user
def api_suggestion_create():
    body = request.get_json(silent=True) or {}
    category = body.get('category') or '其他'
    content = (body.get('content') or '').strip()
    if category not in db.SUGGESTION_CATEGORIES:
        category = '其他'
    if len(content) < 5:
        return jsonify(ok=False, message='反馈内容至少 5 个字符'), 400
    user = request.current_user
    conn = db.get_conn()
    conn.execute('INSERT INTO suggestion(user_id, category, content, created_at) VALUES (?,?,?,?)',
                 (user['username'], category, content, _now()))
    conn.commit()
    conn.close()
    return jsonify(ok=True)


# ---------------------------------------------------------------------------
# 管理员登录
# ---------------------------------------------------------------------------
@app.route('/api/admin/login', methods=['POST'])
def api_admin_login():
    body = request.get_json(silent=True) or {}
    username = body.get('username', '')
    password = body.get('password', '')
    conn = db.get_conn()
    row = conn.execute('SELECT * FROM admin WHERE username=? AND password=?',
                       (username, password)).fetchone()
    conn.close()
    if not row:
        return jsonify(ok=False, message='账号或密码错误'), 401
    token = uuid.uuid4().hex
    ADMIN_TOKENS.add(token)
    return jsonify(ok=True, token=token, username=row['username'])


@app.route('/api/admin/logout', methods=['POST'])
def api_admin_logout():
    token = request.headers.get('X-Admin-Token', '')
    ADMIN_TOKENS.discard(token)
    return jsonify(ok=True)


@app.route('/api/admin/summary')
@require_admin
def api_admin_summary():
    """管理端补充概览：注册用户数、意见反馈数及最新反馈列表。"""
    conn = db.get_conn()
    user_count = conn.execute('SELECT COUNT(*) AS c FROM app_user').fetchone()['c']
    sugg_count = conn.execute('SELECT COUNT(*) AS c FROM suggestion').fetchone()['c']
    sugg_rows = conn.execute(
        'SELECT * FROM suggestion ORDER BY id DESC LIMIT 20').fetchall()
    conn.close()
    return jsonify(ok=True, data={
        'user_count': user_count,
        'suggestion_count': sugg_count,
        'suggestions': [dict(r) for r in sugg_rows],
    })


if __name__ == '__main__':
    db.init_db()
    # 本地：python app.py 直接跑；Render 等平台：PORT 环境变量注入
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)

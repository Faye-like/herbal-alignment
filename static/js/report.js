/* 身心报告页：草本人格 + 身心状态 + 食疗养护 + 次匹配 + 药材塑图鉴入口 */
injectNav('/report', false);
injectFooter();

function saveHerbProfile(report) {
  try {
    const h = report.herb || {};
    localStorage.setItem(scopedKey('herb_profile'), JSON.stringify({
      id: report.top_id,
      name: h.name,
      nickname: h.nickname || h.name,
      herb: h.herb,
      image: h.image,
      color: h.color,
      tagline: h.tagline,
      traits: h.traits || [],
      slang: h.slang || '',
      health_focus: h.health_focus || '',
      effect_intro: h.effect_intro || '',
      focus_intro: h.focus_intro || '',
      advice: h.advice || [],
      school: (report.persona || {}).school || '',
      mind_level: (report.mind || {}).level || '',
      mind_label: (report.mind || {}).label || '',
      body_labels: (report.body || {}).labels || [],
      saved_at: new Date().toISOString()
    }));
  } catch (e) { /* 本地存储不可用时忽略 */ }
}

const INFO_ICON =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.4"></circle>' +
  '<path d="M8 7.2v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>' +
  '<circle cx="8" cy="4.9" r="0.85" fill="currentColor"></circle></svg>';

const SEC_ICONS = {
  '养护方案':
    '<path d="M13.2 3.2C8.4 3.2 4.5 5.8 4.5 9.6c0 1.9 1.4 3.2 3.2 3.2 3.9 0 5.5-4.6 5.5-9.6Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"></path>' +
    '<path d="M4.2 13.2c1-2.6 2.6-4.4 5-5.6" fill="none" stroke="currentColor" ' +
    'stroke-width="1.4" stroke-linecap="round"></path>',
  '关联科普':
    '<path d="M3 3.6h3.4c1 0 1.6.6 1.6 1.5v7.3c0-.9-.6-1.5-1.6-1.5H3V3.6Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"></path>' +
    '<path d="M13 3.6H9.6c-1 0-1.6.6-1.6 1.5v7.3c0-.9.6-1.5 1.6-1.5H13V3.6Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"></path>',
  '你的药材塑匹配':
    '<path d="M8 2.2l1.35 4.05L13.4 7.6l-4.05 1.35L8 13.4 6.65 8.95 2.6 7.6l4.05-1.35L8 2.2Z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round"></path>'
};

function infoNote(text) {
  return '<div class="info-note"><span class="info-ico">' + INFO_ICON + '</span>' +
    '<span class="info-text">' + text + '</span></div>';
}

function section(title, inner, cls) {
  const icon = title
    ? '<span class="sec-ico"><svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">' +
      (SEC_ICONS[title] || '') + '</svg></span>'
    : '';
  return '<div class="rp-card' + (cls ? ' ' + cls : '') + '">' +
    (title ? '<div class="report-sec-title">' + icon + '<span>' + title + '</span></div>' : '') +
    inner + '</div>';
}

function sub(title) {
  return '<div class="rp-subtitle">' + title + '</div>';
}

function divider() {
  return '<div class="rp-divider"></div>';
}

function renderReport() {
  const raw = sessionStorage.getItem(scopedKey('quiz_report'));
  const box = document.getElementById('reportContent');

  if (!raw) {
    box.innerHTML =
      '<div class="report-empty">' +
      '<div class="re-title">还没有报告哦</div>' +
      '<p>先去完成身心自查问卷，才能生成属于你的草本养生人格报告。</p>' +
      '<a class="btn" href="/quiz">去做自查问卷</a></div>';
    return;
  }

  let report;
  try { report = JSON.parse(raw); } catch (e) {
    box.innerHTML = '<div class="empty">报告数据解析失败，请重新测试。</div>';
    return;
  }

  const h = report.herb || {};
  const nick = h.nickname || h.name || '';
  const topId = report.top_id;
  const scores = report.scores || [];
  const second = report.second;
  const allTypes = report.all_types || [];
  const persona = report.persona || {};
  const body = report.body || {};
  const mind = report.mind || {};
  const food = report.food || {};
  const reminders = report.reminders || {};
  const demands = report.demands || [];
  const supplements = report.supplements || [];
  const knowledge = report.knowledge || [];
  const basis = report.basis || [];
  const custom = report.custom || {};
  const profile = report.profile || {};
  const bmi = profile.bmi || null;

  saveHerbProfile(report);
  // 完整报告另存一份，供打卡与查阅页按报告内容生成计划
  try { localStorage.setItem(scopedKey('quiz_report_saved'), JSON.stringify(report)); } catch (e) { /* 忽略 */ }

  /* 1. 顶部：昵称 / 药材本名 / 派别，下方左图右文 */
  let html =
    '<div class="report-hero" style="--accent:' + (h.color || '#57B0A2') + '">' +
      '<h1 class="report-name">' + escapeHtml(nick) + '</h1>' +
      '<div class="report-herb-name">' + escapeHtml(h.herb || '') + '</div>' +
      '<div class="report-school">' + escapeHtml(persona.school || '') + '</div>' +
      '<div class="report-hero-body">' +
        '<div class="report-hero-img"><img src="' + escapeAttr(h.image || '') + '" alt="' + escapeAttr(h.herb || '') + '"></div>' +
        '<div class="report-hero-text">' +
          '<div class="hero-block">' +
            '<div class="hero-k">药材相关介绍</div>' +
            '<div class="report-herb">' + escapeHtml(h.tagline || '') + '</div>' +
          '</div>' +
          '<div class="hero-block">' +
            '<div class="hero-k">药材塑性格介绍</div>' +
            '<p class="report-slang">' + escapeHtml(h.slang || '') + '</p>' +
            '<div class="report-traits">' +
              (h.traits || []).map(t => '<span class="report-trait">' + escapeHtml(t) + '</span>').join('') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  /* 2. 关于你：药材作用 + 诉求 + 补剂 + 身心状态，合并为一张卡 */
  let suppInner;
  if (supplements.length) {
    suppInner = '<div class="supp-list">' + supplements.map(s =>
      '<div class="supp-line"><b>' + escapeHtml(s.name) + '</b>' +
      '<span class="supp-note-inline">' + escapeHtml(s.note || '') + '</span></div>').join('') + '</div>' +
      '<p class="supp-note-line">以上仅为服用时间与搭配提示，不构成用药建议；正在服药或有慢性病，调整前请先咨询医生。</p>';
  } else {
    suppInner = '<p class="rp-plain">目前没有服用补剂。优先通过日常饮食获取营养，不建议自行叠加补剂。</p>';
  }

  const bodyTags = (body.labels || []).length ? body.labels : ['整体平稳型'];
  const customFocus = custom.focus || [];
  const customNote = customFocus.length
    ? '<div class="custom-note">' + customFocus.map(f =>
        '「' + escapeHtml(f.text) + '」已归到' + escapeHtml(f.label) + '：' + escapeHtml(f.tip)).join('<br>') +
      '</div>'
    : '';
  const bmiPct = bmi ? Math.min(100, Math.max(4, (bmi.value - 15) / 17 * 100)) : 0;

  const aboutInner =
    '<p class="ri-lead">' + escapeHtml(h.effect_intro || '') + '</p>' +
    '<div class="ri-focus"><span class="ri-focus-label">养生重点</span>' + escapeHtml(h.health_focus || '') + '</div>' +
    '<p class="ri-text">' + escapeHtml(h.focus_intro || '') + '</p>' +
    divider() +
    sub('你的诉求回顾') +
    (demands.length
      ? '<div class="chip-static">' + demands.map(d => '<span class="chip-tag">' + escapeHtml(d) + '</span>').join('') + '</div>'
      : '<p class="rp-plain">本次没有选择具体诉求。</p>') +
    sub('你当前正在服用') + suppInner +
    sub('你的身心状态参考') +
    '<div class="state-row"><span class="state-k">躯体状态</span>' +
      '<span class="state-pills">' + bodyTags.map(t =>
        '<span class="state-pill">' + escapeHtml(t) + '</span>').join('') + '</span></div>' +
    '<div class="state-row"><span class="state-k">思虑状态</span>' +
      '<span class="state-pill' + (mind.level === 'high' ? ' is-high' : '') + '">' +
      escapeHtml(mind.label || '思虑平稳') + '</span></div>' +
    (mind.desc ? '<p class="rp-plain">' + escapeHtml(mind.desc) + '</p>' : '') +
    '<p class="note-line">思虑内耗状态参考 ≠ 心理测评，仅观察日常思虑习惯；如果长期情绪痛苦，建议寻求专业心理支持。</p>' +
    (bmi
      ? sub('身高体重与 BMI') +
        '<div class="bmi-meter">' +
          '<div class="bmi-head"><span class="bmi-k">BMI</span>' +
            '<b class="bmi-val">' + bmi.value + '</b>' +
            '<span class="bmi-pill bmi-' + escapeAttr(bmi.level || 'normal') + '">' +
            escapeHtml(bmi.label) + '</span></div>' +
          '<div class="bmi-track"><span class="bmi-fill" style="width:' + bmiPct + '%"></span></div>' +
          '<div class="bmi-scale"><span>18.5</span><span>24</span><span>28</span></div>' +
          '<p class="bmi-hint">身高 ' + escapeHtml(String(profile.height || '-')) + ' cm · 体重 ' +
            escapeHtml(String(profile.weight || '-')) + ' kg，仅供参考，不必被单个数字定义。</p>' +
        '</div>' +
        '<p class="rp-plain">' + escapeHtml(bmi.advice || '') + '</p>' +
        '<p class="note-line">BMI 采用中国成人标准（《中国成人超重和肥胖症预防控制指南》）：低于 18.5 为偏瘦，18.5-23.9 为正常，24.0-27.9 为超重，28 及以上为肥胖；仅用于体重管理参考，不替代体成分与代谢检查。</p>'
      : '') +
    sub('身心联动解读') +
    '<p class="rp-plain">' + escapeHtml(report.linkage || '') + '</p>';

  html += section('', aboutInner);

  /* 3. 养护方案：提醒 + 食疗 + 舒缓练习，合并为一张卡 */
  let careInner = '';
  if (reminders.body) careInner +=
    '<div class="remind-row"><span class="remind-k">躯体风险提醒</span><p>' + escapeHtml(reminders.body) + '</p></div>';
  if (reminders.mind) careInner +=
    '<div class="remind-row"><span class="remind-k">思虑内耗提醒</span><p>' + escapeHtml(reminders.mind) + '</p></div>';
  if (reminders.persona) careInner +=
    '<div class="remind-row"><span class="remind-k">人格行为提醒</span><p>' + escapeHtml(reminders.persona) + '</p></div>';
  if (!careInner) careInner = '<p class="rp-plain">暂无特别提醒。</p>';
  careInner += customNote;

  careInner += divider() + sub('食疗方案') +
    '<div class="food-style">' + escapeHtml(food.style || '') + '</div>' +
    '<div class="dish-list">' + (food.dishes || []).map(d =>
      '<div class="dish-item"><b>' + escapeHtml(d.name) + '</b><p>' + escapeHtml(d.desc) + '</p></div>').join('') + '</div>';
  let foodNote = '';
  if (food.note && food.supplement_note) {
    foodNote = (mind.level === 'stable' && !supplements.length)
      ? '目前思虑状态平稳、也没有服用补剂，不需要额外增加心理舒缓任务，优先通过日常饮食获取营养、不建议自行叠加补剂。'
      : String(food.note).replace(/。$/, '') + '；' + String(food.supplement_note).replace(/。$/, '') + '。';
  } else {
    foodNote = food.note || food.supplement_note || '';
  }
  if (foodNote) careInner += '<p class="food-note-line">' + escapeHtml(foodNote) + '</p>';
  if (food.practice) {
    careInner += sub('日常舒缓小练习') +
      '<div class="practice-box"><b>' + escapeHtml(food.practice.name) + '</b>' +
      '<p>' + escapeHtml(food.practice.desc) + '</p></div>';
  }

  html += section('养护方案', careInner);

  /* 4. 关联科普 */
  if (knowledge.length) {
    html += section('关联科普',
      '<div class="know-list">' + knowledge.map(k =>
        '<div class="know-item"><b>' + escapeHtml(k.title) + '</b><p>' + escapeHtml(k.text) + '</p></div>').join('') + '</div>');
  }

  /* 5. 匹配依据 + 匹配占比 + 次匹配 + 图鉴，合并为一张卡 */
  let matchInner = sub('为什么匹配到「' + escapeHtml(nick) + '」') +
    (report.match_reason ? '<p class="match-reason">' + escapeHtml(report.match_reason) + '</p>' : '') +
    (basis.length
      ? '<div class="match-basis">' + basis.map(b =>
          '<div class="mb-row"><span class="mb-k">' + escapeHtml(b.dim) + '</span>' +
          '<span class="mb-v">' + escapeHtml(b.answer) + '</span>' +
          '<span class="mb-p">+' + b.points + '</span></div>').join('') + '</div>'
      : '') +
    '<p class="note-line">以上依据来自你的作答：行为题按选项权重计分，近期躯体状态与思虑倾向会额外加权；仅为养生参考，不作诊断。</p>' +
    divider() +
    sub('各药材塑匹配占比') +
    '<div class="report-score-list">' + scores.map(s =>
      '<div class="report-score-row' + (s.id === topId ? ' is-top' : '') + '">' +
      '<div class="rs-name">' + escapeHtml(s.name) + (s.id === topId ? ' <span class="rs-badge">你</span>' : '') + '</div>' +
      '<div class="rs-bar"><div class="rs-bar-fill" style="width:' + s.percent + '%;background:' + s.color + '"></div></div>' +
      '<div class="rs-pct">' + s.percent + '%</div></div>').join('') + '</div>';

  if (second) {
    matchInner += divider() +
      '<div class="second-head">你的次匹配' +
        '<span class="second-nick">' + escapeHtml(second.nickname || second.name) + '</span>' +
        '<span class="second-pct">' + second.percent + '%</span>' +
      '</div>' +
      '<div class="second-sub">' + escapeHtml(second.name) + ' · 药材本名 ' + escapeHtml(second.herb) +
        ' · ' + escapeHtml(second.tagline || '') + '</div>' +
      '<div class="second-flex">' +
        '<div class="second-img"><img src="' + escapeAttr(second.image) + '" alt="' + escapeAttr(second.herb) + '"></div>' +
        '<div class="second-text">' +
          '<div class="report-traits">' +
            (second.traits || []).map(t => '<span class="report-trait">' + escapeHtml(t) + '</span>').join('') +
          '</div>' +
          '<p class="second-focus"><b>养生重点：</b>' + escapeHtml(second.health_focus || '') + '</p>' +
          '<p class="second-intro">' + escapeHtml(second.effect_intro || '') + '</p>' +
        '</div>' +
      '</div>' +
      '<p class="second-note">你的体质不是单一标签：' + escapeHtml(h.name) + '是主色调，' +
        escapeHtml(second.name) + '是藏在背后的第二层，两类养生方向都可以参考，冲突时以身体的实际反应为准。</p>';
  }

  matchInner += divider() +
    '<div class="row-between wrap">' +
      '<div><div class="gallery-title">了解其他药材塑</div>' +
      '<p class="gallery-sub">共 ' + (report.total_types || allTypes.length) +
      ' 种药材塑，每一种都对应一套性格与养生方向，看看你身边的人像哪一味。</p></div>' +
      '<a class="btn ghost" href="/herbs">进入药材塑图鉴 →</a>' +
    '</div>' +
    '<div class="rg-strip">' +
      allTypes.filter(t => t.id !== topId).slice(0, 6).map(t =>
        '<a class="rg-mini" href="/herbs" style="--accent:' + t.color + '">' +
          '<img src="' + escapeAttr(t.image) + '" alt="' + escapeAttr(t.herb) + '">' +
          '<span>' + escapeHtml(t.nickname || t.name) + '</span></a>').join('') +
    '</div>';

  html += section('你的药材塑匹配', matchInner);

  html +=
    '<div class="rpt-actions">' +
      '<a class="btn" href="/quiz">重新测试</a>' +
      '<a class="btn ghost" href="/mine">去打卡</a>' +
      '<a class="btn gray" href="/">返回首页</a>' +
    '</div>';

  html += '<div class="report-refs">资料依据：中国营养学会《中国居民膳食指南（2022）》；' +
    '中国营养学会《中国居民膳食营养素参考摄入量（2023版）》；' +
    '世界卫生组织（WHO）《关于身体活动和久坐行为的指南》（2020）；' +
    '中国睡眠研究会《中国失眠症诊断和治疗指南》；' +
    '国家卫生健康委《健康中国行动（2019—2030年）》。' +
    '报告结论由你的答题结果按固定评分规则计算得出，不含随机成分。</div>';

  html += '<div class="report-disclaimer">' + escapeHtml(report.disclaimer || '') + '</div>';

  box.innerHTML = html;
}

if (requireUser()) renderReport();

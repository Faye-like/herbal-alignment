/* 打卡与查阅：报告联动的一周计划（食谱·运动·补剂）+ 每日打卡 + 查阅指引 */
let META = null;
let PLAN = null;
let todayChecked = false;
const picked = new Set();

injectNav('/mine', false);
injectFooter();

/* 个人功能需登录：未登录跳转登录页 */
const LOGGED_IN = isLoggedIn();
if (!LOGGED_IN) {
  requireUser();
}

/* ---------------- 药材塑 ---------------- */
let HERB = null;
function getHerb() {
  if (HERB) return HERB;
  try { HERB = JSON.parse(localStorage.getItem(scopedKey('herb_profile')) || 'null'); }
  catch (e) { HERB = null; }
  return HERB;
}

/* ---------------- 自查报告 ---------------- */
let REPORT = null;
function getReport() {
  if (REPORT) return REPORT;
  const raw = sessionStorage.getItem(scopedKey('quiz_report')) ||
    localStorage.getItem(scopedKey('quiz_report_saved'));
  if (!raw) return null;
  try { REPORT = JSON.parse(raw); } catch (e) { REPORT = null; }
  return REPORT;
}

/* 报告里的躯体维度 → 每天可执行的 1 条微行动（依据见 db.py / quiz.py 注释） */
const REPORT_ACTIONS = {
  digest: {
    title: '饭后慢走 10 分钟',
    detail: '报告显示你的消化代谢偏弱：餐后缓步走动有助于胃排空，避免吃完立刻久坐。',
  },
  energy: {
    title: '午后晒 10 分钟太阳',
    detail: '报告显示你容易精力不足：白天接触自然光有助于稳定昼夜节律，减少白天困倦。',
  },
  sleep: {
    title: '睡前 1 小时离开屏幕',
    detail: '报告显示你的睡眠情绪较敏感：睡前减少强光与信息刺激，比任何助眠补剂都更基础。',
  },
  strain: {
    title: '每工作 45 分钟起身 2 分钟',
    detail: '报告显示你有躯体劳损表现：定时起身活动比事后按摩更能减轻肩颈与腰背负担。',
  },
  skin: {
    title: '把含糖饮料换成白水',
    detail: '报告显示你的肤发内分泌需要关注：减少游离糖摄入，对皮脂分泌和血糖波动都更友好。',
  },
};

function reportActions(r) {
  const acts = [];
  if (!r) return acts;
  const topHit = (r.body && r.body.top) || null;
  if (topHit && REPORT_ACTIONS[topHit.id]) acts.push(REPORT_ACTIONS[topHit.id]);
  if (r.mind && r.mind.level === 'high') {
    acts.push({
      title: '4-7-8 呼吸，一次 4 轮',
      detail: '思虑内耗偏高时不追求完成全部任务：吸气 4 秒、屏息 7 秒、呼气 8 秒，重复 4 轮即可。',
    });
  }
  return acts.slice(0, 2);
}

/* 把报告结果并入计划：运动 ≤4 条、日常注意仍为 1 条、食谱加餐写入报告食疗 */
function applyReportToPlan(plan) {
  const r = getReport();
  if (!r || !plan) return plan;

  const ex = Array.isArray(plan.merged_exercise) ? plan.merged_exercise.slice() : [];
  const universal = ex.filter(e => e.source).slice(0, 2);
  const specific = ex.filter(e => !e.source).slice(0, 1);
  const herbEx = (r.plan_extra && r.plan_extra.exercise) ? [r.plan_extra.exercise] : [];
  plan.merged_exercise = universal.concat(reportActions(r)).concat(herbEx).concat(specific).slice(0, 4);

  // 日常注意保持 1 条：人格建议 + 思虑偏高时的低负担原则，就医提醒仍放句末
  if ((plan.merged_care || []).length) {
    const care = plan.merged_care[0];
    const close = '请及时就医。';
    const i = care.lastIndexOf(close);
    const extra = [];
    if (r.plan_extra && r.plan_extra.care) extra.push(r.plan_extra.care);
    if (r.mind && r.mind.level === 'high') {
      extra.push('思虑内耗偏高，打卡完成一两项就算达标，不要为了全勤硬撑；');
    }
    if (extra.length) {
      plan.merged_care[0] = i >= 0
        ? care.slice(0, i) + extra.join('') + care.slice(i)
        : care + extra.join('');
    }
  }

  // 食谱：报告食疗菜轮换加入每天的加餐
  const dishes = (r.food && r.food.dishes) || [];
  if (dishes.length && Array.isArray(plan.week_menu)) {
    plan.week_menu = plan.week_menu.map((d, i) => {
      const dish = dishes[i % dishes.length];
      const merged = Object.assign({}, d);
      merged.snack = (d.snack ? d.snack + ' + ' : '') + '报告食疗 · ' + dish.name;
      return merged;
    });
  }

  plan.report = r;
  return plan;
}

function toggleSection(id, show) {
  const el = document.getElementById(id);
  if (el) el.style.display = show ? '' : 'none';
}

/* 是否已填写完整自查报告：报告须带养生诉求 */
function hasReport() {
  const r = getReport();
  return !!(r && (r.demands || []).length);
}

function renderHerbBanner() {
  const h = getHerb();
  const box = document.getElementById('herbBanner');
  // 未填写自查报告时，不展示药材塑人格
  if (!hasReport() || !h || !h.name) { box.style.display = 'none'; return; }
  box.style.display = '';
  box.className = 'mb16';
  const nick = h.nickname || h.name;
  // 与报告页顶部保持同一套结构与样式
  box.innerHTML =
    '<div class="report-hero herb-hero" style="--accent:' + (h.color || '#57B0A2') + '">' +
      '<h1 class="report-name">' + escapeHtml(nick) + '</h1>' +
      '<div class="report-herb-name">' + escapeHtml(h.herb || '') + '</div>' +
      '<div class="report-school">' + escapeHtml(h.school || '') + '</div>' +
      '<div class="report-hero-body">' +
        '<div class="report-hero-img"><img src="' + escapeAttr(h.image || '') + '" alt="' + escapeAttr(h.herb || '') + '"></div>' +
        '<div class="report-hero-text">' +
          '<div class="hero-block">' +
            '<div class="hero-k">药材塑性格</div>' +
            '<p class="report-slang">' + escapeHtml(h.slang || '') + '</p>' +
            '<div class="report-traits">' +
              (h.traits || []).map(t => '<span class="report-trait">' + escapeHtml(t) + '</span>').join('') +
            '</div>' +
          '</div>' +
          '<div class="hero-block">' +
            '<div class="hero-k">养生重点</div>' +
            '<p class="report-herb">' + escapeHtml(h.health_focus || '') + '</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="herb-hero-actions">' +
        '<a class="btn sm" href="/report">查看我的自查报告</a>' +
        '<a class="btn ghost sm" href="/herbs">看其他药材塑</a>' +
      '</div>' +
    '</div>';
}

/* ---------------- 关注点 ---------------- */
function renderConcernTags() {
  const box = document.getElementById('concernTags');
  if (!picked.size) {
    box.innerHTML = '<span class="muted" style="font-size:13px">未填写</span>';
    return;
  }
  box.innerHTML = tagsHtml([...picked], 'solid');
}

function renderPicker() {
  const box = document.getElementById('concernPicker');
  if (!box || !META) return;
  box.innerHTML = (META.concerns || []).map(c =>
    '<button type="button" class="opt' + (picked.has(c) ? ' on' : '') +
    '" data-c="' + escapeAttr(c) + '">' + escapeHtml(c) + '</button>').join('');
  box.querySelectorAll('.opt').forEach(b => {
    b.onclick = () => {
      const c = b.dataset.c;
      if (picked.has(c)) picked.delete(c); else picked.add(c);
      b.classList.toggle('on', picked.has(c));
      renderConcernTags();
    };
  });
}

async function saveConcerns() {
  if (!picked.size) return toast('请至少选择一个关注点', 'err');
  const btn = document.getElementById('saveBtn');
  btn.disabled = true;
  btn.textContent = '保存中…';
  try {
    const res = await api('/api/questionnaire/submit', {
      method: 'POST',
      body: { user_id: effectiveUserId() || undefined, concerns: [...picked] }
    });
    setUserId(res.user_id);
    setProfile(res.profile);
    toast('关注点已保存，计划已生成');
    toggleSection('secCheckin', true);
    await Promise.all([loadCheckin(), loadPlan(), loadGuide()]);
  } catch (e) {
    toast(e.message, 'err');
  }
  btn.disabled = false;
  btn.textContent = '保存并生成计划';
}

/* ---------------- 打卡 ---------------- */
function renderCheckin(d) {
  document.getElementById('ckStreak').textContent = d.streak;
  document.getElementById('ckTotal').textContent = d.total;
  const btn = document.getElementById('ckBtn');
  btn.disabled = d.checked_today;
  btn.textContent = d.checked_today ? '今日已打卡 ✓' : '今日打卡';
  const h = getHerb();
  const tail = h && h.name ? ' · ' + h.name + '今天也要照顾好自己' : '';
  document.getElementById('ckHint').textContent = d.checked_today
    ? '今天已经打过卡，任务已锁定为完成状态，明天再来～' + tail
    : '每天打卡一次，记录你的坚持' + tail;
  // 今日已打卡：任务全部勾选且不可取消
  const changed = todayChecked !== !!d.checked_today;
  todayChecked = !!d.checked_today;
  if (changed && PLAN) renderTasks();
}

async function loadCheckin() {
  try {
    const res = await api('/api/checkin?user_id=' + encodeURIComponent(effectiveUserId()));
    renderCheckin(res.data);
  } catch (e) {
    document.getElementById('ckHint').textContent = '打卡状态加载失败';
  }
}

async function doCheckin() {
  const btn = document.getElementById('ckBtn');
  btn.disabled = true;
  try {
    const res = await api('/api/checkin', { method: 'POST', body: { user_id: effectiveUserId() } });
    renderCheckin(res.data);
    checkAllTasks();
    renderTasks();
    const h = getHerb();
    toast(h && h.name
      ? '打卡成功，' + (h.nickname || h.name) + '今天也稳住了，任务已全部勾选'
      : '打卡成功，今日任务已全部勾选');
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false;
  }
}

/* ---------------- 每日 / 每周计划 ---------------- */
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
function todayName() { return WEEKDAYS[new Date().getDay()]; }

/* 当前查看/打卡的星期：默认今天，点击一周食谱中的某天可切换查看 */
let selectedDay = todayName();

/* 清单勾选状态按日期本地存储，隔日自动重置 */
function checkKey() { return scopedKey('plan_check') + '_' + new Date().toISOString().slice(0, 10); }
function getChecked() {
  try { return JSON.parse(localStorage.getItem(checkKey()) || '[]'); } catch (e) { return []; }
}
function saveChecked(arr) { localStorage.setItem(checkKey(), JSON.stringify(arr)); }

/* 当日计划只列当天会变化的内容（饮食）。
   运动 / 日常注意 / 补剂每天都一样，统一放到下方「每天坚持的事」，
   不逐日重复，避免每日计划冗长。 */
function buildTasks(plan, day) {
  const tasks = [];
  const d = (plan.week_menu || []).find(x => x.day === day);
  if (d) {
    [['早餐', d.breakfast], ['午餐', d.lunch], ['晚餐', d.dinner], ['加餐', d.snack]]
      .forEach(([k, v]) => {
        if (v) tasks.push({ k: '饮食·' + k, title: k + '：' + v, detail: '' });
      });
  }
  return tasks;
}

function renderTasks() {
  const box = document.getElementById('taskList');
  const isToday = selectedDay === todayName();
  const tasks = buildTasks(PLAN, selectedDay);

  const label = document.getElementById('taskDayLabel');
  if (label) label.textContent = selectedDay + (isToday ? ' · 今天' : '');
  const hint = document.getElementById('taskHint');
  if (hint) hint.textContent = isToday
    ? '下面只列当天会变化的饮食安排；运动、日常注意、补剂每天都适用，统一放在下方「每天坚持的事」，不再逐日重复。'
    : '这是 ' + selectedDay + ' 的计划，仅供参考；只有当天（' + todayName() + '）可以打卡。';

  if (!tasks.length) {
    box.innerHTML = '<div class="empty">暂无可执行计划</div>';
    toggleSection('secTasks', false);
    return;
  }
  toggleSection('secTasks', true);
  const locked = isToday && todayChecked;
  const checked = isToday
    ? (locked ? tasks.map(t => t.k) : getChecked())
    : [];
  box.innerHTML = tasks.map(t =>
    '<label class="task-item' + (isToday ? (locked ? ' locked' : '') : ' readonly') +
    (checked.indexOf(t.k) >= 0 ? ' on' : '') +
    '" data-k="' + escapeAttr(t.k) + '">' +
    '<input type="checkbox"' + (checked.indexOf(t.k) >= 0 ? ' checked' : '') +
    (isToday && !locked ? '' : ' disabled') + '>' +
    '<span class="task-body"><b>' + escapeHtml(t.title) + '</b>' +
    (t.detail ? '<span class="task-detail">' + escapeHtml(t.detail) + '</span>' : '') +
    '</span></label>').join('');

  if (isToday && !locked) {
    box.querySelectorAll('.task-item').forEach(el => {
      el.querySelector('input').onchange = () => {
        const on = el.querySelector('input').checked;
        const set = getChecked().filter(k => k !== el.dataset.k);
        if (on) set.push(el.dataset.k);
        saveChecked(set);
        el.classList.toggle('on', on);
        updateProgress();
      };
    });
  }
  updateProgress();
}

function updateProgress() {
  const el = document.getElementById('taskProgress');
  if (!el) return;
  if (selectedDay !== todayName()) {
    el.textContent = '查看模式 · 仅当天可打卡';
    return;
  }
  const total = document.querySelectorAll('#taskList .task-item').length;
  const done = document.querySelectorAll('#taskList .task-item input:checked').length;
  el.textContent = '已完成 ' + done + ' / ' + total + ' 项';
}

/* 今日打卡后自动勾选当日全部任务（仅当天生效） */
function checkAllTasks() {
  if (selectedDay !== todayName()) return;
  const items = document.querySelectorAll('#taskList .task-item');
  if (!items.length) return;
  const keys = [];
  items.forEach(el => {
    const input = el.querySelector('input');
    if (input) input.checked = true;
    el.classList.add('on');
    keys.push(el.dataset.k);
  });
  saveChecked(keys);
  updateProgress();
}

function renderWeek(plan) {
  const today = todayName();
  const rows = (plan.week_menu || []).map(d => {
    const cls = [];
    if (d.day === today) cls.push('today-row');
    if (d.day === selectedDay) cls.push('sel-row');
    const badge = d.day === today ? ' <span class="day-badge">今天</span>' : '';
    return '<tr class="' + cls.join(' ') + '" data-day="' + escapeAttr(d.day) + '">' +
      '<td class="week-day">' + escapeHtml(d.day) + badge + '</td>' +
      '<td>' + escapeHtml(d.breakfast) + '</td>' +
      '<td>' + escapeHtml(d.lunch) + '</td>' +
      '<td>' + escapeHtml(d.dinner) + '</td>' +
      '<td>' + escapeHtml(d.snack) + '</td></tr>';
  }).join('');
  const table = document.getElementById('weekTable');
  table.innerHTML = rows
    ? '<table class="week-table"><thead><tr><th>星期</th><th>早餐</th><th>午餐</th><th>晚餐</th><th>加餐</th></tr></thead><tbody>' + rows + '</tbody></table>'
    : '<div class="empty">暂无食谱</div>';
  toggleSection('secWeek', !!rows);

  table.querySelectorAll('tbody tr').forEach(tr => {
    tr.onclick = () => {
      selectedDay = tr.dataset.day;
      renderWeek(PLAN);
      renderTasks();
      const box = document.getElementById('taskList');
      if (box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
  });
}

function renderExercise(plan) {
  const box = document.getElementById('exerciseBox');
  const exItems = plan.merged_exercise || [];
  const careItems = plan.merged_care || [];
  if (!exItems.length && !careItems.length) {
    box.innerHTML = '<div class="empty">暂无调理建议</div>';
    toggleSection('secDaily', false);
    return;
  }
  toggleSection('secDaily', true);
  // 合并后统一展示，不再按困扰分组
  let html = '<div class="card card-pad supp-card mb16 ex-compact">';
  html += '<div class="ex-top"><span class="plan-cat">运动调理</span></div>';
  html += '<div class="supp-rows">' + exItems.map(e =>
    '<div class="ex-row"><span class="ex-name">' + escapeHtml(e.title) + '</span>' +
    '<span class="ex-val">' + escapeHtml(e.detail || '') + '</span></div>').join('') + '</div>';
  html += '</div>';
  // 日常注意：无框注释，放在对应板块下方
  if (careItems.length) {
    html += '<div class="note-line">日常注意：' + careItems.map(t => escapeHtml(t)).join(' ') + '</div>';
  }
  if (plan.disclaimer) {
    html += '<div class="note-line">' + escapeHtml(plan.disclaimer) + '</div>';
  }
  box.innerHTML = html;
}

function renderSupplements(plan) {
  const box = document.getElementById('suppBox');
  const items = plan.supplements || [];
  const disc = plan.supplement_disclaimer;
  const r = plan.report;
  let html = '';

  // 先如实列出报告里填写的补剂，再给出客观参考
  if (r) {
    const mine = r.supplements || [];
    html += '<div class="card card-pad supp-card mb16">' +
      '<div class="ex-top"><span class="plan-cat">报告中正在服用</span></div>' +
      '<div class="supp-rows">' +
        (mine.length
          ? mine.map(s =>
              '<div class="supp-row"><span class="supp-label">' + escapeHtml(s.name) + '</span>' +
              '<span class="supp-val">' + escapeHtml(s.note || '') + '</span></div>').join('')
          : '<div class="supp-row"><span class="supp-val">报告填写为「目前没有服用补剂」。优先通过均衡饮食获取营养，不建议自行叠加。</span></div>') +
      '</div>' +
      ((r.food && r.food.supplement_note)
        ? '<div class="note-line">' + escapeHtml(r.food.supplement_note) + '</div>' : '') +
      '</div>';
  }

  if (disc) {
    html += '<div class="note-line">' + escapeHtml(disc) + '</div>';
  }
  html += items.map(s =>
    '<div class="card card-pad supp-card mb16">' +
    '<div class="row-between"><b style="font-size:15px">' + escapeHtml(s.name) + '</b>' +
    '<span class="plan-cat">' + escapeHtml(s.concern || '') + '</span></div>' +
    '<div class="supp-rows">' +
    (s.effect ? '<div class="supp-row"><span class="supp-label">作用</span><span class="supp-val">' + escapeHtml(s.effect) + '</span></div>' : '') +
    (s.audience ? '<div class="supp-row"><span class="supp-label">适用人群</span><span class="supp-val">' + escapeHtml(s.audience) + '</span></div>' : '') +
    (s.overdose ? '<div class="supp-row"><span class="supp-label">过量风险</span><span class="supp-val">' + escapeHtml(s.overdose) + '</span></div>' : '') +
    (s.food_first ? '<div class="supp-row"><span class="supp-label">食补优先</span><span class="supp-val">' + escapeHtml(s.food_first) + '</span></div>' : '') +
    '</div>' +
    (s.note ? '<div class="note-line">' + escapeHtml(s.note) + '</div>' : '') +
    (s.source ? '<div class="src-line">参考：' + escapeHtml(s.source) + '</div>' : '') + '</div>').join('');
  if (!html) { toggleSection('secSupps', false); return; }
  toggleSection('secSupps', true);
  box.innerHTML = html;
}

function renderFoods(plan) {
  const box = document.getElementById('foodsBox');
  const items = plan.by_concern || [];
  const r = plan.report;
  let html = '';

  // 报告里按答题结果生成的食疗方案，放在最前面
  if (r && r.food) {
    const f = r.food;
    html += '<div class="card card-pad supp-card mb16">' +
      '<div class="row-between"><span class="plan-cat">来自你的自查报告</span>' +
      '<span class="muted" style="font-size:12px">按答题结果生成</span></div>' +
      (f.style ? '<div class="report-food-style">' + escapeHtml(f.style) + '</div>' : '') +
      '<div class="dish-list">' + (f.dishes || []).map(d =>
        '<div class="dish-item"><b>' + escapeHtml(d.name) + '</b><p>' + escapeHtml(d.desc) + '</p></div>').join('') + '</div>' +
      (f.note ? '<div class="note-line">' + escapeHtml(f.note) + '</div>' : '') +
      (f.practice
        ? '<div class="rp-tip mt8"><b>' + escapeHtml(f.practice.name) + '</b>：' + escapeHtml(f.practice.desc) + '</div>' : '') +
      '</div>';
  }

  html += items.map(c => {
    const rows = (c.foods || []).map(f =>
      '<div class="ex-row"><span class="ex-name">' + escapeHtml(f.title) + '</span>' +
      '<span class="ex-val">' + escapeHtml(f.detail) + '</span></div>').join('');
    return '<div class="card card-pad supp-card mb16">' +
      '<div class="ex-top"><span class="plan-cat">' + escapeHtml(c.concern) + '</span></div>' +
      '<div class="supp-rows">' + rows + '</div>' +
      (c.source ? '<div class="src-line">参考：' + escapeHtml(c.source) + '</div>' : '') + '</div>';
  }).join('');

  if (!html) { toggleSection('secFoods', false); return; }
  toggleSection('secFoods', true);
  box.innerHTML = html;
}

async function loadPlan() {
  const cons = [...picked];
  if (!cons.length) return;
  try {
    const res = await api('/api/my-plan?concerns=' + encodeURIComponent(cons.join(',')));
    PLAN = applyReportToPlan(res);
    selectedDay = todayName();
    renderTasks();
    renderWeek(PLAN);
    renderFoods(PLAN);
    renderExercise(PLAN);
    renderSupplements(PLAN);
  } catch (e) {
    document.getElementById('taskList').innerHTML = '<div class="empty">计划加载失败：' + escapeHtml(e.message) + '</div>';
  }
}

/* ---------------- 知识查阅指引 ---------------- */
async function loadGuide() {
  const box = document.getElementById('guideList');
  if (!box) return;
  const cons = [...picked];
  if (!cons.length) {
    toggleSection('secGuide', false);
    return;
  }
  box.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const res = await api('/api/guide?concerns=' + encodeURIComponent(cons.join(',')));
    const list = res.concerns || [];
    if (!list.length) {
      toggleSection('secGuide', false);
      return;
    }
    toggleSection('secGuide', true);
    box.innerHTML = list.map(c =>
      '<div class="guide-item">' +
      '<div class="guide-head"><b>' + escapeHtml(c.concern) + '</b>' +
      '<span class="risk-level">' + escapeHtml(c.level || '科普关注') + '</span></div>' +
      (c.why ? '<div class="guide-why">' + escapeHtml(c.why) + '</div>' : '') +
      ((c.chapters || []).length
        ? '<div class="guide-chapters">' + c.chapters.map(ch => manualChapterLink(ch)).join('') + '</div>'
        : '') +
      '</div>').join('');
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败：' + escapeHtml(e.message) + '</div>';
  }
}

/* ---------------- 初始化 ---------------- */
(async function init() {
  if (!LOGGED_IN) return;  // 未登录：已跳转登录页，不再加载
  renderHerbBanner();
  const rep = getReport();
  let p = getProfile();
  try {
    const res = await api('/api/meta');
    META = res.data;
  } catch (e) {
    toast('初始化失败：' + e.message, 'err');
    return;
  }

  const editEl = document.getElementById('concernEdit');
  const reportEntry = document.getElementById('reportEntry');
  const quizEntry = document.getElementById('quizEntry');
  document.getElementById('ckBtn').onclick = doCheckin;
  document.getElementById('saveBtn').onclick = saveConcerns;

  // 有自查报告：关注点以报告诉求为准，只读
  const repDemands = hasReport() ? rep.demands : null;
  if (repDemands) {
    repDemands.slice(0, 8).forEach(c => picked.add(c));
    editEl.style.display = 'none';
    reportEntry.style.display = '';
    quizEntry.style.display = 'none';
    renderConcernTags();
    toggleSection('secCheckin', true);
    await Promise.all([loadCheckin(), loadPlan(), loadGuide()]);
    return;
  }

  // 未填写自查报告：关注点可自行选择 / 修改，其余模块无内容则保持隐藏
  if (!p || !(p.concerns || []).length) {
    const uid = effectiveUserId();
    if (uid) {
      try {
        const r = await api('/api/user/profile?user_id=' + encodeURIComponent(uid));
        p = r.profile;
        setProfile(p);
      } catch (e) { /* 忽略：确实没有画像 */ }
    }
  }
  const saved = ((p && p.concerns) || []).slice(0, 8);
  saved.forEach(c => picked.add(c));
  renderConcernTags();
  renderPicker();
  editEl.style.display = '';
  reportEntry.style.display = 'none';
  quizEntry.style.display = '';

  if (!picked.size) return;  // 初始未填写：只显示关注点卡

  toggleSection('secCheckin', true);
  await Promise.all([loadCheckin(), loadPlan(), loadGuide()]);
})();

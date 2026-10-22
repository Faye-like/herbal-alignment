/* 病症调理方案：上方选病症，下方展示对应调理方式 */
let META = null;
let curConcern = '';

injectNav('/care', false);
injectFooter();

function renderConcernNav() {
  document.getElementById('concernNav').innerHTML = (META.concerns || []).map(c =>
    '<button type="button" class="opt' + (c === curConcern ? ' on' : '') +
    '" data-concern="' + escapeAttr(c) + '">' + escapeHtml(c) + '</button>').join('');
  document.querySelectorAll('#concernNav .opt').forEach(btn => {
    btn.onclick = () => { curConcern = btn.dataset.concern; renderConcernNav(); load(); };
  });
}

function planCardHtml(p) {
  const steps = (p.steps || []).map(s => '<li>' + escapeHtml(s) + '</li>').join('');
  const detail = (steps ? '<ol class="plan-steps">' + steps + '</ol>'
                       : '<p class="muted">暂无具体步骤</p>') +
    (p.tips ? '<p class="cc-note">注意：' + escapeHtml(p.tips) + '</p>' : '') +
    (p.source ? '<div class="src-line">来源（整理自）：' + escapeHtml(p.source) + '</div>' : '');
  return '<article class="care-card" data-open="false">' +
    '<div class="care-card-sum">' +
      '<div class="cc-head">' +
        '<h3>' + escapeHtml(p.title) + '</h3>' +
        '<span class="plan-cat">' + escapeHtml(p.category || '调理') + '</span>' +
      '</div>' +
      (p.summary ? '<p class="cc-summary">' + escapeHtml(p.summary) + '</p>' : '') +
      '<span class="cc-cue"><span class="cc-cue-text">查看调理详情</span></span>' +
    '</div>' +
    '<div class="care-card-detail"><div class="cc-detail-inner">' + detail + '</div></div>' +
  '</article>';
}

/* 点击瞬间：从落点生成多层同心波纹；展开时由内向外舒展，收起时由外向内收束 */
const RIPPLE_IN_SCALES = [0.55, 0.78, 1];
const RIPPLE_OUT_SCALES = [1, 0.74, 0.48];

function ripple(card, x, y, dir) {
  const rect = card.getBoundingClientRect();
  const size = Math.ceil(Math.sqrt(rect.width * rect.width + rect.height * rect.height) * 2);
  const scales = dir === 'out' ? RIPPLE_OUT_SCALES : RIPPLE_IN_SCALES;
  scales.forEach((s, i) => {
    const el = document.createElement('span');
    el.className = 'cc-ripple ' + dir;
    el.style.width = el.style.height = size + 'px';
    el.style.left = (x - rect.left) + 'px';
    el.style.top = (y - rect.top) + 'px';
    el.style.marginLeft = el.style.marginTop = (-size / 2) + 'px';
    el.style.setProperty('--s', s);
    el.style.animationDelay = (i * 90) + 'ms';
    card.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  });
}

function toggleCareCard(card, evt) {
  const willOpen = card.dataset.open !== 'true';
  const x = evt && evt.clientX ? evt.clientX : card.getBoundingClientRect().left + card.offsetWidth / 2;
  const y = evt && evt.clientY ? evt.clientY : card.getBoundingClientRect().top + card.offsetHeight / 2;
  ripple(card, x, y, willOpen ? 'in' : 'out');
  card.dataset.open = willOpen ? 'true' : 'false';
  card.classList.toggle('open', willOpen);
  const cue = card.querySelector('.cc-cue-text');
  if (cue) cue.textContent = willOpen ? '收起详情' : '查看调理详情';
}

function bindCareCards(scope) {
  scope.querySelectorAll('.care-card').forEach(card => {
    card.addEventListener('click', e => toggleCareCard(card, e));
  });
}

function groupHtml(items) {
  const cats = (META.care_categories || []);
  const order = cats.length
    ? cats
    : [...new Set(items.map(i => i.category || '其他'))];
  return order.map(cat => {
    const group = items.filter(i => (i.category || '其他') === cat);
    if (!group.length) return '';
    return '<div class="care-group">' +
      '<div class="care-group-title">' + escapeHtml(cat) + '</div>' +
      group.map(planCardHtml).join('') + '</div>';
  }).join('');
}

async function load() {
  const box = document.getElementById('planList');
  const refWrap = document.getElementById('suppRefWrap');
  const title = document.getElementById('planTitle');
  const tip = document.getElementById('tipBanner');
  const planNote = document.getElementById('planNote');
  title.style.display = '';
  title.textContent = '② ' + curConcern + ' 的调理方案（按类别）';
  tip.style.display = '';
  tip.innerHTML =
    '<div class="care-current-line">当前病症 <span class="tag solid">' +
    escapeHtml(curConcern) + '</span></div>';
  planNote.style.display = '';

  box.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const [planRes, refRes] = await Promise.all([
      api('/api/care-plans?concern=' + encodeURIComponent(curConcern)),
      api('/api/supplement-ref?concern=' + encodeURIComponent(curConcern)),
    ]);
    box.innerHTML = planRes.items.length
      ? groupHtml(planRes.items)
      : '<div class="empty">暂无该病症的调理方式</div>';
    bindCareCards(box);

    const refBox = document.getElementById('suppRefList');
    if (refRes.items && refRes.items.length) {
      refWrap.style.display = '';
      refBox.innerHTML = refRes.items.map(suppRefCardHtml).join('');
      bindCareCards(refBox);
    } else {
      refWrap.style.display = 'none';
    }
  } catch (e) {
    box.innerHTML = '<div class="empty">加载失败：' + escapeHtml(e.message) + '</div>';
    refWrap.style.display = 'none';
  }
}

/* 补剂参考：与上方调理条目一致的微拟态折叠卡片 */
function suppRefCardHtml(s) {
  const row = (label, val) => val
    ? '<div class="supp-row"><span class="supp-label">' + label + '</span>' +
      '<span class="supp-val">' + escapeHtml(val) + '</span></div>'
    : '';
  const detail =
    '<div class="supp-rows">' +
    row('使用人群', s.audience) +
    row('作用', s.effect) +
    row('过量风险', s.overdose) +
    row('食补优先', s.food_first) +
    '</div>' +
    (s.source ? '<div class="src-line">来源（整理自）：' + escapeHtml(s.source) + '</div>' : '');
  return '<article class="care-card" data-open="false">' +
    '<div class="care-card-sum">' +
      '<div class="cc-head">' +
        '<h3>' + escapeHtml(s.name) + '</h3>' +
        '<span class="plan-cat">' + escapeHtml(s.category || '补剂') + '</span>' +
      '</div>' +
      (s.note ? '<p class="cc-summary">' + escapeHtml(s.note) + '</p>' : '') +
      '<span class="cc-cue"><span class="cc-cue-text">查看详情</span></span>' +
    '</div>' +
    '<div class="care-card-detail"><div class="cc-detail-inner">' + detail + '</div></div>' +
  '</article>';
}

(async function init() {
  try {
    const res = await api('/api/meta');
    META = res.data;
    // 初始不预选任何病症：未选择时下方不展示任何信息
    curConcern = '';
    renderConcernNav();
  } catch (e) {
    toast('初始化失败：' + e.message, 'err');
  }
})();

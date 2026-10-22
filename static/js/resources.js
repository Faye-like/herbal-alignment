/* 《青年养生知识手册》：整册阅读式（目录 + 正文 + 附录 + 边界声明） */
injectNav('/resources', false);
injectFooter();

function renderHead(d) {
  document.getElementById('manualDesc').textContent = d.desc || '';
}

function renderToc(d) {
  document.getElementById('toc').innerHTML =
    '<div class="toc-title">目录</div>' +
    d.sections.map(s =>
      '<div class="toc-part">' +
      '<div class="toc-part-label">' + escapeHtml(s.label) + '</div>' +
      '<div class="toc-part-sub">' + escapeHtml(s.type) + '</div>' +
      s.chapters.map(ch =>
        '<a class="toc-chapter" href="#' + escapeAttr(ch.anchor) + '" data-anchor="' + escapeAttr(ch.anchor) + '">' +
        '<span class="toc-no">' + escapeHtml(ch.no) + '</span>' + escapeHtml(ch.title) + '</a>').join('') +
      '</div>').join('');
  document.querySelectorAll('#toc .toc-chapter').forEach(a => {
    a.onclick = (e) => { e.preventDefault(); scrollToChapter(a.dataset.anchor); };
  });
}

function renderBody(d) {
  document.getElementById('manualBody').innerHTML = d.sections.map(s => {
    return '<section class="manual-part">' +
      '<div class="part-head">' +
      '<div class="part-head-text"><span class="part-label">' + escapeHtml(s.label) + '</span>' +
      '<h2 class="part-title">' + escapeHtml(s.sub) + '</h2></div></div>' +
      s.chapters.map(ch => {
    const body = s.type === '常见认知误区' ? renderMythFan(ch.content || '') : (ch.content || '');
    return '<article class="chapter" id="' + escapeAttr(ch.anchor) + '">' +
    '<div class="chapter-no">' + escapeHtml(ch.no) + '</div>' +
    '<h3 class="chapter-title">' + escapeHtml(ch.title) + '</h3>' +
    '<div class="article chapter-body">' + body + '</div>' +
    '</article>';
  }).join('') +
  '</section>';
  }).join('');
  bindMythFan();
}

/* 常见认知误区：扇形斜向扑克牌堆叠 + 点击弹出辨析窗口 */
const MYTH_LABELS = ['红枣补血', '以形补形', '万能食物', '骨头补钙', '水果代餐', '补觉无效', '喝粥养胃', '人人补剂'];
let MYTHS = [];

function renderMythFan(content) {
  const root = document.createElement('div');
  root.innerHTML = content;
  const lead = root.querySelector('.lead');
  const ref = root.querySelector('.ref');
  const nodes = Array.from(root.querySelectorAll('.myth'));

  MYTHS = nodes.map((m, i) => {
    const sayEl = m.querySelector('.myth-say');
    const say = (sayEl ? sayEl.textContent : '').replace(/^流传说法：/, '').trim();
    const rows = Array.from(m.querySelectorAll('.myth-row')).map(r => r.outerHTML).join('');
    const label = MYTH_LABELS[i] || say.slice(0, 4);
    return { say: say, rows: rows, label: label };
  });

  const total = MYTHS.length;
  const cards = MYTHS.map((m, i) => {
    const rot = total > 1 ? (-2 + (4 * i) / (total - 1)) : 0;
    return '<div class="myth-card" data-idx="' + i + '" role="button" tabindex="0"' +
      ' style="--i:' + i + ';--rot:' + rot.toFixed(2) + 'deg;z-index:' + (i + 1) + '">' +
      '<div class="myth-tab">' + escapeHtml(m.label) + '</div>' +
      '<div class="myth-card-body"><span>点击卡片 · 查看完整辨析</span></div>' +
      '</div>';
  }).join('');

  return (lead ? lead.outerHTML : '') +
    '<div class="myth-fan">' + cards + '</div>' +
    (ref ? ref.outerHTML : '');
}

function bindMythFan() {
  document.querySelectorAll('#manualBody .myth-card').forEach(card => {
    const idx = Number(card.dataset.idx);
    card.onclick = () => openMythModal(idx);
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMythModal(idx); }
    };
  });
}

function openMythModal(idx) {
  const m = MYTHS[idx];
  if (!m) return;
  let mask = document.getElementById('mythMask');
  if (!mask) {
    mask = document.createElement('div');
    mask.id = 'mythMask';
    mask.className = 'myth-mask';
    mask.innerHTML =
      '<div class="myth-modal" role="dialog" aria-modal="true">' +
      '<button class="myth-modal-close" aria-label="返回">←</button>' +
      '<div class="myth-modal-say"></div>' +
      '<div class="myth-modal-rows"></div>' +
      '</div>';
    document.body.appendChild(mask);
    mask.addEventListener('click', (e) => { if (e.target === mask) closeMythModal(); });
    mask.querySelector('.myth-modal-close').onclick = closeMythModal;
  }
  mask.querySelector('.myth-modal-say').textContent = '流传说法：' + m.say;
  mask.querySelector('.myth-modal-rows').innerHTML = m.rows;
  mask.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => mask.classList.add('on'));
  const btn = mask.querySelector('.myth-modal-close');
  if (btn) btn.focus();
}

function closeMythModal() {
  const mask = document.getElementById('mythMask');
  if (!mask) return;
  mask.classList.remove('on');
  document.body.style.overflow = '';
  setTimeout(() => { if (!mask.classList.contains('on')) mask.style.display = 'none'; }, 250);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMythModal();
});

function renderBoundary(list) {
  document.getElementById('boundaryBox').innerHTML =
    '<div class="boundary-title">系统边界声明</div>' +
    '<p class="boundary-text">' + escapeHtml((list || []).join('')) + '</p>';
}

function scrollToChapter(anchor) {
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1200);
  document.querySelectorAll('#toc .toc-chapter').forEach(a =>
    a.classList.toggle('on', a.dataset.anchor === anchor));
}

async function toggleAppendix() {
  const box = document.getElementById('appendixBody');
  const btn = document.getElementById('appendixToggle');
  if (box.style.display !== 'none') {
    box.style.display = 'none';
    btn.textContent = '展开附录：食疗食谱库';
    return;
  }
  btn.disabled = true;
  btn.textContent = '加载中…';
  try {
    const res = await api('/api/manual/appendix');
    renderAppendix(res.data);
    box.style.display = '';
    btn.textContent = '收起附录：食疗食谱库';
  } catch (e) {
    toast('加载失败：' + e.message, 'err');
    btn.textContent = '展开附录：食疗食谱库';
  }
  btn.disabled = false;
}

function renderAppendix(d) {
  document.getElementById('appendixBody').innerHTML =
    '<div class="appendix-disclaimer">' + escapeHtml(d.disclaimer) + '</div>' +
    '<div class="appendix-groups">' + (d.groups || []).map(g =>
      '<div class="appendix-group"><div class="appendix-group-name">' + escapeHtml(g.name) + '</div>' +
      (g.items || []).map(it =>
        '<div class="appendix-item">' +
        '<div class="ap-name">' + escapeHtml(it.name) + '</div>' +
        '<div class="ap-row"><span class="ap-k">属性</span>' + escapeHtml(it.attr) + '</div>' +
        '<div class="ap-row"><span class="ap-k">常见做法</span>' + escapeHtml(it.how) + '</div>' +
        '<div class="ap-row"><span class="ap-k">适用边界</span>' + escapeHtml(it.boundary) + '</div>' +
        '<div class="ap-row"><span class="ap-k">注意</span>' + escapeHtml(it.note) + '</div>' +
        '</div>').join('') +
      '</div>').join('') + '</div>' +
    '<div class="appendix-src">来源：' + (d.sources || []).map(escapeHtml).join(' · ') + '</div>';
}

(async function init() {
  try {
    const res = await api('/api/manual');
    const d = res.data;
    renderHead(d);
    renderToc(d);
    renderBody(d);
    renderBoundary(d.boundary);
    document.getElementById('appendixToggle').onclick = toggleAppendix;
    const anchor = (location.hash || '').replace('#', '');
    if (anchor) setTimeout(() => scrollToChapter(anchor), 120);
  } catch (e) {
    document.getElementById('manualBody').innerHTML =
      '<div class="empty">加载失败：' + escapeHtml(e.message) + '</div>';
  }
})();

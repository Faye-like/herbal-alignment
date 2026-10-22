/* 药材塑图鉴：全部药材塑的性格、作用与养生方向（卡片默认折叠，点击详情展开） */
injectNav('/herbs', false);
injectFooter();

function myHerbId() {
  try {
    const h = JSON.parse(localStorage.getItem(scopedKey('herb_profile')) || 'null');
    return h && h.id ? h.id : '';
  } catch (e) { return ''; }
}

function cardHtml(t, mine) {
  const detailId = 'herb-detail-' + t.id;
  return '<div class="herb-card collapsed' + (mine ? ' is-mine' : '') + '" style="--accent:' + t.color + '">' +
    '<div class="herb-card-top">' +
      '<div class="herb-card-img"><img src="' + escapeAttr(t.image) + '" alt="' + escapeAttr(t.herb) + '"></div>' +
      '<div>' +
        '<div class="herb-card-name">' + escapeHtml(t.nickname || t.name) +
          (mine ? ' <span class="herb-mine">你的</span>' : '') + '</div>' +
        '<div class="herb-card-herb">' + escapeHtml(t.name) + ' · 药材本名 ' + escapeHtml(t.herb) + '</div>' +
        '<div class="herb-card-tagline">' + escapeHtml(t.tagline) + '</div>' +
      '</div>' +
    '</div>' +
    '<button type="button" class="herb-toggle" data-target="' + detailId + '" aria-expanded="false">' +
      '<span>详情</span>' +
      '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">' +
        '<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" ' +
        'stroke-linecap="round" stroke-linejoin="round"></path></svg>' +
    '</button>' +
    '<div class="herb-detail" id="' + detailId + '">' +
      '<div class="report-traits">' +
        (t.traits || []).slice(0, 3).map(x => '<span class="report-trait">' + escapeHtml(x) + '</span>').join('') +
      '</div>' +
      '<p class="herb-slang">' + escapeHtml(t.slang) + '</p>' +
      '<div class="herb-focus"><b>药材作用</b><p>' + escapeHtml(t.effect_intro || '') + '</p></div>' +
      '<div class="herb-focus"><b>养生重点</b><p>' + escapeHtml(t.health_focus || '') + '</p></div>' +
      (t.mind_tip ? '<div class="herb-mind">思虑提醒：' + escapeHtml(t.mind_tip) + '</div>' : '') +
      '<ul class="herb-advice">' +
        (t.advice || []).map(a => '<li>' + escapeHtml(a) + '</li>').join('') +
      '</ul>' +
    '</div>' +
  '</div>';
}

function bindToggle(grid) {
  grid.addEventListener('click', ev => {
    const btn = ev.target.closest('.herb-toggle');
    if (!btn) return;
    const card = btn.closest('.herb-card');
    const detail = document.getElementById(btn.dataset.target);
    if (!card || !detail) return;
    const open = card.classList.toggle('open');
    card.classList.toggle('collapsed', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.querySelector('span').textContent = open ? '收起' : '详情';
    detail.style.maxHeight = open ? detail.scrollHeight + 'px' : '0px';
  });
}

(async function init() {
  const grid = document.getElementById('herbGrid');
  try {
    const res = await api('/api/herbs');
    const items = res.items || [];
    const mine = myHerbId();
    grid.innerHTML = items.map(t => cardHtml(t, t.id === mine)).join('');
    bindToggle(grid);
  } catch (e) {
    grid.innerHTML = '<div class="empty">加载失败：' + escapeHtml(e.message) + '</div>';
  }
})();

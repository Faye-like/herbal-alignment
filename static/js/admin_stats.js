/* 管理端：数据统计看板（ECharts，离线时降级为条形列表） */
if (!requireAdmin()) throw new Error('need login');
injectNav('/admin/stats', true);
injectFooter();

const PALETTE = ['#4E8ACB', '#8FC4F5', '#A8D2FF', '#6FA8E0', '#6FA8E0', '#8E9FD6', '#7FC3C9', '#B7D4F0'];

/* 离线降级：用纯 HTML 条形展示 */
function fallbackBars(id, data) {
  const el = document.getElementById(id);
  if (!el) return;
  const max = Math.max(1, ...data.map(d => d.value));
  el.outerHTML = '<div>' + (data.length ? data.map(d =>
    '<div class="bar-row"><span class="nm">' + escapeHtml(d.name) + '</span>' +
    '<span class="bar-wrap"><span class="bar" style="width:' + (d.value / max * 100) + '%"></span></span>' +
    '<span class="vl">' + d.value + '</span></div>').join('') : '<div class="empty">暂无数据</div>') + '</div>';
}

function pieOption(data) {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    color: PALETTE,
    series: [{
      type: 'pie', radius: ['42%', '68%'], center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { formatter: '{b}\n{c}' },
      data,
    }],
  };
}

function barOption(data, horizontal) {
  if (horizontal) {
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 30, top: 10, bottom: 10, containLabel: true },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: '#E9F1F9' } } },
      yAxis: { type: 'category', inverse: true, data: data.map(d => d.name), axisTick: { show: false } },
      color: PALETTE,
      series: [{
        type: 'bar', data: data.map(d => d.value), barWidth: '58%',
        itemStyle: { borderRadius: [0, 6, 6, 0], color: '#4E8ACB' },
      }],
    };
  }
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 8, right: 16, top: 20, bottom: 10, containLabel: true },
    xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { interval: 0, rotate: data.length > 5 ? 20 : 0 } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#E9F1F9' } } },
    series: [{
      type: 'bar', data: data.map(d => d.value), barWidth: '52%',
      itemStyle: { borderRadius: [6, 6, 0, 0], color: '#4E8ACB' },
    }],
  };
}

function renderPie(id, data) {
  const el = document.getElementById(id);
  if (!data || !data.length) { el.outerHTML = '<div class="empty">暂无数据</div>'; return; }
  if (typeof echarts === 'undefined') { fallbackBars(id, data); return; }
  const inst = echarts.init(el);
  inst.setOption(pieOption(data));
  window.addEventListener('resize', () => inst.resize());
}

function renderBar(id, data, horizontal) {
  const el = document.getElementById(id);
  if (!data || !data.length) { el.outerHTML = '<div class="empty">暂无数据</div>'; return; }
  if (typeof echarts === 'undefined') { fallbackBars(id, data); return; }
  const inst = echarts.init(el);
  inst.setOption(barOption(data, horizontal));
  window.addEventListener('resize', () => inst.resize());
}

/* 躯体困扰人群中的高思虑占比 */
function renderMindBody(list) {
  const el = document.getElementById('cMindBody');
  if (!list || !list.length) { el.outerHTML = '<div class="empty">暂无问卷数据，完成一次身心自查后即可统计</div>'; return; }
  if (typeof echarts === 'undefined') {
    el.outerHTML = '<div>' + list.map(d =>
      '<div class="bar-row"><span class="nm">' + escapeHtml(d.name) + '</span>' +
      '<span class="bar-wrap"><span class="bar" style="width:' + d.rate + '%"></span></span>' +
      '<span class="vl">' + d.rate + '%（' + d.high + '/' + d.total + '）</span></div>').join('') + '</div>';
    return;
  }
  const inst = echarts.init(el);
  inst.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: p => p[0].name + '<br/>高思虑内耗占比：' + p[0].value + '%' },
    grid: { left: 8, right: 60, top: 10, bottom: 10, containLabel: true },
    xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' }, splitLine: { lineStyle: { color: '#E9F1F9' } } },
    yAxis: { type: 'category', inverse: true, data: list.map(d => d.name), axisTick: { show: false } },
    series: [{
      type: 'bar', barWidth: '55%', data: list.map(d => d.rate),
      itemStyle: { color: '#6FA8E0', borderRadius: [0, 6, 6, 0] },
      label: { show: true, position: 'right', formatter: p => p.value + '%', color: '#5A7186', fontSize: 11 }
    }]
  });
  window.addEventListener('resize', () => inst.resize());
}

/* 草本人格 × 思虑倾向（堆叠） */
function renderHerbMind(list) {
  const el = document.getElementById('cHerbMind');
  if (!list || !list.length) { el.outerHTML = '<div class="empty">暂无问卷数据</div>'; return; }
  if (typeof echarts === 'undefined') {
    el.outerHTML = '<div>' + list.map(d =>
      '<div class="bar-row"><span class="nm">' + escapeHtml(d.name) + '</span>' +
      '<span class="vl">高 ' + d.high + ' / 轻 ' + d.mild + ' / 平稳 ' + d.stable + '</span></div>').join('') + '</div>';
    return;
  }
  const inst = echarts.init(el);
  inst.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { bottom: 0, itemWidth: 12, itemHeight: 8 },
    grid: { left: 8, right: 20, top: 10, bottom: 42, containLabel: true },
    xAxis: { type: 'category', data: list.map(d => d.name), axisLabel: { interval: 0, rotate: list.length > 5 ? 30 : 0, fontSize: 11 } },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: '#E9F1F9' } } },
    series: [
      { name: '高思虑内耗', type: 'bar', stack: 'm', data: list.map(d => d.high), itemStyle: { color: '#E06060', borderRadius: [0, 0, 0, 0] } },
      { name: '轻度思虑', type: 'bar', stack: 'm', data: list.map(d => d.mild), itemStyle: { color: '#E9B872' } },
      { name: '思虑平稳', type: 'bar', stack: 'm', data: list.map(d => d.stable), itemStyle: { color: '#7FC3C9', borderRadius: [4, 4, 0, 0] } },
    ]
  });
  window.addEventListener('resize', () => inst.resize());
}

function renderStatCards(cards) {
  document.getElementById('statCards').innerHTML = cards.map(c =>
    '<div class="stat-card"><div class="v">' + c.v + '</div><div class="k">' + c.k + '</div></div>').join('');
}

function renderSuggestions(list) {
  const box = document.getElementById('sugList');
  if (!box) return;
  if (!list || !list.length) {
    box.innerHTML = '<div class="empty">暂无用户意见反馈</div>';
    return;
  }
  box.innerHTML = '<table><thead><tr><th style="width:150px">提交账号</th>' +
    '<th style="width:110px">类型</th><th>反馈内容</th><th style="width:150px">时间</th></tr></thead><tbody>' +
    list.map(s =>
      '<tr><td>' + escapeHtml(s.user_id || '匿名') + '</td>' +
      '<td><span class="tag blue">' + escapeHtml(s.category || '其他') + '</span></td>' +
      '<td>' + escapeHtml(s.content || '') + '</td>' +
      '<td>' + escapeHtml(fmtDateTime(s.created_at)) + '</td></tr>').join('') +
    '</tbody></table>';
}

(async function init() {
  try {
    const [qn, rs, sm, md] = await Promise.all([
      api('/api/stats/questionnaire'),
      api('/api/stats/resources'),
      api('/api/admin/summary'),
      api('/api/stats/mind'),
    ]);
    const q = qn.data, r = rs.data, s = sm.data, m = md.data;

    renderStatCards([
      { k: '注册用户数', v: s.user_count },
      { k: '关注点采集总量', v: q.total },
      { k: '科普资源总量', v: r.total },
      { k: '资源总浏览量', v: r.total_views },
      { k: '意见反馈数', v: s.suggestion_count },
      { k: '反馈好评率', v: r.feedback.positive_rate + '%' },
    ]);

    renderBar('cConcerns', q.top_concerns, true);
    renderBar('cByDate', (q.by_date || []).map(d => ({ name: d.name.slice(5), value: d.value })), false);
    renderPie('cTypeViews', r.views_by_type);
    renderPie('cFeedback', [
      { name: '有用', value: r.feedback.useful },
      { name: '没用', value: r.feedback.useless },
      { name: '看不懂', value: r.feedback.confusing },
    ].filter(x => x.value > 0));
    renderBar('cTopViewed', r.top_viewed, true);
    renderMindBody(m.body_high);
    renderHerbMind(m.herb_mind);
    renderBar('cMindSupp', m.supp_pref, true);
    if (m.total) {
      document.getElementById('statCards').insertAdjacentHTML('beforeend',
        '<div class="stat-card"><div class="v">' + m.total + '</div><div class="k">身心自查完成数</div></div>');
    }
    renderSuggestions(s.suggestions);
  } catch (e) {
    toast('统计数据加载失败：' + e.message, 'err');
  }
})();

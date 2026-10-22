/* 健康数据地图：全国年轻人养生困扰区域分布 + 配套图表（实时更新） */
injectNav('/insights', false);
injectFooter();

let META = null;
let GEO = null;
let DATA = null;
const charts = {};
const HAS_ECHARTS = typeof echarts !== 'undefined';

/* 地图色阶（绿色系，与整体配色一致） */
const MAP_COLORS = ['#E7F1FC', '#BBD9F5', '#9CC6EE', '#6FA8E0', '#4A85C8', '#3E74B8'];

function emptyChart(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '<div class="empty" style="height:100%;display:flex;align-items:center;justify-content:center">' +
    escapeHtml(msg || '暂无可展示的数据') + '</div>';
}

function fallbackBars(boxId, items) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const max = Math.max.apply(null, items.map(i => i.value).concat([1]));
  box.innerHTML = '<div class="fb-bars">' + items.map(i =>
    '<div class="fb-bar"><span class="fb-name">' + escapeHtml(i.name) + '</span>' +
    '<span class="fb-track"><span class="fb-fill" style="width:' + Math.round(i.value / max * 100) + '%"></span></span>' +
    '<span class="fb-val">' + i.value + '</span></div>').join('') + '</div>';
}

function setChart(id, option, fallbackItems) {
  if (!HAS_ECHARTS) { if (fallbackItems) fallbackBars(id, fallbackItems); return; }
  const el = document.getElementById(id);
  if (!el) return;
  const inst = charts[id] || (charts[id] = echarts.init(el));
  inst.setOption(option, true);
}

/* ---------------- 统计卡片 ---------------- */
function renderCards(d) {
  const top = (d.by_concern[0] || {}).name || '—';
  const prov = (d.by_province[0] || {}).name || '—';
  const cards = [
    ['全国调研基线', d.baseline_sample.toLocaleString(), '人'],
    ['本平台实时采集', d.live_records, '人次'],
    ['最集中的养生困扰', top, ''],
    ['关注点最多的区域', prov, ''],
  ];
  document.getElementById('statCards').innerHTML = cards.map(([label, val, unit]) =>
    '<div class="stat-card"><div class="v">' + escapeHtml(String(val)) +
    (unit ? '<small>' + unit + '</small>' : '') + '</div><div class="k">' +
    escapeHtml(label) + '</div></div>').join('');
}

/* ---------------- 地图 ---------------- */
function provinceValue(prov, concern) {
  if (!concern) return DATA.by_province_map[prov] || 0;
  const pc = DATA.by_province_concern[prov] || {};
  return pc[concern] || 0;
}

function renderMap(concern) {
  if (!HAS_ECHARTS || !GEO) {
    emptyChart('cMap', '地图组件未加载，请看下方省份排行图表');
    return;
  }
  const values = META.provinces.map(p => ({ name: p, value: provinceValue(p, concern) }));
  const maxV = Math.max.apply(null, values.map(v => v.value).concat([1]));
  const label = concern ? '「' + concern + '」关注点数' : '关注点总数';
  document.getElementById('mapLegend').textContent =
    '当前展示：' + label + (concern ? '（全国调研基线）' : '（全国调研基线 + 本平台实时采集）');
  setChart('cMap', {
    tooltip: {
      trigger: 'item',
      formatter: p => p.name + '<br/>' + label + '：' + (isNaN(p.value) ? 0 : p.value)
    },
    visualMap: {
      min: 0, max: maxV, right: 20, bottom: 20, text: ['多', '少'],
      calculable: true, inRange: { color: MAP_COLORS },
      textStyle: { color: '#5A7186' },
      orient: 'vertical', itemWidth: 14, itemHeight: 90
    },
    series: [{
      type: 'map', map: 'china', roam: true,
      layoutCenter: ['50%', '52%'], layoutSize: '82%',
      zoom: 1.15,
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 11 }, itemStyle: { areaColor: '#A8D2FF' } },
      itemStyle: { borderColor: '#CFE1F5', borderWidth: 0.6 },
      select: { disabled: true },
      data: values
    }]
  }, null);
}

/* ---------------- 其余图表 ---------------- */
function renderConcernBar(d) {
  const items = d.by_concern.slice(0, 8);
  setChart('cConcerns', {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 90, right: 30, top: 20, bottom: 20 },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#EDF3FB' } } },
    yAxis: { type: 'category', data: items.map(i => i.name).reverse(),
             axisLine: { lineStyle: { color: '#CFE1F5' } }, axisLabel: { color: '#5A7186' } },
    series: [{
      type: 'bar', barWidth: 14,
      data: items.map(i => i.value).reverse(),
      itemStyle: { color: '#4E8ACB', borderRadius: [0, 6, 6, 0] },
      label: { show: true, position: 'right', color: '#3E74B8', fontSize: 11 }
    }]
  }, items);
}

function renderProvinceBar(d) {
  // 展示全部省级行政区；Y 轴固定 5000 一档，上限取 30000 与数据最大值的较大者
  const items = d.by_province.slice();
  const maxV = Math.max.apply(null, items.map(i => i.value).concat([1]));
  const yMax = Math.max(30000, Math.ceil(maxV / 5000) * 5000);
  setChart('cProvinces', {
    tooltip: { trigger: 'axis' },
    grid: { left: 56, right: 24, top: 20, bottom: 96 },
    xAxis: {
      type: 'category',
      data: items.map(i => i.name.replace(/省|自治区|特别行政区/, '')),
      axisLabel: { color: '#5A7186', interval: 0, rotate: 48, fontSize: 11 },
      axisLine: { lineStyle: { color: '#CFE1F5' } }
    },
    yAxis: {
      type: 'value', min: 0, max: yMax, interval: 5000,
      axisLabel: { color: '#5A7186', fontSize: 11 },
      splitLine: { lineStyle: { color: '#EDF3FB' } }
    },
    series: [{
      type: 'bar', barWidth: 12,
      data: items.map(i => i.value),
      itemStyle: { color: '#6FA8E0', borderRadius: [4, 4, 0, 0] }
    }]
  }, items);
}

/* 各困扰的高发区域 TOP5：每个困扰一个 mini 柱状图（横向，按名次配色） */
function renderConcernTop(d) {
  const box = document.getElementById('cConcernTop');
  if (!box) return;
  const list = d.concern_top || [];
  const shortName = n => String(n).replace(/省$|自治区$|特别行政区$/, '');
  if (!list.length) { box.innerHTML = '<div class="empty">暂无数据</div>'; return; }

  // 先 dispose 旧的 mini 实例（key: top_<i>）
  Object.keys(charts).forEach(k => { if (k.startsWith('top_')) { charts[k].dispose(); delete charts[k]; } });

  box.innerHTML = '<div class="top5-grid">' + list.map((c, i) =>
    '<div class="top5-card card card-pad">' +
    '<div class="top5-title">' + escapeHtml(c.concern) + ' · TOP5 高发区域' +
    '<span class="top5-metric">每万人关注度指数</span></div>' +
    '<div id="top_' + i + '" class="top5-chart"></div></div>').join('') + '</div>';

  const prizeColors = ['#E06060', '#6FA8E0', '#4E8ACB', '#5B86C9', '#8E9FD6'];
  list.forEach((c, i) => {
    const el = document.getElementById('top_' + i);
    if (!el || !HAS_ECHARTS) return;
    const provs = (c.provinces || []).slice();       // 从高到低
    const names = provs.map(p => shortName(p.name)).reverse();
    const vals = provs.map(p => p.value).reverse();
    const colors = provs.map((p, idx) => prizeColors[idx]).reverse();  // 颜色跟随名次

    charts['top_' + i] = echarts.init(el);
    charts['top_' + i].setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' },
        formatter: params => params[0].name + '（第 ' + (provs.length - params[0].dataIndex) +
          ' 名）<br/>每万人关注度指数：' + params[0].value.toLocaleString() },
      grid: { left: 8, right: 70, top: 4, bottom: 4, containLabel: true },
      xAxis: { type: 'value', show: false },
      yAxis: { type: 'category', data: names, inverse: false,
               axisTick: { show: false }, axisLine: { show: false },
               axisLabel: { color: '#23384D', fontSize: 12 } },
      series: [{
        type: 'bar', data: vals.map((v, idx) => ({
          value: v,
          itemStyle: { color: colors[idx], borderRadius: [0, 4, 4, 0] }
        })),
        barWidth: 12,
        label: { show: true, position: 'right', color: '#5A7186', fontSize: 11,
                 formatter: p => p.value.toLocaleString() },
        emphasis: { focus: 'series' }
      }]
    });
  });
}

/* resize 所有迷你 TOP5 图表 */
window.addEventListener('resize', () => {
  Object.keys(charts).forEach(k => { try { charts[k].resize(); } catch (e) {} });
});

/* 本平台实时采集：仅统计平台用户点选的人次，随用户操作实时增长 */
function renderLive(d) {
  const items = (d.live_by_concern || []).slice();
  if (!items.length) { emptyChart('cLive', '本平台暂无采集数据，快去点选你的养生关注点吧'); return; }
  setChart('cLive', {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 80, right: 30, top: 20, bottom: 20 },
    xAxis: { type: 'value', splitLine: { lineStyle: { color: '#EDF3FB' } } },
    yAxis: { type: 'category', data: items.map(i => i.name).reverse(),
             axisLine: { lineStyle: { color: '#CFE1F5' } }, axisLabel: { color: '#5A7186' } },
    series: [{
      type: 'bar', barWidth: 14,
      data: items.map(i => i.value).reverse(),
      itemStyle: { color: '#8FB8E4', borderRadius: [0, 6, 6, 0] },
      label: { show: true, position: 'right', color: '#3E74B8', fontSize: 11 }
    }]
  }, items);
}

/* ---------------- 数据加载与实时刷新 ---------------- */
function buildMaps(d) {
  d.by_province_map = {};
  d.by_province.forEach(x => { d.by_province_map[x.name] = x.value; });
  return d;
}

async function load(showToast) {
  try {
    const res = await api('/api/stats/geo');
    DATA = buildMaps(res.data);
    if (showToast) toast('数据已刷新');
    document.getElementById('srcLine').innerHTML = '数据来源：' +
      (res.data.sources || []).join('；') + '。';
    renderCards(DATA);
    renderMap(document.getElementById('mapConcern').value);
    renderConcernBar(DATA);
    renderProvinceBar(DATA);
    renderConcernTop(DATA);
    renderLive(DATA);
  } catch (e) {
    toast('数据加载失败：' + e.message, 'err');
  }
}

document.getElementById('mapConcern').addEventListener('change', () => {
  if (DATA) renderMap(document.getElementById('mapConcern').value);
});
document.getElementById('refreshBtn').onclick = () => load(true);

(async function init() {
  try {
    const m = await api('/api/meta');
    META = m.data;
    document.getElementById('mapConcern').innerHTML = '<option value="">全部困扰</option>' +
      META.concerns.map(c => '<option value="' + escapeAttr(c) + '">' + escapeHtml(c) + '</option>').join('');
  } catch (e) {
    toast('选项加载失败：' + e.message, 'err');
    return;
  }
  if (HAS_ECHARTS) {
    try {
      const r = await fetch('/static/geo/china.json');
      GEO = await r.json();
      echarts.registerMap('china', GEO);
    } catch (e) {
      GEO = null;
      console.warn('地图数据加载失败', e);
    }
  }
  await load(false);
  // 实时更新：每 30 秒自动拉取一次最新数据
  setInterval(() => load(false), 30000);
})();

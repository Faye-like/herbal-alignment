/* 公共脚本：请求封装、本地画像存储、导航注入、通用渲染工具 */

const API_BASE = '';

/* ---------------- 请求封装 ---------------- */
async function api(path, options = {}) {
  const opts = Object.assign({ headers: {} }, options);
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers['Content-Type'] = 'application/json';
    if (typeof opts.body !== 'string') opts.body = JSON.stringify(opts.body);
  }
  const token = localStorage.getItem('admin_token');
  if (token) opts.headers['X-Admin-Token'] = token;
  const utoken = localStorage.getItem('user_token');
  if (utoken) opts.headers['X-User-Token'] = utoken;
  const res = await fetch(API_BASE + path, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || ('请求失败 (' + res.status + ')');
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------- 用户画像本地存储 ---------------- */
function getUserId() { return localStorage.getItem('user_id') || ''; }
function setUserId(id) {
  if (id) localStorage.setItem('user_id', id);
  else localStorage.removeItem('user_id');
}
function getProfile() {
  try { return JSON.parse(localStorage.getItem(scopedKey('user_profile')) || 'null'); }
  catch (e) { return null; }
}
function setProfile(p) { localStorage.setItem(scopedKey('user_profile'), JSON.stringify(p)); }

/* ---------------- 登录用户本地存储 ---------------- */
function getUserToken() { return localStorage.getItem('user_token') || ''; }
function setUserToken(t) {
  if (t) localStorage.setItem('user_token', t);
  else localStorage.removeItem('user_token');
}
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('user_info') || 'null'); }
  catch (e) { return null; }
}
function setCurrentUser(u) {
  if (u) localStorage.setItem('user_info', JSON.stringify(u));
  else localStorage.removeItem('user_info');
}
function isLoggedIn() { return !!getUserToken(); }
/* 当前生效的用户标识：已登录用账号名，否则用匿名 user_id */
function effectiveUserId() {
  const u = getCurrentUser();
  return (u && u.username) ? u.username : getUserId();
}
/* 账号维度的本地存储键：同一浏览器切换账号时数据互不串用 */
function scopedKey(base) { return base + '_' + (effectiveUserId() || 'anon'); }
function requireUser() {
  if (!isLoggedIn()) {
    toast('请先登录后再使用该功能');
    setTimeout(() => { location.href = '/user-login?redirect=' + encodeURIComponent(location.pathname + location.search); }, 600);
    return false;
  }
  return true;
}
function userLogout() {
  api('/api/user/logout', { method: 'POST' }).catch(() => {}).finally(() => {
    setUserToken('');
    setCurrentUser(null);
    setUserId('');
    toast('已退出登录');
    setTimeout(() => { location.href = '/'; }, 500);
  });
}

/* ---------------- 工具 ---------------- */
function escapeHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }

function toast(msg, type = 'ok') {
  let el = document.getElementById('__toast');
  if (!el) {
    el = document.createElement('div');
    el.id = '__toast';
    document.body.appendChild(el);
  }
  el.className = 'toast ' + type;
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(el.__t);
  el.__t = setTimeout(() => el.classList.remove('show'), 2200);
}

function fmtDate(s) { return s ? String(s).slice(0, 10) : ''; }
function fmtDateTime(s) { return s ? String(s).replace('T', ' ').slice(0, 16) : ''; }

function coverImg(cover, alt) {
  if (!cover) return '';
  return '<img src="' + escapeAttr(cover) + '" alt="' + escapeAttr(alt) +
    '" loading="lazy" onerror="this.style.display=\'none\'">';
}

const TYPE_COLOR = {
  '脾胃基础认知': 'amber', '气血基础认知': 'violet',
  '补剂基础参考': 'teal', '食疗基础认知': 'indigo',
  '睡眠与节律': 'blue', '肩颈与久坐': 'sky', '情绪与压力': 'purple',
  '用眼与视力': 'indigo', '肤发与内分泌': 'teal', '常见认知误区': 'gray'
};
/* 手册分册 → 卡片强调色 class（与 style.css 中 .acc-* 一一对应） */
const TYPE_ACCENT = {
  '脾胃基础认知': 'acc-spleen', '气血基础认知': 'acc-blood',
  '补剂基础参考': 'acc-supp', '食疗基础认知': 'acc-food',
  '睡眠与节律': 'acc-sleep', '肩颈与久坐': 'acc-neck', '情绪与压力': 'acc-mood',
  '用眼与视力': 'acc-eye', '肤发与内分泌': 'acc-skin', '常见认知误区': 'acc-myth'
};
function typeTag(t) { return '<span class="tag ' + (TYPE_COLOR[t] || '') + '">' + escapeHtml(t) + '</span>'; }

/* 手册章节链接：TOC / 查阅指引 / 发现页共用 */
function manualChapterLink(ch, base) {
  const href = (base || '/resources') + '#' + (ch.anchor || ('ch-' + ch.id));
  return '<a class="ch-link" href="' + escapeAttr(href) + '">' +
    '<span class="ch-link-no">' + escapeHtml(ch.no || '') + '</span>' +
    escapeHtml(ch.title || '') + '</a>';
}

function tagsHtml(list, cls) {
  return (list || []).map(t => '<span class="tag ' + (cls || '') + '">' + escapeHtml(t) + '</span>').join('');
}

/* ---------------- 导航注入 ---------------- */
const USER_LINKS = [
  ['/', '首页'],
  ['/resources', '青年养生知识手册'],
  ['/care', '病症调理'],
  ['/insights', '健康数据'],
  ['/mine', '打卡与查询'],
];
const ADMIN_LINKS = [
  ['/admin/resources', '科普资源管理'],
  ['/admin/stats', '数据统计看板'],
];

function injectNav(active, admin = false) {
  const links = admin ? ADMIN_LINKS : USER_LINKS;
  const linksHtml = links.map(([href, text]) =>
    '<a href="' + href + '"' + (href === active ? ' class="active"' : '') + '>' + text + '</a>'
  ).join('');
  let right;
  if (admin) {
    const name = localStorage.getItem('admin_name') || '管理员';
    right = '<span style="color:#fff;font-size:13px;opacity:.9;margin-right:6px">' + escapeHtml(name) + '</span>' +
      '<a href="javascript:;" id="navLogout">退出登录</a>';
  } else if (isLoggedIn()) {
    const u = getCurrentUser() || {};
    const nick = u.username || '我';
    right = '<a href="/profile">' + escapeHtml(nick) + '</a>' +
      '<a href="javascript:;" id="navLogout">退出</a>';
  } else {
    right = '<a href="/user-login">登录 / 注册</a>';
  }
  const brand = admin ? '养生科普基层治理 · 管理后台' : '养生科普智能匹配系统';
  document.querySelectorAll('#navSlot').forEach(slot => {
    slot.outerHTML =
      '<div class="nav"><div class="container">' +
      '<div class="brand">' + brand + '</div>' +
      '<div class="links">' + linksHtml + '</div>' +
      '<div class="nav-right">' + right + '</div>' +
      '</div></div>';
  });
  const lo = document.getElementById('navLogout');
  if (lo) lo.onclick = admin ? adminLogout : userLogout;
}

function injectFooter() {
  document.querySelectorAll('#footerSlot').forEach(slot => {
    slot.outerHTML =
      '<div class="footer"><div class="container">' +
      '<div>养生科普智能匹配系统 · 健康科普参考资料，不构成诊疗建议 · 不推荐任何产品</div>' +
      '<div><a href="/about">项目介绍</a> · <a href="/disclaimer">免责声明</a></div>' +
      '</div></div>';
  });
}

/* ---------------- 管理端鉴权 ---------------- */
function requireAdmin() {
  if (!localStorage.getItem('admin_token')) {
    location.href = '/login';
    return false;
  }
  return true;
}
function adminLogout() {
  api('/api/admin/logout', { method: 'POST' }).catch(() => {}).finally(() => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_name');
    location.href = '/login';
  });
}

/* ---------------- 通用卡片渲染 ---------------- */
/* 资源卡片：排版驱动的编辑风格卡片（不使用配图，避免模板感） */
function resCardHtml(item) {
  const acc = TYPE_ACCENT[item.type] || 'acc-brand';
  const reasons = (item.match_reasons || []).slice(0, 2)
    .map(r => '<span class="rc-tag">' + escapeHtml(r) + '</span>').join('');
  const themes = (item.theme_tags || []).slice(0, 2)
    .map(t => '<span class="rc-tag">#' + escapeHtml(t) + '</span>').join('');
  const desc = (item.desc || item.content || '')
    .replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').replace(/\s+/g, ' ').trim().slice(0, 84);
  return '<a class="rcard ' + acc + '" href="/resource?id=' + item.id + '">' +
    '<div class="rc-top"><span class="rc-type">' + escapeHtml(item.type || '科普') + '</span>' +
    '<span class="rc-date">' + escapeHtml(fmtDate(item.publish_time)) + '</span></div>' +
    '<h3 class="rc-title">' + escapeHtml(item.title) + '</h3>' +
    '<p class="rc-desc">' + escapeHtml(desc) + '</p>' +
    '<div class="rc-foot">' + (reasons || themes) +
    '<span class="rc-views">' + (item.views || 0) + ' 人看过</span></div></a>';
}

/* ---------------- 多选选项辅助 ---------------- */
function optionGroup(list, name, multiple, checked) {
  return '<div class="options" data-name="' + name + '">' + list.map(v => {
    const on = (checked || []).indexOf(v) >= 0;
    return '<label class="opt' + (on ? ' on' : '') + '">' +
      '<input type="' + (multiple ? 'checkbox' : 'radio') + '" name="' + name + '" value="' + escapeAttr(v) + '"' +
      (on ? ' checked' : '') + '>' + escapeHtml(v) + '</label>';
  }).join('') + '</div>';
}
function bindOptions(root) {
  (root || document).querySelectorAll('.options .opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const input = opt.querySelector('input');
      const multiple = input.type === 'checkbox';
      setTimeout(() => {
        if (multiple) opt.classList.toggle('on', input.checked);
        else {
          const group = opt.closest('.options');
          group.querySelectorAll('.opt').forEach(o => o.classList.remove('on'));
          opt.classList.add('on');
        }
      }, 0);
    });
  });
}

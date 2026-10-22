/* 个人中心：修改个人信息 + 意见反馈 */
injectNav('/profile', false);
injectFooter();

let META = null;
const LOGGED_IN = isLoggedIn();

function fillSelect(el, list, current, placeholder) {
  el.innerHTML = (placeholder ? '<option value="">' + placeholder + '</option>' : '') +
    list.map(v => '<option value="' + escapeAttr(v) + '"' + (v === current ? ' selected' : '') + '>' +
      escapeHtml(v) + '</option>').join('');
}

async function loadMe() {
  const res = await api('/api/user/me');
  const u = res.user;
  setCurrentUser(u);
  document.getElementById('pfUsername').value = u.username;
  fillSelect(document.getElementById('pfGender'), META.genders, u.gender, '');
  fillSelect(document.getElementById('pfProvince'), META.provinces, u.province, '请选择省份');
  return u;
}

async function loadStats() {
  const uid = effectiveUserId();
  const p = getProfile();
  const concerns = (p && p.concerns) || [];
  document.getElementById('stConcerns').textContent = concerns.length;
  document.getElementById('myConcerns').innerHTML = concerns.length
    ? tagsHtml(concerns, 'solid') : '<span class="muted" style="font-size:13px">还没有点选关注的养生困扰</span>';
  try {
    const ck = await api('/api/checkin?user_id=' + encodeURIComponent(uid));
    document.getElementById('stStreak').textContent = ck.data.streak;
    document.getElementById('stTotal').textContent = ck.data.total;
  } catch (e) { /* 忽略 */ }
}

async function saveProfile() {
  const btn = document.getElementById('saveProfile');
  btn.disabled = true;
  try {
    const res = await api('/api/user/profile', {
      method: 'PUT',
      body: {
        gender: document.getElementById('pfGender').value,
        province: document.getElementById('pfProvince').value,
      }
    });
    setCurrentUser(res.user);
    // 同步刷新导航栏上的用户名（导航已注入，不能再调用 injectNav）
    const navLink = document.querySelector('.nav-right a[href="/profile"]');
    if (navLink) navLink.textContent = res.user.username;
    toast('个人信息已保存');
  } catch (e) {
    toast(e.message, 'err');
  }
  btn.disabled = false;
}

async function submitFb() {
  const category = document.getElementById('fbCategory').value;
  const content = document.getElementById('fbContent').value.trim();
  if (content.length < 5) return toast('反馈内容至少 5 个字', 'err');
  const btn = document.getElementById('submitFb');
  btn.disabled = true;
  try {
    await api('/api/suggestions', { method: 'POST', body: { category, content } });
    document.getElementById('fbContent').value = '';
    document.getElementById('fbHint').textContent = '感谢你的反馈，我们会认真对待！';
    toast('反馈已提交');
  } catch (e) {
    toast(e.message, 'err');
  }
  btn.disabled = false;
}

/* 左侧导航切换：基本信息（默认）/ 意见反馈 */
function switchSection(sec) {
  document.querySelectorAll('.side-item').forEach(a =>
    a.classList.toggle('active', a.dataset.sec === sec));
  document.getElementById('secBasic').style.display = sec === 'basic' ? '' : 'none';
  document.getElementById('secFeedback').style.display = sec === 'feedback' ? '' : 'none';
}
document.querySelectorAll('.side-item').forEach(a =>
  a.onclick = () => switchSection(a.dataset.sec));

async function init() {
  if (!LOGGED_IN) {
    document.getElementById('guard').style.display = '';
    return;
  }
  document.getElementById('mainBox').style.display = '';
  switchSection('basic');
  try {
    const res = await api('/api/meta');
    META = res.data;
    fillSelect(document.getElementById('fbCategory'), META.suggestion_categories, META.suggestion_categories[0], '');
    await loadMe();
    document.getElementById('saveProfile').onclick = saveProfile;
    document.getElementById('submitFb').onclick = submitFb;
    loadStats();
  } catch (e) {
    toast('加载失败：' + e.message, 'err');
  }
}
init();

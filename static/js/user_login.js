/* 用户登录 / 注册 */
injectNav('', false);
injectFooter();

const redirect = new URLSearchParams(location.search).get('redirect') || '/';

/* 已登录则直接跳回 */
if (isLoggedIn()) {
  location.replace(redirect);
}

function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('loginPane').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('regPane').style.display = tab === 'register' ? '' : 'none';
}
document.querySelectorAll('.auth-tab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));

function afterLogin(res) {
  // 先读取匿名身份下的关注点，再切换登录态，避免读到账号维度的空画像
  const anonProfile = getProfile();
  setUserToken(res.token);
  setCurrentUser(res.user);
  // 若此前以匿名身份点选过关注点，登录后迁移到账号名下
  const anon = getUserId();
  if (anon && anon !== res.user.username && anonProfile && (anonProfile.concerns || []).length) {
    api('/api/questionnaire/submit', {
      method: 'POST',
      body: { user_id: res.user.username, concerns: (anonProfile || {}).concerns || [] }
    }).then(r => { setProfile(r.profile); }).catch(() => {});
  }
  toast('登录成功，欢迎回来');
  setTimeout(() => location.replace(redirect), 500);
}

async function doLogin() {
  const username = document.getElementById('lgUsername').value.trim();
  const password = document.getElementById('lgPassword').value;
  if (!username || !password) return toast('请输入用户名和密码', 'err');
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  try {
    const res = await api('/api/user/login', { method: 'POST', body: { username, password } });
    afterLogin(res);
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false;
  }
}

async function doRegister() {
  const username = document.getElementById('rgUsername').value.trim();
  const password = document.getElementById('rgPassword').value;
  const gender = document.getElementById('rgGender').value;
  const province = document.getElementById('rgProvince').value;
  if (username.length < 3) return toast('用户名至少 3 个字符', 'err');
  if (password.length < 6) return toast('密码至少 6 位', 'err');
  const btn = document.getElementById('regBtn');
  btn.disabled = true;
  try {
    const res = await api('/api/user/register', {
      method: 'POST', body: { username, password, gender, province }
    });
    afterLogin(res);
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false;
  }
}

(async function init() {
  document.getElementById('loginBtn').onclick = doLogin;
  document.getElementById('regBtn').onclick = doRegister;
  document.getElementById('lgPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  try {
    const res = await api('/api/meta');
    document.getElementById('rgGender').innerHTML = res.data.genders
      .map(g => '<option value="' + escapeAttr(g) + '">' + escapeHtml(g) + '</option>').join('');
    document.getElementById('rgProvince').innerHTML = '<option value="">请选择省份</option>' +
      res.data.provinces.map(p => '<option value="' + escapeAttr(p) + '">' + escapeHtml(p) + '</option>').join('');
  } catch (e) {
    toast('选项加载失败：' + e.message, 'err');
  }
})();

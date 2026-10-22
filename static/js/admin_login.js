/* 管理端登录 */
injectNav('/login', false);
injectFooter();

document.getElementById('loginBtn').onclick = doLogin;
document.getElementById('password').addEventListener('keydown', e => {
  if (e.key === 'Enter') doLogin();
});

async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  if (!username || !password) return toast('请输入账号和密码', 'err');
  const btn = document.getElementById('loginBtn');
  btn.disabled = true;
  try {
    const res = await api('/api/admin/login', { method: 'POST', body: { username, password } });
    localStorage.setItem('admin_token', res.token);
    localStorage.setItem('admin_name', res.username);
    toast('登录成功');
    setTimeout(() => location.href = '/admin/stats', 400);
  } catch (e) {
    toast(e.message, 'err');
    btn.disabled = false;
  }
}

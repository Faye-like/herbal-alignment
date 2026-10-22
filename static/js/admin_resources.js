/* 管理端：科普资源管理 */
if (!requireAdmin()) throw new Error('need login');
injectNav('/admin/resources', true);
injectFooter();

let META = null;
let EDIT_ID = null;

function groupValue(name, multiple) {
  const vals = [];
  document.querySelectorAll('.options[data-name="' + name + '"] input').forEach(i => {
    if (i.checked) vals.push(i.value);
  });
  return multiple ? vals : (vals[0] || '');
}
function renderGroup(el, list, name, multiple, checked) {
  el.innerHTML = optionGroup(list, name, multiple, checked);
}
function setSelect(el, list, placeholder) {
  el.innerHTML = (placeholder ? '<option value="">' + placeholder + '</option>' : '') +
    list.map(v => '<option value="' + escapeAttr(v) + '">' + escapeHtml(v) + '</option>').join('');
}

async function load() {
  const type = document.getElementById('fType').value;
  const q = document.getElementById('fQ').value.trim();
  const p = new URLSearchParams();
  if (type) p.set('type', type);
  if (q) p.set('q', q);
  const res = await api('/api/resources?' + p.toString());
  const tb = document.getElementById('tbody');
  if (!res.items.length) {
    tb.innerHTML = '<tr><td colspan="8"><div class="empty">暂无资源</div></td></tr>';
    return;
  }
  tb.innerHTML = res.items.map(r =>
    '<tr><td>' + r.id + '</td>' +
    '<td style="max-width:260px"><a href="/resource?id=' + r.id + '" target="_blank">' + escapeHtml(r.title) + '</a></td>' +
    '<td>' + typeTag(r.type) + '</td>' +
    '<td style="max-width:220px"><div class="tags">' + tagsHtml(r.theme_tags) + '</div></td>' +
    '<td><div class="tags">' + tagsHtml(r.concerns, 'orange') + '</div></td>' +
    '<td>' + escapeHtml(fmtDate(r.publish_time)) + '</td>' +
    '<td>' + (r.views || 0) + '</td>' +
    '<td><button class="btn ghost sm" data-edit="' + r.id + '">编辑</button> ' +
    '<button class="btn danger sm" data-del="' + r.id + '">删除</button></td></tr>').join('');

  tb.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openEdit(res.items.find(x => x.id == b.dataset.edit)));
  tb.querySelectorAll('[data-del]').forEach(b => b.onclick = () => delResource(b.dataset.del));
}

function openEdit(item) {
  EDIT_ID = item ? item.id : null;
  document.getElementById('modalTitle').textContent = item ? '编辑科普资源' : '新增科普资源';
  document.getElementById('edTitle').value = item ? item.title : '';
  document.getElementById('edType').value = item ? item.type : (META.resource_types[0] || '');
  document.getElementById('edTime').value = item ? fmtDate(item.publish_time) : new Date().toISOString().slice(0, 10);
  document.getElementById('edCover').value = item ? (item.cover || '') : '';
  document.getElementById('edContent').value = item ? (item.content || '') : '';
  renderGroup(document.getElementById('edThemes'), META.theme_tags, 'theme_tags', true, item ? item.theme_tags : []);
  renderGroup(document.getElementById('edConcerns'), META.concerns, 'concerns', true, item ? item.concerns : []);
  bindOptions(document.getElementById('editMask'));
  document.getElementById('editMask').classList.add('show');
}

function closeEdit() { document.getElementById('editMask').classList.remove('show'); }

async function save() {
  const title = document.getElementById('edTitle').value.trim();
  if (!title) return toast('请填写标题', 'err');
  const body = {
    title,
    type: document.getElementById('edType').value,
    theme_tags: groupValue('theme_tags', true),
    concerns: groupValue('concerns', true),
    publish_time: document.getElementById('edTime').value,
    cover: document.getElementById('edCover').value.trim(),
    content: document.getElementById('edContent').value,
  };
  const btn = document.getElementById('editSave');
  btn.disabled = true;
  try {
    if (EDIT_ID) await api('/api/resources/' + EDIT_ID, { method: 'PUT', body });
    else await api('/api/resources', { method: 'POST', body });
    toast('保存成功');
    closeEdit();
    load();
  } catch (e) {
    toast(e.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function delResource(id) {
  if (!confirm('确定删除该科普资源？删除后不可恢复。')) return;
  try {
    await api('/api/resources/' + id, { method: 'DELETE' });
    toast('已删除');
    load();
  } catch (e) {
    toast(e.message, 'err');
  }
}

document.getElementById('btnAdd').onclick = () => openEdit(null);
document.getElementById('editX').onclick = closeEdit;
document.getElementById('editCancel').onclick = closeEdit;
document.getElementById('editSave').onclick = save;
document.getElementById('btnFilter').onclick = load;
document.getElementById('fQ').addEventListener('keydown', e => { if (e.key === 'Enter') load(); });
document.getElementById('fType').addEventListener('change', load);

(async function init() {
  try {
    const res = await api('/api/meta');
    META = res.data;
    setSelect(document.getElementById('fType'), META.resource_types, '全部分类');
    setSelect(document.getElementById('edType'), META.resource_types, '');
    load();
  } catch (e) {
    toast('初始化失败：' + e.message, 'err');
  }
})();

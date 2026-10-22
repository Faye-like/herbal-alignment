/* 科普资源详情 */
injectNav('/resources', false);
injectFooter();

const rid = new URLSearchParams(location.search).get('id');

const FB = [['useful', '👍 有用'], ['useless', '👎 没用'], ['confusing', '🤔 没看懂']];

function renderDetail(item, related) {
  const acc = TYPE_ACCENT[item.type] || 'acc-brand';
  document.getElementById('detail').innerHTML =
    '<article class="read ' + acc + '">' +
    '<div class="read-head">' +
    '<div class="read-kicker"><span class="read-type">' + escapeHtml(item.type || '科普') + '</span>' +
    '<span class="read-tags">' + tagsHtml(item.theme_tags) + '</span></div>' +
    '<h1 class="read-title">' + escapeHtml(item.title) + '</h1>' +
    '<div class="read-meta">《青年养生知识手册》章节 · 整理于 ' + escapeHtml(fmtDate(item.publish_time)) + '</div>' +
    '</div>' +
    '<div class="article">' + (item.content || '<p class="muted">暂无正文</p>') + '</div>' +
    '<div class="read-concern"><span class="rc-tag">关联关注点</span> ' + tagsHtml(item.concerns, 'orange') + '</div>' +
    '<div class="feedback-bar">' +
    '<span class="fb-q">这章内容对你有帮助吗？</span>' +
    FB.map(([k, t]) => '<button class="fb-btn" data-fb="' + k + '">' + t + '</button>').join('') +
    '<span id="fbDone" class="muted" style="margin-left:auto"></span>' +
    '</div></article>';

  document.querySelectorAll('#detail .fb-btn').forEach(btn => {
    btn.onclick = () => submitFeedback(btn.dataset.fb);
  });

  if (related && related.length) {
    document.getElementById('relatedWrap').style.display = '';
    document.getElementById('related').innerHTML = related.map(resCardHtml).join('');
  }
}

async function submitFeedback(type) {
  try {
    await api('/api/resources/' + rid + '/feedback', {
      method: 'POST',
      body: { type, user_id: getUserId() }
    });
    document.querySelectorAll('#detail .fb-btn').forEach(b => b.classList.remove('on'));
    const el = document.querySelector('#detail .fb-btn[data-fb="' + type + '"]');
    if (el) el.classList.add('on');
    document.getElementById('fbDone').textContent = '已收到你的反馈，感谢！';
    toast('反馈已提交，感谢你的评价');
  } catch (e) {
    toast(e.message, 'err');
  }
}

(async function init() {
  if (!rid) {
    document.getElementById('detail').innerHTML = '<div class="empty">缺少资源 id</div>';
    return;
  }
  try {
    const res = await api('/api/resources/' + rid);
    renderDetail(res.item, res.related);
  } catch (e) {
    document.getElementById('detail').innerHTML = '<div class="empty">' + escapeHtml(e.message) + '</div>';
  }
})();

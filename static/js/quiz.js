/* 身心自查问卷：诉求 → 身心状态（5 躯体 + 3 思虑）→ 补剂 → 行为问卷 → 报告 */
injectNav('/quiz', false);
injectFooter();

const STAGES = ['intro', 'demand', 'body', 'supply', 'behavior'];
const STAGE_PCT = { intro: 0, demand: 12, body: 34, supply: 60, behavior: 66 };

let QUESTIONS = [];
let ASSESS = null;
let stage = 'intro';

const pickedConcerns = [];
const bodyAnswers = {};
const mindAnswers = {};
const pickedSupps = [];
let answers = {};
let qIndex = 0;
let userHeight = '';
let userWeight = '';

const stageEl = document.getElementById('quizStage');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');

/* ---------------- 进度与底部按钮 ---------------- */
function setProgress(pct, text) {
  document.getElementById('progressBar').style.width = pct + '%';
  document.getElementById('progressText').textContent = text || '';
}

function updateProgress() {
  if (stage === 'intro') { setProgress(0, '开始之前'); return; }
  if (stage === 'demand') { setProgress(12, '第 1 步 / 共 4 步 · 养生诉求'); return; }
  if (stage === 'body') { setProgress(34, '第 2 步 / 共 4 步 · 身心状态'); return; }
  if (stage === 'supply') { setProgress(60, '第 3 步 / 共 4 步 · 补剂现状'); return; }
  if (stage === 'behavior') {
    const p = STAGE_PCT.behavior + (qIndex + 1) / QUESTIONS.length * (100 - STAGE_PCT.behavior);
    setProgress(p, '第 4 步 · 行为问卷 ' + (qIndex + 1) + ' / ' + QUESTIONS.length);
  }
}

function setActions(prevText, nextText, nextDisabled) {
  document.getElementById('quizActions').style.display = '';
  prevBtn.textContent = prevText || '上一步';
  prevBtn.disabled = !prevText;
  nextBtn.textContent = nextText;
  nextBtn.disabled = !!nextDisabled;
}

/* ---------------- 引导页 ---------------- */
function renderIntro() {
  const totalQ = QUESTIONS.length + 5 + 3;
  stageEl.innerHTML =
    '<div class="quiz-card quiz-intro">' +
    '<h2 class="qi-title">先花 3 分钟，认识身体的「底子」</h2>' +
    '<p class="qi-text">这份问卷把身体和情绪放在一起看：先了解你的养生诉求与近期躯体状态，' +
    '再看长期思虑习惯，最后用行为偏好匹配你的草本人格。</p>' +
    '<div class="qi-list">' +
    '<div class="qi-item"><b>Part 1</b><span>你的养生诉求（多选）与身高体重（计算 BMI）</span></div>' +
    '<div class="qi-item"><b>Part 2</b><span>身心状态：5 个躯体维度 + 思虑内耗倾向，共 8 题</span></div>' +
    '<div class="qi-item"><b>Part 3</b><span>补剂现状采集（可多选）</span></div>' +
    '<div class="qi-item"><b>Part 4</b><span>养生行为问卷，' + QUESTIONS.length + ' 题，判定药材塑</span></div>' +
    '</div>' +
    '<div class="qi-note">思虑内耗部分只观察日常思虑习惯，≠ 心理测评，不做任何心理诊断；' +
    '如果长期情绪痛苦，建议寻求专业心理支持。</div>' +
    '<div class="qi-meta">共 ' + totalQ + ' 题 · 结果仅作养生参考</div>' +
    '</div>';
  setActions('', '开始自查', false);
}

/* ---------------- Part1 诉求 ---------------- */
function hwValid() {
  const h = parseFloat(userHeight);
  const w = parseFloat(userWeight);
  return h >= 120 && h <= 230 && w >= 30 && w <= 250;
}

function demandReady() {
  return pickedConcerns.length > 0 && hwValid();
}

function dropCustomConcern() {
  for (let i = pickedConcerns.length - 1; i >= 0; i--) {
    if (pickedConcerns[i].indexOf('其他：') === 0) pickedConcerns.splice(i, 1);
  }
}

function renderDemand() {
  stageEl.innerHTML =
    '<div class="quiz-card">' +
    '<div class="qz-step">Part 1 / 你的养生诉求</div>' +
    '<div class="quiz-question">最近你最想改善哪些方面？<span class="qz-hint">可多选</span></div>' +
    '<div class="chip-grid" id="demandGrid">' +
    (ASSESS.concerns || []).map(c =>
      '<button type="button" class="chip' + (pickedConcerns.indexOf(c) >= 0 ? ' on' : '') +
      '" data-c="' + escapeAttr(c) + '">' + escapeHtml(c) + '</button>').join('') +
    '<button type="button" class="chip" id="demandOtherChip">其他</button>' +
    '</div>' +
    '<div class="custom-row" id="demandCustomRow" style="display:none">' +
    '<input type="text" class="custom-input" id="demandCustom" maxlength="16" placeholder="写下你的养生诉求，例如：久坐腰酸">' +
    '</div>' +
    '<div class="hw-row">' +
    '<label class="hw-item"><span>身高</span><input type="number" id="heightInput" min="120" max="230" step="1" placeholder="170">' +
    '<span class="hw-unit">cm</span></label>' +
    '<label class="hw-item"><span>体重</span><input type="number" id="weightInput" min="30" max="250" step="0.1" placeholder="60">' +
    '<span class="hw-unit">kg</span></label>' +
    '</div>' +
    '<p class="note-line">身高体重仅用于计算 BMI，结合 BMI 给出饮食与运动建议，不会公开展示。</p>' +
    '<p class="qz-tip">至少选 1 项，选得越准，后面的调理方案越贴近你。</p>' +
    '</div>';

  const sync = () => {
    nextBtn.disabled = !demandReady();
  };

  stageEl.querySelectorAll('#demandGrid .chip').forEach(b => {
    if (b.id === 'demandOtherChip') return;
    b.onclick = () => {
      const c = b.dataset.c;
      const i = pickedConcerns.indexOf(c);
      if (i >= 0) pickedConcerns.splice(i, 1); else pickedConcerns.push(c);
      b.classList.toggle('on', pickedConcerns.indexOf(c) >= 0);
      sync();
    };
  });

  // 「其他」：点击后自由填写，填写内容作为自定义诉求参与报告
  const otherChip = document.getElementById('demandOtherChip');
  const otherRow = document.getElementById('demandCustomRow');
  const otherInput = document.getElementById('demandCustom');
  const hasCustom = pickedConcerns.some(c => c.indexOf('其他：') === 0);
  if (hasCustom) {
    otherChip.classList.add('on');
    otherRow.style.display = '';
    otherInput.value = pickedConcerns.filter(c => c.indexOf('其他：') === 0)[0].slice(3);
  }
  otherChip.onclick = () => {
    const on = otherChip.classList.toggle('on');
    otherRow.style.display = on ? '' : 'none';
    dropCustomConcern();
    if (on) { otherInput.focus(); }
    else { otherInput.value = ''; }
    sync();
  };
  otherInput.oninput = () => {
    const text = otherInput.value.trim();
    dropCustomConcern();
    if (text) pickedConcerns.push('其他：' + text);
    sync();
  };

  const heightInput = document.getElementById('heightInput');
  const weightInput = document.getElementById('weightInput');
  heightInput.value = userHeight || '';
  weightInput.value = userWeight || '';
  heightInput.oninput = () => { userHeight = heightInput.value; sync(); };
  weightInput.oninput = () => { userWeight = weightInput.value; sync(); };

  setActions('上一步', '下一步', !demandReady());
}

/* ---------------- Part2 身心状态 ---------------- */
function scaleQuestionHtml(q, val, prefix) {
  return '<div class="scale-q" data-id="' + q.id + '">' +
    '<div class="sq-title">' + escapeHtml(q.q) + '</div>' +
    '<div class="scale-opts">' +
    (ASSESS.scale || []).map((s, i) =>
      '<button type="button" class="scale-opt' + (val === i ? ' on' : '') +
      '" data-i="' + i + '">' + escapeHtml(s) + '</button>').join('') +
    '</div></div>';
}

function renderBody() {
  stageEl.innerHTML =
    '<div class="quiz-card">' +
    '<div class="qz-step">Part 2 / 身心状态评估</div>' +
    '<div class="quiz-question">过去一个月，这些情况出现的频率？</div>' +
    '<div class="qz-group-label">躯体状态</div>' +
    (ASSESS.body_questions || []).map(q => scaleQuestionHtml(q, bodyAnswers[q.id], 'body')).join('') +
    '<div class="qz-group-label">思虑内耗倾向</div>' +
    '<p class="qz-group-sub">' + escapeHtml(ASSESS.mind_notice || '') + '</p>' +
    (ASSESS.mind_questions || []).map(q => scaleQuestionHtml(q, mindAnswers[q.id], 'mind')).join('') +
    '</div>';

  stageEl.querySelectorAll('.scale-q').forEach(box => {
    const id = box.dataset.id;
    const isMind = id.charAt(0) === 'm';
    box.querySelectorAll('.scale-opt').forEach(b => {
      b.onclick = () => {
        const i = parseInt(b.dataset.i, 10);
        if (isMind) mindAnswers[id] = i; else bodyAnswers[id] = i;
        box.querySelectorAll('.scale-opt').forEach(x => x.classList.toggle('on', x === b));
        nextBtn.disabled = !bodyReady();
      };
    });
  });
  setActions('上一步', '下一步', !bodyReady());
}

function bodyReady() {
  const bq = (ASSESS.body_questions || []).every(q => bodyAnswers[q.id] !== undefined);
  const mq = (ASSESS.mind_questions || []).every(q => mindAnswers[q.id] !== undefined);
  return bq && mq;
}

/* ---------------- Part2-1 补剂 ---------------- */
function supplyReady() {
  const hasOther = pickedSupps.some(s => s.indexOf('其他：') === 0);
  return pickedSupps.length > 0 && (!hasOther || pickedSupps.some(s => s.indexOf('其他：') === 0 && s.length > 3));
}

function dropCustomSupp() {
  for (let i = pickedSupps.length - 1; i >= 0; i--) {
    if (pickedSupps[i].indexOf('其他：') === 0) pickedSupps.splice(i, 1);
  }
}

function renderSupply() {
  stageEl.innerHTML =
    '<div class="quiz-card">' +
    '<div class="qz-step">Part 3 / 补剂现状</div>' +
    '<div class="quiz-question">你目前正在服用哪些补剂？<span class="qz-hint">可多选</span></div>' +
    '<p class="qz-tip">这一项用于让食疗建议和你现有的补剂习惯错开，不会推荐你停用。</p>' +
    '<div class="chip-grid" id="suppGrid">' +
    (ASSESS.supplements || []).filter(s => s !== '其他').map(s =>
      '<button type="button" class="chip' + (pickedSupps.indexOf(s) >= 0 ? ' on' : '') +
      '" data-s="' + escapeAttr(s) + '">' + escapeHtml(s) + '</button>').join('') +
    '<button type="button" class="chip" id="suppOtherChip">其他</button>' +
    '</div>' +
    '<div class="custom-row" id="suppCustomRow" style="display:none">' +
    '<input type="text" class="custom-input" id="suppCustom" maxlength="20" placeholder="填写补剂名称，例如：月见草油">' +
    '</div></div>';

  const sync = () => {
    nextBtn.disabled = !supplyReady();
    document.querySelectorAll('#suppGrid .chip').forEach(x => {
      if (x.id === 'suppOtherChip') return;
      x.classList.toggle('on', pickedSupps.indexOf(x.dataset.s) >= 0);
    });
  };

  stageEl.querySelectorAll('#suppGrid .chip').forEach(b => {
    if (b.id === 'suppOtherChip') return;
    b.onclick = () => {
      const s = b.dataset.s;
      if (s === '目前没有服用') {
        pickedSupps.length = 0;
        pickedSupps.push(s);
      } else {
        const none = pickedSupps.indexOf('目前没有服用');
        if (none >= 0) pickedSupps.splice(none, 1);
        const i = pickedSupps.indexOf(s);
        if (i >= 0) pickedSupps.splice(i, 1); else pickedSupps.push(s);
      }
      sync();
    };
  });

  const otherChip = document.getElementById('suppOtherChip');
  const otherRow = document.getElementById('suppCustomRow');
  const otherInput = document.getElementById('suppCustom');
  const custom = pickedSupps.filter(s => s.indexOf('其他：') === 0)[0];
  if (custom) {
    otherChip.classList.add('on');
    otherRow.style.display = '';
    otherInput.value = custom.slice(3);
  }
  otherChip.onclick = () => {
    const on = otherChip.classList.toggle('on');
    otherRow.style.display = on ? '' : 'none';
    dropCustomSupp();
    if (on) otherInput.focus(); else otherInput.value = '';
    sync();
  };
  otherInput.oninput = () => {
    dropCustomSupp();
    const text = otherInput.value.trim();
    if (text) pickedSupps.push('其他：' + text);
    sync();
  };

  setActions('上一步', '开始行为问卷', !supplyReady());
}

/* ---------------- Part4 行为问卷（双极对比 / 最后一题多选） ---------------- */
function inputReady(q) {
  const a = answers[q.id];
  if (q.type === 'multi') {
    return !!(a && typeof a === 'object' && ((a.picks || []).length || (a.other || '').trim()));
  }
  return a !== undefined;
}

function renderQuestion() {
  const q = QUESTIONS[qIndex];
  if (q.type === 'multi') return renderMultiQuestion(q);

  const val = answers[q.id];

  stageEl.innerHTML =
    '<div class="quiz-card">' +
    '<div class="qz-step">Part 4 / 养生行为问卷</div>' +
    '<div class="quiz-question">' + escapeHtml(q.q) +
      '<span class="qz-hint">选择最接近你的一档</span></div>' +
    '<div class="quiz-options">' +
    q.options.map((o, i) =>
      '<button type="button" class="quiz-opt' + (val === i ? ' on' : '') + '" data-i="' + i + '">' +
      '<span class="quiz-opt-text">' + escapeHtml(o.text) + '</span></button>').join('') +
    '</div></div>';

  stageEl.querySelectorAll('.quiz-opt').forEach(b => {
    b.onclick = () => {
      answers[q.id] = parseInt(b.dataset.i, 10);
      stageEl.querySelectorAll('.quiz-opt').forEach(x => x.classList.toggle('on', x === b));
      nextBtn.disabled = false;
    };
  });

  const last = qIndex === QUESTIONS.length - 1;
  setActions('上一题', last ? '提交并生成报告' : '下一题', !inputReady(q));
}

function renderMultiQuestion(q) {
  const cur = (answers[q.id] && typeof answers[q.id] === 'object') ? answers[q.id] : { picks: [], other: '' };
  const picked = cur.picks || [];
  const otherText = cur.other || '';

  stageEl.innerHTML =
    '<div class="quiz-card">' +
    '<div class="qz-step">Part 4 / 养生行为问卷</div>' +
    '<div class="quiz-question">' + escapeHtml(q.q) +
      '<span class="qz-hint">' + escapeHtml(q.hint || '可多选') + '</span></div>' +
    '<div class="chip-grid" id="lastGrid">' +
    q.options.map((o, i) =>
      '<button type="button" class="chip' + (picked.indexOf(i) >= 0 ? ' on' : '') +
      '" data-i="' + i + '">' + escapeHtml(o.text) + '</button>').join('') +
    '<button type="button" class="chip" id="lastOtherChip">其他</button>' +
    '</div>' +
    '<div class="custom-row" id="lastCustomRow" style="display:none">' +
    '<input type="text" class="custom-input" id="lastCustom" maxlength="20" placeholder="写下你想调理的方面，例如：久坐腰酸">' +
    '</div>' +
    '<p class="note-line">选择或补充的内容会写进报告，并用于生成对应的食疗与计划。</p>' +
    '</div>';

  const sync = () => {
    answers[q.id] = { picks: picked.slice(), other: (document.getElementById('lastCustom') || {}).value || '' };
    nextBtn.disabled = !inputReady(q);
  };

  stageEl.querySelectorAll('#lastGrid .chip').forEach(b => {
    if (b.id === 'lastOtherChip') return;
    b.onclick = () => {
      const i = parseInt(b.dataset.i, 10);
      const at = picked.indexOf(i);
      if (at >= 0) picked.splice(at, 1); else picked.push(i);
      b.classList.toggle('on', picked.indexOf(i) >= 0);
      sync();
    };
  });

  const otherChip = document.getElementById('lastOtherChip');
  const otherRow = document.getElementById('lastCustomRow');
  const otherInput = document.getElementById('lastCustom');
  if (otherText) {
    otherChip.classList.add('on');
    otherRow.style.display = '';
    otherInput.value = otherText;
  }
  otherChip.onclick = () => {
    const on = otherChip.classList.toggle('on');
    otherRow.style.display = on ? '' : 'none';
    if (on) otherInput.focus(); else otherInput.value = '';
    sync();
  };
  otherInput.oninput = () => sync();

  answers[q.id] = { picks: picked.slice(), other: otherText };
  setActions('上一题', '提交并生成报告', !inputReady(q));
}

/* ---------------- 提交 ---------------- */
/* 重新填写报告后：清空当天打卡记录与本地任务勾选，任务回到未打卡状态 */
async function resetCheckinAfterNewReport() {
  const uid = (typeof effectiveUserId === 'function') ? effectiveUserId() : '';
  if (uid) {
    try { await api('/api/checkin/reset', { method: 'POST', body: { user_id: uid } }); } catch (e) { /* 忽略 */ }
  }
  try {
    const prefix = scopedKey('plan_check') + '_';
    Object.keys(localStorage).forEach(k => {
      if (k.indexOf(prefix) === 0) localStorage.removeItem(k);
    });
  } catch (e) { /* 忽略 */ }
}

async function submit() {
  nextBtn.disabled = true;
  nextBtn.textContent = '正在生成你的身心报告…';
  try {
    const res = await api('/api/quiz/submit', {
      method: 'POST',
      body: {
        answers,
        body_answers: bodyAnswers,
        mind_answers: mindAnswers,
        concerns: pickedConcerns,
        supplements: pickedSupps,
        height: parseFloat(userHeight),
        weight: parseFloat(userWeight),
      }
    });
    sessionStorage.setItem(scopedKey('quiz_report'), JSON.stringify(res.report));
    localStorage.setItem(scopedKey('quiz_report_saved'), JSON.stringify(res.report));
    const r = res.report;
    const h = r.herb || {};
    localStorage.setItem(scopedKey('herb_profile'), JSON.stringify({
      id: r.top_id,
      name: h.name,
      herb: h.herb,
      image: h.image,
      color: h.color,
      tagline: h.tagline,
      traits: h.traits || [],
      slang: h.slang || '',
      health_focus: h.health_focus || '',
      effect_intro: h.effect_intro || '',
      focus_intro: h.focus_intro || '',
      advice: h.advice || [],
      school: (r.persona || {}).school || '',
      mind_level: (r.mind || {}).level || '',
      mind_label: (r.mind || {}).label || '',
      body_labels: (r.body || {}).labels || [],
      saved_at: new Date().toISOString()
    }));
    await resetCheckinAfterNewReport();
    location.href = '/report';
  } catch (e) {
    toast(e.message, 'err');
    nextBtn.disabled = false;
    nextBtn.textContent = '提交并生成报告';
  }
}

/* ---------------- 导航 ---------------- */
function goto(next) {
  stage = next;
  if (stage === 'intro') renderIntro();
  else if (stage === 'demand') renderDemand();
  else if (stage === 'body') renderBody();
  else if (stage === 'supply') renderSupply();
  else renderQuestion();
  updateProgress();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

prevBtn.onclick = () => {
  if (stage === 'demand') goto('intro');
  else if (stage === 'body') goto('demand');
  else if (stage === 'supply') goto('body');
  else if (stage === 'behavior') {
    if (qIndex > 0) { qIndex--; renderQuestion(); updateProgress(); }
    else goto('supply');
  }
};

nextBtn.onclick = () => {
  if (stage === 'intro') return goto('demand');
  if (stage === 'demand') {
    if (!demandReady()) return;
    return goto('body');
  }
  if (stage === 'body') {
    if (!bodyReady()) return;
    return goto('supply');
  }
  if (stage === 'supply') {
    if (!supplyReady()) return;
    qIndex = 0;
    return goto('behavior');
  }
  if (stage === 'behavior') {
    if (answers[QUESTIONS[qIndex].id] === undefined) return;
    if (qIndex < QUESTIONS.length - 1) {
      qIndex++;
      renderQuestion();
      updateProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    submit();
  }
};

/* ---------------- 初始化 ---------------- */
(async function init() {
  if (!requireUser()) return;  // 未登录：已跳转登录页
  try {
    const res = await api('/api/quiz');
    QUESTIONS = res.questions || [];
    ASSESS = res.assessment || {};
    if (!QUESTIONS.length) { toast('题目加载失败', 'err'); return; }
    goto('intro');
  } catch (e) {
    toast('题目加载失败：' + e.message, 'err');
  }
})();

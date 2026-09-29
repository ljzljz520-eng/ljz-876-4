'use strict';
/* ================= 基础设施 ================= */
const state = { token: localStorage.getItem('cap_token') || null, user: null, route: location.hash.slice(1) || '/' };
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (iso) => !iso ? '—' : new Date(iso).toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }) + ' (北京)';
const roleName = { admin: '系统管理员', legal: '法务合规', audit: '审计监察', employee: '员工' };
const statusText = { not_started: '未开始', in_progress: '进行中', submitted_unsigned: '已交卷待签署', signed: '已签署确认', submitted: '已交卷' };

function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.className = 'toast'), 2600);
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  let res;
  try {
    res = await fetch('/api' + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch (e) {
    throw new Error('网络异常，请稍后重试');
  }
  const data = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败(${res.status})`);
  return data;
}

// 设备指纹：屏幕/时区/语言/平台等非敏感特征，用于异常代考识别辅助
function fingerprint() {
  const n = navigator, s = screen;
  return JSON.stringify({
    ua: n.userAgent, lang: n.language, tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: n.platform, vw: s.width, vh: s.height, dpr: window.devicePixelRatio,
    cores: n.hardwareConcurrency || null, touch: 'ontouchstart' in window,
  });
}

/* ================= 路由 ================= */
window.addEventListener('hashchange', () => { state.route = location.hash.slice(1) || '/'; render(); });

const staff = () => ['admin', 'legal', 'audit'].includes(state.user?.role);

function go(path) { location.hash = path; }

async function boot() {
  if (state.token) {
    try { state.user = await api('/auth/me'); }
    catch { localStorage.removeItem('cap_token'); state.token = null; }
  }
  render();
}

function render() {
  const app = $('#app');
  if (!state.user) { app.innerHTML = viewLogin(); bindLogin(); return; }
  app.innerHTML = `<div class="layout"><aside class="sidebar">
      <div class="brand">内控合规测评<small>COMPLIANCE ASSURANCE</small></div>
      <nav class="nav" id="nav">${navHtml()}</nav>
      <div class="userbox"><div class="name">${esc(state.user.full_name)}</div>
        <div>${esc(state.user.department)} · ${esc(state.user.position)}</div>
        <div>${state.user.high_risk ? '<span class="badge risk">高风险岗位</span>' : '<span class="badge normal">普通岗位</span>'}</div>
        <a id="logoutBtn">退出登录</a></div>
    </aside><main class="main" id="main"></main></div>`;
  $('#logoutBtn').onclick = doLogout;
  bindNav();
  routeMain();
}

function navHtml() {
  const items = [];
  if (state.user.role === 'employee') {
    items.push(['/', '我的学习任务'], ['/my-records', '我的学习档案']);
  } else {
    items.push(['/dashboard', '合规看板'], ['/evidence', '学习证据库'], ['/quizzes', '测验与版本'], ['/verify', '证据链校验'], ['/audit', '审计日志'], ['/verify-public', '公开验真']);
    if (state.user.role === 'admin') items.push(['/users', '用户与岗位']);
  }
  return items.map(([p, n]) => `<a data-path="${p}" class="${state.route === p ? 'active' : ''}"><span>${n}</span></a>`).join('');
}
function bindNav() {
  document.querySelectorAll('#nav a').forEach((a) => (a.onclick = () => go(a.dataset.path)));
}

function setMain(html) { $('#main').innerHTML = html; }
function pageHead(title, desc, actionsHtml = '') {
  return `<div class="page-head"><div><h2>${title}</h2><div class="desc">${desc}</div></div><div>${actionsHtml}</div></div>`;
}

async function routeMain() {
  const r = state.route.split('?')[0];
  const map = {
    '/': pageEmployeeHome, '/my-records': pageMyRecords, '/exam': pageExam, '/result': pageResult, '/record': pageRecordDetail,
    '/dashboard': pageDashboard, '/evidence': pageEvidenceList, '/evidence-detail': pageEvidenceDetail,
    '/quizzes': pageQuizzes, '/quiz-edit': pageQuizEdit, '/verify': pageVerifyChain, '/audit': pageAudit,
    '/verify-public': pageVerifyPublic, '/users': pageUsers,
  };
  const fn = map[r];
  try { (fn || pageDashboard)(); } catch (e) { toast(e.message, 'error'); }
}

/* ================= 登录 ================= */
function viewLogin() {
  return `<div class="login-wrap"><div class="login-card">
    <h1>企业内控合规测评平台</h1>
    <div class="sub">反舞弊 · 数据安全 · 采购红线 ｜ 全员学习留痕系统</div>
    <form id="loginForm">
      <div class="field"><label>账号</label><input id="lgUser" autocomplete="username" placeholder="请输入账号"></div>
      <div class="field"><label>密码</label><input id="lgPass" type="password" autocomplete="current-password" placeholder="请输入密码"></div>
      <button class="btn block" type="submit">登 录</button>
    </form>
    <div class="hint">
      演示账号：<br>
      管理员 admin / admin123（用户与岗位管理）<br>
      法务 legal01 / legal123（出题发布）<br>
      审计 audit01 / audit123（证据·验链·日志）<br>
      员工 zhangwei（高风险·采购）/ wangfang（普通）/ emp123
    </div></div></div>`;
}
function bindLogin() {
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = $('#lgUser').value.trim();
    const password = $('#lgPass').value;
    try {
      const r = await api('/auth/login', { method: 'POST', body: { username, password } });
      state.token = r.token; state.user = r.user;
      localStorage.setItem('cap_token', r.token);
      toast('登录成功', 'ok');
      location.hash = ['legal', 'audit', 'admin'].includes(r.user.role) ? '/dashboard' : '/';
      render();
    } catch (err) { toast(err.message, 'error'); }
  };
}
async function doLogout() {
  try { await api('/auth/logout', { method: 'POST' }); } catch {}
  state.token = null; state.user = null;
  localStorage.removeItem('cap_token');
  location.hash = '/';
  render();
}

/* ================= 员工端 ================= */
async function pageEmployeeHome() {
  setMain(pageHead('我的学习任务', '请完成指派的合规测验并在通过后签署学习确认；所有作答与签署均全程留痕。') + '<div id="list" class="quiz-grid">加载中…</div>');
  const data = await api('/dashboard/mine');
  $('#list').innerHTML = data.items.map((it) => {
    let badge = `<span class="badge not_started">未开始</span>`;
    let action = `<button class="btn" data-go="${it.state === 'in_progress' ? `/result?attempt=${it.attempt_id}` : `/exam?quiz=${it.quiz_id}`}">${it.state === 'in_progress' ? '继续查看' : '开始学习与测验'}</button>`;
    if (it.state === 'submitted_unsigned') {
      if (it.passed) { badge = `<span class="badge submitted_unsigned">已通过，待签署</span>`; action = `<button class="btn" data-go="/result?attempt=${it.attempt_id}">去签署确认</button>`; }
      else { badge = `<span class="badge fail">未达线 · 需重考</span>`; action = `<button class="btn danger" data-go="/exam?quiz=${it.quiz_id}">重新考试</button>`; }
    }
    if (it.state === 'signed') {
      badge = `<span class="badge signed">已签署确认 ✓</span>`;
      action = `<button class="btn ghost" data-go="/record?attempt=${it.attempt_id}">查看证据/下载凭证</button>`;
    }
    if (it.state === 'in_progress') badge = `<span class="badge in_progress">考试进行中</span>`;
    return `<div class="quiz-card">
      <div class="flex" style="justify-content:space-between"><span class="badge cat">${esc(it.category)}</span>${badge}</div>
      <h4>${esc(it.title)}</h4>
      <div class="meta">
        当前版本 v${it.version}<br>
        本人适用通过线：<b style="color:${data.high_risk ? 'var(--red)' : 'var(--primary2)'}">${it.my_threshold} 分</b>
        （普通线 ${it.pass_score} / 高风险线 ${it.high_risk_pass_score}）<br>
        ${it.state === 'signed' ? `签署时间：${fmt(it.signed_at)} ｜ 成绩 ${it.score} 分<br>第 ${it.attempt_count} 次考试完成` :
          it.attempt_count ? `历史考试 ${it.attempt_count} 次，最高分 ${it.best_score}` : '尚未参加考试'}
      </div>
      <div class="actions">${action}</div></div>`;
  }).join('');
  if (data.high_risk) {
    $('#list').insertAdjacentHTML('beforebegin', `<div class="warn-box" style="margin-bottom:14px">
      ⚠ 您所在岗位被标记为<b>高风险岗位</b>，相关测验须达到 <b>90 分</b>方可签署确认；未达线成绩不予确认，需重新考试（所有历史成绩均留痕保留）。</div>`);
  }
  document.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => go(b.dataset.go)));
}

async function pageMyRecords() {
  setMain(pageHead('我的学习档案', '逐次记录、逐场留痕：每次考试（含未通过）与签署均作为证据永久保存。'));
  const rows = await api('/attempts/my');
  setMain(pageHead('我的学习档案', '逐次记录、逐场留痕：每次考试（含未通过）与签署均作为证据永久保存。') + renderAttemptTable(rows, true));
  bindRecordLinks();
}

function renderAttemptTable(rows, mine) {
  if (!rows.length) return '<div class="panel muted">暂无考试记录</div>';
  return `<div class="panel"><table><thead><tr>
    <th>记录</th>${mine ? '' : '<th>员工</th><th>部门/岗位</th>'}<th>测验</th><th>版本</th><th>得分/分数线</th><th>状态</th><th>开考(北京)</th><th>交卷(北京)</th><th>签署(北京)</th><th>用时</th><th>操作</th>
  </tr></thead><tbody>${rows.map((r) => `<tr>
    <td class="mono">#${String(r.id).padStart(5, '0')}</td>
    ${mine ? '' : `<td>${esc(r.full_name)}${r.high_risk ? ' <span class="badge risk">高风险</span>' : ''}</td>
      <td>${esc(r.department)}<br><span class="muted">${esc(r.position)}</span></td>`}
    <td>${esc(r.quiz_title)}<br><span class="muted">${esc(r.quiz_category)}</span></td>
    <td>v${r.version_number}</td>
    <td><b>${r.score == null ? '—' : r.score}</b> / ${r.pass_threshold}
      ${r.score != null ? (r.passed ? '<br><span class="badge pass">通过</span>' : '<br><span class="badge fail">未达线</span>') : ''}</td>
    <td><span class="badge ${r.status}">${statusText[r.status] || r.status}</span></td>
    <td>${fmt(r.started_at)}</td><td>${fmt(r.submitted_at)}</td><td>${fmt(r.signed_at)}</td>
    <td>${r.duration_seconds != null ? Math.floor(r.duration_seconds / 60) + '分' + (r.duration_seconds % 60) + '秒' : '—'}</td>
    <td><a data-rec="${r.id}" class="evlink">证据详情</a></td>
  </tr>`).join('')}</tbody></table></div>`;
}
function bindRecordLinks() {
  document.querySelectorAll('.evlink').forEach((a) => (a.onclick = () => go('/record?attempt=' + a.dataset.rec)));
}

/* ================= 考试页 ================= */
let examTimer = null;
async function pageExam() {
  const quizId = new URLSearchParams(location.hash.split('?')[1] || '').get('quiz');
  setMain('<div class="panel">加载试卷中…</div>');
  const start = await api('/attempts/start', { method: 'POST', body: { quiz_id: +quizId, fingerprint: fingerprint() } });
  const deadline = new Date(new Date(start.started_at).getTime() + start.time_limit_minutes * 60000).getTime();
  const answers = new Array(start.questions.length).fill(null);

  setMain(`<div>
    <div class="quiz-header"><div><h3 id="examTitle"></h3><div style="font-size:12px;opacity:.85">试题版本 v${start.version_number} · 开考时间已固化 · 共 ${start.questions.length} 题，每题 10 分</div></div>
      <div class="timer" id="timer">--:--</div></div>
    <div id="qs">${start.questions.map((q, i) => `<div class="q-item">
      <div class="qt">${i + 1}. ${esc(q.q)}</div>
      ${q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}">${esc(o)}</label>`).join('')}
    </div>`).join('')}</div>
    <div class="panel"><label class="flex" style="gap:8px"><input type="checkbox" id="cert"><span>我确认：本次测验由本人独立完成，未由他人代答或使用未经许可的资料。</span></label>
      <div class="mt8 muted">提示：系统将记录开考/交卷时间、作答用时、IP 与设备信息；是否通过以你岗位适用的分数线为准（高风险岗位要求更高）。</div>
      <div class="mt16"><button class="btn" id="submitBtn" disabled>交卷（服务器评分）</button></div>
    </div></div>`);
  $('#examTitle').textContent = '测验进行中';

  document.querySelectorAll('input[type=radio]').forEach((radio) => {
    radio.onchange = () => {
      const qi = +radio.name.slice(1);
      answers[qi] = +radio.value;
      $('#submitBtn').disabled = !$('#cert').checked;
    };
  });
  $('#cert').onchange = () => ($('#submitBtn').disabled = !$('#cert').checked || answers.every((a) => a === null));
  $('#submitBtn').disabled = true;

  clearInterval(examTimer);
  const tick = () => {
    const left = Math.max(0, deadline - Date.now());
    const m = String(Math.floor(left / 60000)).padStart(2, '0');
    const s = String(Math.floor((left % 60000) / 1000)).padStart(2, '0');
    $('#timer').textContent = `${m}:${s}`;
    if (left <= 0) doSubmit(true);
  };
  tick();
  examTimer = setInterval(tick, 1000);

  $('#submitBtn').onclick = () => doSubmit(false);
  async function doSubmit(auto) {
    clearInterval(examTimer);
    $('#submitBtn').disabled = true;
    try {
      const r = await api(`/attempts/${start.attempt_id}/submit`, { method: 'POST', body: { answers } });
      go('/result?attempt=' + r.attempt_id);
    } catch (e) { toast(e.message, 'error'); $('#submitBtn').disabled = false; }
  }
}

/* ================= 结果与签署页 ================= */
async function pageResult() {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('attempt');
  const d = await api('/attempts/' + id);
  if (d.status === 'signed') { go('/record?attempt=' + id); return; }
  if (d.status === 'in_progress') {
    setMain(pageHead('考试进行中', '本场考试尚未交卷') + `<div class="panel">开考时间：${fmt(d.started_at)}<div class="mt16"><a class="btn" href="#/exam?quiz=${d.quiz_id}">如页面异常请重新进入</a></div></div>`);
    return;
  }
  const ev = JSON.parse(d.events.find((e) => e.event_type === 'submitted').payload_json);
  const tooFast = ev.too_fast;
  setMain(pageHead('测验结果', `${esc(d.quiz_title)} · v${d.version_number}`) + `
    <div class="result-banner ${d.passed ? 'pass' : 'fail'}">
      <div>${d.passed ? '恭喜，已达到岗位分数线' : '未达到岗位要求分数线'}</div>
      <div class="score">${d.score} 分</div>
      <div>正确 ${ev.correct}/${ev.total} 题 ｜ 要求 ${d.pass_threshold} 分${d.high_risk ? '（高风险岗位）' : ''} ｜ 用时 ${Math.floor(ev.duration_seconds / 60)}分${ev.duration_seconds % 60}秒</div>
    </div>
    ${tooFast ? `<div class="warn-box">⚠ 本场作答用时低于测验设定的最短学习时长，系统已在证据中标记 <b>too_fast=true</b>，审计可据此核查。</div>` : ''}
    <div class="panel"><h3>答题回顾</h3>${reviewHtml(d)}</div>
    ${d.passed ? signBox(d) : retryBox(d)}`);

  if (d.passed) {
    const input = $('#signNameInput');
    $('#signForm').onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api(`/attempts/${id}/sign`, { method: 'POST', body: { signature_name: input.value.trim(), signature_text: input.value.trim() } });
        toast('学习确认已签署，证据已固化', 'ok');
        go('/record?attempt=' + id);
      } catch (err) { toast(err.message, 'error'); }
    };
  } else {
    $('#retryBtn').onclick = () => go('/exam?quiz=' + d.quiz_id);
  }
}
function reviewHtml(d) {
  return d.questions.map((q, i) => {
    const given = d.answers ? d.answers[i] : null;
    return `<div class="q-item"><div class="qt">${i + 1}. ${esc(q.q)}
        ${given === q.answer ? '<span class="badge pass" style="margin-left:6px">回答正确</span>' : '<span class="badge fail" style="margin-left:6px">回答错误/未答</span>'}</div>
      ${q.options.map((o, j) => {
        let cls = 'opt disabled';
        if (j === q.answer) cls += ' correct';
        else if (j === given) cls += ' wrong';
        const tag = j === q.answer ? ' ✓ 正确答案' : j === given ? ' ✗ 你的选择' : '';
        return `<div class="${cls}">${esc(o)}${tag}</div>`;
      }).join('')}</div>`;
  }).join('');
}
function signBox(d) {
  return `<div class="panel"><h3>学习确认与电子签署</h3>
    <div class="sign-box">
      <div class="decl">本人 <b>${esc(d.full_name)}</b>（${esc(d.department)} · ${esc(d.position)}）确认：
      已完整学习《${esc(d.quiz_title)}》(v${d.version_number}) 全部内容，独立完成测验并取得 <b>${d.score}</b> 分（达到${d.high_risk ? '高风险岗位' : '本岗位'} ${d.pass_threshold} 分要求）；
      已知晓相关红线要求与法律责任，承诺在工作中严格遵照执行。<br>
      本确认自签署起生效，签署时间、签署人、IP 与设备信息将作为不可篡改的电子证据长期保存。</div>
      <form id="signForm" class="flex" style="gap:10px;flex-wrap:wrap">
        <input class="" id="signNameInput" placeholder="请逐字输入本人姓名：${esc(d.full_name)}" style="flex:1;min-width:240px;padding:10px;border:1px solid var(--border);border-radius:7px">
        <button class="btn" type="submit">我确认并电子签署</button>
      </form>
    </div></div>`;
}
function retryBox(d) {
  return `<div class="panel" style="text-align:center">
    <p style="font-size:14px;line-height:1.9">你的成绩 <b>${d.score}</b> 分，未达到${d.high_risk ? '高风险岗位' : '本岗位'}要求的 <b>${d.pass_threshold}</b> 分，<b>不能签署学习确认</b>。<br>
    本场未通过记录同样已作为证据保存（审计可见），请重新学习后参加考试。</p>
    <div class="mt16"><button class="btn danger" id="retryBtn">重新参加考试</button></div></div>`;
}

/* ================= 证据详情（员工/管理共用） ================= */
async function pageRecordDetail() {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('attempt');
  const d = await api('/attempts/' + id);
  const signedEv = d.events.find((e) => e.event_type === 'signed');
  const code = signedEv ? signedEv.record_hash : d.events[0].record_hash;
  setMain(pageHead(`学习证据 #${String(d.id).padStart(5, '0')}`, `${esc(d.quiz_title)} · 证据可由任何人凭哈希码在“公开验真”页核验`,
    `<button class="btn ghost" onclick="window.open('/api/evidence/attempt/${d.id}/export?format=csv','_blank')">导出CSV凭证</button>
     <button class="btn" onclick="window.open('/api/evidence/attempt/${d.id}/export?format=json','_blank')">导出JSON证据包</button>`) + `
  <div class="cards">
    <div class="stat ${d.passed ? 'ok' : 'bad'}"><div class="num">${d.score == null ? '—' : d.score}</div><div class="lbl">得分（线 ${d.pass_threshold}）</div></div>
    <div class="stat"><div class="num">v${d.version_number}</div><div class="lbl">试题版本（已快照固化）</div></div>
    <div class="stat"><div class="num" style="font-size:15px;line-height:1.5;padding-top:6px">${esc(d.full_name)}</div><div class="lbl">${esc(d.department)} · ${esc(d.position)}${d.high_risk ? ' · 高风险' : ''}</div></div>
    <div class="stat ${d.status === 'signed' ? 'ok' : ''}"><div class="num" style="font-size:15px;line-height:1.5;padding-top:6px">${statusText[d.status]}</div><div class="lbl">证据状态</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:16px">
    <div class="panel"><h3>不可篡改时间线（哈希链事件）</h3><div class="timeline">
      ${d.events.map((e) => `<div class="tl-item ${e.event_type}">
        <div class="t">${{ started: '开考', submitted: '交卷评分', signed: '电子签署' }[e.event_type]}</div>
        <div class="time">${fmt(e.occurred_at)} ｜ IP ${esc(e.ip_address || '—')}</div>
        ${e.event_type === 'signed' ? '<div class="muted">签署人：' + esc(d.signature_name || '') + '</div>' : ''}
        <div class="hash">#${e.id} hash: ${e.record_hash}<br>prev: ${e.prev_hash}</div>
      </div>`).join('')}
    </div></div>
    <div>
      <div class="panel"><h3>留痕要素</h3><dl class="kv">
        <dt>员工账号</dt><dd>${esc(d.username || '')}</dd>
        <dt>开考时间</dt><dd>${fmt(d.started_at)}</dd>
        <dt>交卷时间</dt><dd>${fmt(d.submitted_at)}</dd>
        <dt>签署时间</dt><dd>${fmt(d.signed_at)}</dd>
        <dt>作答用时</dt><dd>${d.duration_seconds != null ? d.duration_seconds + ' 秒' : '—'}</dd>
        <dt>客户端 IP</dt><dd>${esc(d.ip_address || '—')}</dd>
        <dt>设备/浏览器</dt><dd style="font-size:11.5px">${esc(d.user_agent || '—')}</dd>
        <dt>设备指纹</dt><dd class="mono" style="font-size:10.5px">${esc(d.client_fingerprint || '—')}</dd>
      </dl></div>
      <div class="panel"><h3>公开验真码（签署事件哈希）</h3>
        <div class="mono" style="background:#f6f7f9;padding:10px;border-radius:7px">${code}</div>
        <div class="mt8"><a class="btn small ghost" href="#/verify-public?code=${code}">前往验真页核验</a></div>
      </div>
    </div>
  </div>
  <div class="panel"><h3>答题与评分明细（服务器评分）</h3>${reviewHtml(d)}</div>`);
}

window.addEventListener('DOMContentLoaded', boot);

/* ================= 管理端：合规看板 ================= */
async function pageDashboard() {
  setMain(pageHead('合规完成看板', '逐测验、逐人追踪"谁学了没、学的是哪个版本、何时签署"；高风险岗位未完成自动预警。') + '<div id="bd">加载中…</div>');
  const data = await api('/dashboard/summary');
  const totalEligible = data.quizzes.reduce((s, q) => s + q.eligible, 0);
  const totalSigned = data.quizzes.reduce((s, q) => s + q.signed, 0);
  const totalRiskPending = data.quizzes.reduce((s, q) => s + q.high_risk_pending, 0);
  $('#bd').innerHTML = `
    <div class="cards">
      <div class="stat"><div class="num">${data.quizzes.length}</div><div class="lbl">已发布测验</div></div>
      <div class="stat"><div class="num">${totalEligible}</div><div class="lbl">应学习人次</div></div>
      <div class="stat ok"><div class="num">${totalSigned}</div><div class="lbl">已签署确认人次</div></div>
      <div class="stat ${totalRiskPending ? 'warn' : 'ok'}"><div class="num">${totalRiskPending}</div><div class="lbl">高风险岗位未完成</div></div>
    </div>
    ${data.quizzes.map((q) => `
    <div class="panel">
      <div class="flex" style="justify-content:space-between;flex-wrap:wrap">
        <h3><span class="badge cat">${esc(q.category)}</span> ${esc(q.title)} <span class="muted" style="font-size:12px">v${q.version}</span></h3>
        <div class="muted" style="font-size:12px">普通线 ${q.pass_score} / 高风险线 ${q.high_risk_pass_score}</div>
      </div>
      <div class="cards" style="margin:10px 0">
        <div class="stat"><div class="num">${q.eligible}</div><div class="lbl">应学人数</div></div>
        <div class="stat ok"><div class="num">${q.signed}</div><div class="lbl">已签署</div></div>
        <div class="stat warn"><div class="num">${q.submitted_unsigned}</div><div class="lbl">已考待签</div></div>
        <div class="stat"><div class="num">${q.in_progress}</div><div class="lbl">进行中</div></div>
        <div class="stat bad"><div class="num">${q.not_started}</div><div class="lbl">未开始</div></div>
      </div>
      <table><thead><tr><th>员工</th><th>部门/岗位</th><th>风险</th><th>状态</th><th>考试次数</th><th>最高/签署分</th><th>签署时间</th><th>证据</th></tr></thead>
      <tbody>${q.people.map((p) => `<tr>
        <td>${esc(p.full_name)}</td>
        <td>${esc(p.department)}<br><span class="muted">${esc(p.position)}</span></td>
        <td>${p.high_risk ? '<span class="badge risk">高风险</span>' : '<span class="badge normal">普通</span>'}</td>
        <td><span class="badge ${p.state}">${statusText[p.state]}</span></td>
        <td>${p.attempt_count || 0}</td>
        <td>${p.best_score != null ? `${p.best_score}${p.score != null && p.state === 'signed' ? ' / ' + p.score : ''}` : '—'}</td>
        <td>${p.signed_at ? fmt(p.signed_at) : '—'}</td>
        <td>${p.attempt_id ? `<a class="evlink" data-rec="${p.attempt_id}">查看</a>` : '—'}</td>
      </tr>`).join('')}</tbody></table>
    </div>`).join('')}`;
  document.querySelectorAll('.evlink').forEach((a) => (a.onclick = () => go('/evidence-detail?attempt=' + a.dataset.rec)));
}

/* ================= 管理端：证据库 ================= */
async function pageEvidenceList() {
  setMain(pageHead('学习证据库', '每次考试（含未通过、进行中）均留存，可按测验/部门/状态筛查并导出逐人凭证。') +
    `<div class="filter-bar">
      <select id="fQuiz"><option value="">全部测验</option></select>
      <select id="fStatus"><option value="">全部状态</option>
        <option value="signed">已签署</option><option value="submitted">已交卷</option><option value="in_progress">进行中</option></select>
      <input id="fDept" placeholder="按部门筛选，如 采购部">
      <button class="btn small" id="fBtn">筛选</button>
    </div><div id="evList" class="panel">加载中…</div>`);
  const quizzes = await api('/quizzes');
  $('#fQuiz').innerHTML = '<option value="">全部测验</option>' + quizzes.map((q) => `<option value="${q.id}">${esc(q.title)}</option>`).join('');
  async function load() {
    const p = new URLSearchParams();
    if ($('#fQuiz').value) p.set('quiz_id', $('#fQuiz').value);
    if ($('#fStatus').value) p.set('status', $('#fStatus').value);
    if ($('#fDept').value.trim()) p.set('department', $('#fDept').value.trim());
    const rows = await api('/evidence/list?' + p.toString());
    $('#evList').innerHTML = renderAttemptTable(rows, false);
    document.querySelectorAll('.evlink').forEach((a) => (a.onclick = () => go('/evidence-detail?attempt=' + a.dataset.rec)));
  }
  $('#fBtn').onclick = load;
  load();
}

async function pageEvidenceDetail() {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('attempt');
  const d = await api('/attempts/' + id);
  const signedEv = d.events.find((e) => e.event_type === 'signed');
  const code = signedEv ? signedEv.record_hash : d.events[0].record_hash;
  setMain(pageHead(`证据审计视图 #${String(d.id).padStart(5, '0')}`, '全部字段服务器留痕；导出文件可作为外部稽核材料',
    `<button class="btn ghost" onclick="window.open('/api/evidence/attempt/${d.id}/export?format=csv','_blank')">导出CSV</button>
     <button class="btn" onclick="window.open('/api/evidence/attempt/${d.id}/export?format=json','_blank')">导出JSON证据包</button>`) + `
  <div class="cards">
    <div class="stat"><div class="num" style="font-size:15px;padding-top:6px;line-height:1.5">${esc(d.full_name)}${d.high_risk ? ' <span class="badge risk">高风险</span>' : ''}</div><div class="lbl">${esc(d.department)} · ${esc(d.position)}</div></div>
    <div class="stat ${d.passed ? 'ok' : 'bad'}"><div class="num">${d.score == null ? '—' : d.score}</div><div class="lbl">得分 / 线 ${d.pass_threshold}</div></div>
    <div class="stat"><div class="num" style="font-size:14px;padding-top:7px">${statusText[d.status]}</div><div class="lbl">状态（可在证据链校验页比对一致性）</div></div>
    <div class="stat"><div class="num" style="font-size:13px;padding-top:7px">${d.duration_seconds != null ? d.duration_seconds + 's' : '—'}</div><div class="lbl">作答用时</div></div>
  </div>
  <div style="display:grid;grid-template-columns:1.1fr .9fr;gap:16px">
    <div class="panel"><h3>证据事件链</h3><div class="timeline">
      ${d.events.map((e) => {
        const p = e.payload_json ? JSON.parse(e.payload_json) : null;
        return `<div class="tl-item ${e.event_type}">
        <div class="t">${{ started: '开考', submitted: '交卷评分', signed: '电子签署' }[e.event_type]}</div>
        <div class="time">${fmt(e.occurred_at)} ｜ IP ${esc(e.ip_address || '—')}</div>
        ${e.event_type === 'submitted' && p ? `<div class="muted" style="font-size:12px">固化成绩 ${p.score} 分 · ${p.correct}/${p.total} 正确${p.too_fast ? ' · <b style="color:var(--amber)">作答过快</b>' : ''}</div>` : ''}
        <div class="hash">#${e.id} ${e.record_hash}<br>prev: ${e.prev_hash}</div>
      </div>`;
      }).join('')}
    </div></div>
    <div>
      <dl class="kv panel"><h3>留痕要素</h3>
        <dt>试题版本</dt><dd>v${d.version_number}（开考时快照）</dd>
        <dt>开考/交卷/签署</dt><dd>${fmt(d.started_at)}<br>${fmt(d.submitted_at)}<br>${fmt(d.signed_at)}</dd>
        <dt>IP / UA</dt><dd style="font-size:11px">${esc(d.ip_address)}<br>${esc(d.user_agent)}</dd>
        <dt>设备指纹</dt><dd class="mono" style="font-size:10px">${esc(d.client_fingerprint)}</dd>
        <dt>电子签名</dt><dd>${esc(d.signature_name || '未签署')}</dd>
        <dt>验真码</dt><dd class="mono" style="font-size:10px">${code}<br><a href="#/verify-public?code=${code}">公开验真 →</a></dd>
      </dl>
    </div>
  </div>
  <div class="panel"><h3>评分明细</h3>${reviewHtml(d)}</div>`);
}

/* ================= 测验与版本管理 ================= */
async function pageQuizzes() {
  setMain(pageHead('测验与版本管理', '题目发布即固化为版本；后续改版生成新版本，历史考试永远绑定开考时的版本快照。',
    state.user.role === 'admin' || state.user.role === 'legal' ? '<button class="btn" id="newQuizBtn">+ 新建测验</button>' : '') +
    '<div id="qList" class="quiz-grid">加载中…</div>');
  const rows = await api('/quizzes');
  $('#qList').innerHTML = rows.map((q) => `<div class="quiz-card">
    <div class="flex" style="justify-content:space-between"><span class="badge cat">${esc(q.category)}</span>
      <span class="badge ${q.published ? 'pass' : 'not_started'}">${q.published ? '已发布 v' + q.current_version : '草稿'}</span></div>
    <h4>${esc(q.title)}</h4>
    <div class="meta">${esc(q.description)}<br>普通线 ${q.pass_score} ｜ 高风险线 ${q.high_risk_pass_score} ｜ 时长 ${q.time_limit_minutes} 分钟 ｜ 最小学时 ${q.min_duration_seconds} 秒</div>
    <div class="actions">
      ${['admin', 'legal'].includes(state.user.role) ? `<button class="btn small" data-edit="${q.id}">编辑/改版</button>` : ''}
      <a class="btn small ghost" data-versions="${q.id}">版本记录</a>
    </div></div>`).join('') || '<div class="panel muted">暂无测验</div>';
  if ($('#newQuizBtn')) $('#newQuizBtn').onclick = () => go('/quiz-edit');
  document.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => go('/quiz-edit?id=' + b.dataset.edit)));
  document.querySelectorAll('[data-versions]').forEach((b) => (b.onclick = async () => {
    const vs = await api(`/quizzes/${b.dataset.versions}/versions`);
    showModal(`版本记录`, `<table><thead><tr><th>版本</th><th>题数</th><th>发布时间</th><th>发布人</th></tr></thead><tbody>
      ${vs.map((v) => `<tr><td>v${v.version}</td><td>${v.question_count} 题 / ${v.points_total} 分</td><td>${fmt(v.published_at)}</td><td>${esc(v.publisher_name || '—')}</td></tr>`).join('')}</tbody></table>`);
  }));
}

async function pageQuizEdit() {
  const id = new URLSearchParams(location.hash.split('?')[1] || '').get('id');
  let q = { title: '', category: '反舞弊', description: '', pass_score: 80, high_risk_pass_score: 90, time_limit_minutes: 30, min_duration_seconds: 60, questions: [] };
  if (id) q = await api('/quizzes/' + id);
  setMain(pageHead(id ? '编辑测验 / 发布新版本' : '新建测验', '保存后可发布为版本；已发布测验的题目修改将生成新版本，不影响历史证据。') + `
  <div class="panel">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <div class="field"><label>标题</label><input id="qTitle" value="${esc(q.title)}"></div>
      <div class="field"><label>分类</label>
        <select id="qCat">${['反舞弊', '数据安全', '采购红线', '其他'].map((c) => `<option ${q.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div class="field" style="grid-column:1/3"><label>说明</label><input id="qDesc" value="${esc(q.description || '')}"></div>
      <div class="field"><label>普通岗位通过线（分）</label><input id="qPass" type="number" min="1" max="100" value="${q.pass_score}"></div>
      <div class="field"><label>高风险岗位通过线（分）</label><input id="qHR" type="number" min="1" max="100" value="${q.high_risk_pass_score}"></div>
      <div class="field"><label>考试时长（分钟）</label><input id="qTime" type="number" value="${q.time_limit_minutes}"></div>
      <div class="field"><label>最小学时（秒，低于此值交卷将标记 too_fast）</label><input id="qMin" type="number" value="${q.min_duration_seconds || 0}"></div>
    </div>
  </div>
  <div class="panel"><h3>题目（单选，每题 10 分）</h3><div id="qEditor"></div>
    <button class="btn ghost small" id="addQ">+ 添加题目</button></div>
  <div class="flex" style="gap:10px"><button class="btn" id="saveBtn">${id ? '保存设置并发布新版本' : '创建并发布 v1'}</button>
    <a class="btn ghost" href="#/quizzes">取消</a></div>`);

  let questions = (q.questions || []).map((x) => ({ ...x, options: [...x.options] }));
  function renderEditor() {
    $('#qEditor').innerHTML = questions.map((item, i) => `<div class="q-item">
      <div class="flex" style="justify-content:space-between"><b>第 ${i + 1} 题</b><button class="btn small danger" data-del="${i}">删除</button></div>
      <div class="field mt8"><input data-k="q" data-i="${i}" value="${esc(item.q)}" placeholder="题干"></div>
      ${item.options.map((o, j) => `<div class="flex mt8"><label style="white-space:nowrap"><input type="radio" name="ans${i}" data-ans="${j}" data-i="${i}" ${item.answer === j ? 'checked' : ''}> 正确</label>
        <input style="flex:1" data-k="opt" data-i="${i}" data-j="${j}" value="${esc(o)}">
        <button class="btn small ghost" data-delopt="${i}-${j}">删项</button></div>`).join('')}
      <button class="btn small ghost mt8" data-addopt="${i}">+ 选项</button></div>`).join('');
    $('#qEditor').querySelectorAll('[data-k]').forEach((el) => {
      el.oninput = () => { const i = +el.dataset.i; questions[i][el.dataset.k] = el.value; };
    });
    $('#qEditor').querySelectorAll('[data-ans]').forEach((el) => {
      el.onchange = () => { questions[+el.dataset.i].answer = +el.dataset.ans; };
    });
    $('#qEditor').querySelectorAll('[data-addopt]').forEach((b) => (b.onclick = () => {
      questions[+b.dataset.addopt].options.push('新选项'); renderEditor();
    }));
    $('#qEditor').querySelectorAll('[data-delopt]').forEach((b) => {
      b.onclick = () => { const [i, j] = b.dataset.delopt.split('-').map(Number);
        const qq = questions[i]; qq.options.splice(j, 1);
        if (qq.answer === j) qq.answer = null; else if (qq.answer > j) qq.answer -= 1;
        renderEditor(); };
    });
    $('#qEditor').querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { questions.splice(+b.dataset.del, 1); renderEditor(); }));
  }
  renderEditor();
  $('#addQ').onclick = () => { questions.push({ q: '', options: ['', ''], answer: null }); renderEditor(); };

  $('#saveBtn').onclick = async () => {
    const body = {
      title: $('#qTitle').value.trim(), category: $('#qCat').value, description: $('#qDesc').value,
      pass_score: +$('#qPass').value, high_risk_pass_score: +$('#qHR').value,
      time_limit_minutes: +$('#qTime').value, min_duration_seconds: +$('#qMin').value,
      questions,
    };
    if (!body.title) return toast('请填写标题', 'error');
    if (!questions.length) return toast('请至少添加一道题', 'error');
    if (questions.some((x) => !x.q.trim() || x.answer == null || x.options.some((o) => !o.trim())))
      return toast('存在题干/选项为空或未设置正确答案的题', 'error');
    try {
      if (id) {
        await api(`/quizzes/${id}`, { method: 'PUT', body: {
          title: body.title, category: body.category, description: body.description,
          pass_score: body.pass_score, high_risk_pass_score: body.high_risk_pass_score,
          time_limit_minutes: body.time_limit_minutes, min_duration_seconds: body.min_duration_seconds } });
        await api(`/quizzes/${id}/publish`, { method: 'POST', body: { questions } });
        toast('新版本已发布（历史证据不受影响）', 'ok');
      } else {
        await api('/quizzes', { method: 'POST', body });
        toast('测验已创建并发布 v1', 'ok');
      }
      go('/quizzes');
    } catch (e) { toast(e.message, 'error'); }
  };
}

/* ================= 证据链校验 ================= */
async function pageVerifyChain() {
  setMain(pageHead('证据链完整性校验', '双哈希链（学习证据链 + 审计日志链）与状态一致性；建议审计部门定期校验。') + '<div id="vc" class="panel">校验中…</div>');
  const r = await api('/verify/chains');
  const row = (t, c) => `<tr><td>${t}</td><td>${c.ok ? '<b class="chain-ok">✓ 完整</b>' : '<b class="chain-bad">✗ 断裂</b>'}</td>
    <td>${c.count} 条记录</td><td class="mono" style="font-size:10.5px">${c.head || ''}</td>
    <td>${c.brokenAt ? '断裂点 #' + c.brokenAt + '：' + esc(c.reason) : '—'}</td></tr>`;
  $('#vc').innerHTML = `
    <div class="cards"><div class="stat ${r.consistent ? 'ok' : 'bad'}">
      <div class="num" style="font-size:20px">${r.consistent ? '全部一致 ✓' : '发现异常 ✗'}</div><div class="lbl">${r.checked_at ? fmt(r.checked_at) : ''}</div></div></div>
    <table><thead><tr><th>链</th><th>结果</th><th>规模</th><th>链头哈希</th><th>问题</th></tr></thead><tbody>
      ${row('学习证据事件链', r.evidence_chain)}${row('审计日志链', r.audit_chain)}</tbody></table>
    <div class="mt16"><h3>状态表 vs 证据事件一致性</h3>
    ${r.state_vs_evidence_mismatches.length ? `<table><thead><tr><th>考试记录</th><th>异常</th></tr></thead><tbody>
      ${r.state_vs_evidence_mismatches.map((m) => `<tr><td>#${String(m.attempt_id).padStart(5, '0')}</td><td class="chain-bad">${esc(m.issue)}</td></tr>`).join('')}</tbody></table>`
      : '<p class="chain-ok">✓ 分数、通过标记、用时与签署状态均与不可变证据事件一致，无后台篡改。</p>'}
    </div>
    <div class="muted mt16">${esc(r.note)}</div>`;
}

/* ================= 审计日志 ================= */
async function pageAudit() {
  setMain(pageHead('审计日志', '登录、出题发布、开考、交卷、签署、人员变更等全部操作均写入只增哈希链。') +
    `<div class="filter-bar"><select id="aAction"><option value="">全部动作</option>
      ${['LOGIN_SUCCESS','LOGIN_FAILED','LOGOUT','QUIZ_CREATE','QUIZ_UPDATE','QUIZ_PUBLISH_VERSION','ASSIGNMENT_CREATE','ATTEMPT_START','ATTEMPT_SUBMIT','ATTEMPT_SIGN','USER_CREATE','USER_UPDATE'].map((a) => `<option>${a}</option>`).join('')}
    </select><button class="btn small" id="aBtn">查询</button></div><div id="aList" class="panel">加载中…</div>`);
  async function load() {
    const p = new URLSearchParams(); if ($('#aAction').value) p.set('action', $('#aAction').value);
    const rows = await api('/audit/logs?' + p);
    $('#aList').innerHTML = `<table><thead><tr><th>#</th><th>时间(北京)</th><th>操作人</th><th>动作</th><th>对象</th><th>详情</th><th>IP</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${r.id}</td><td>${fmt(r.created_at)}</td><td>${esc(r.actor_name || '—')}</td>
        <td><span class="badge in_progress">${esc(r.action)}</span></td><td>${esc(r.entity)}${r.entity_id ? ' #' + esc(r.entity_id) : ''}</td>
        <td class="mono" style="font-size:10.5px;max-width:380px;overflow:hidden;text-overflow:ellipsis">${esc(r.detail_json || '')}</td>
        <td>${esc(r.ip_address || '')}</td></tr>`).join('')}</tbody></table>`;
  }
  $('#aBtn').onclick = load;
  load();
}

/* ================= 公开验真页 ================= */
async function pageVerifyPublic() {
  const code = new URLSearchParams(location.hash.split('?')[1] || '').get('code') || '';
  setMain(`<div style="max-width:760px;margin:0 auto">
    <div class="verify-hero"><h1>学习凭证公开验真</h1>
      <div style="opacity:.85;font-size:13px">输入电子凭证上的"验真码"（签署事件哈希），核验"谁、在什么时候、学习并签署了哪一版测验"</div>
      <div class="code-box"><input id="vCode" placeholder="粘贴 64 位哈希码" value="${esc(code)}"><button class="btn" id="vBtn" style="background:#fff;color:var(--primary)">验 真</button></div>
    </div><div id="vResult"></div></div>`);
  async function run() {
    const h = $('#vCode').value.trim();
    if (!h) return;
    $('#vResult').innerHTML = '<div class="panel muted">核验中…</div>';
    const res = await fetch('/api/verify/code/' + encodeURIComponent(h));
    const r = await res.json();
    if (!res.ok || !r.valid) {
      $('#vResult').innerHTML = `<div class="panel" style="border-color:var(--red)"><h3 class="chain-bad">✗ ${esc(r.message || '验真失败')}</h3></div>`;
      return;
    }
    $('#vResult').innerHTML = `<div class="panel verify-result" style="border-color:var(--green)">
      <h3 class="chain-ok">✓ 凭证真实有效，记录存在于证据哈希链上</h3>
      <dl class="kv mt16">
        <dt>学习者</dt><dd><b>${esc(r.learner.full_name)}</b>（${esc(r.learner.department)} · ${esc(r.learner.position)}${r.learner.high_risk ? ' · 高风险岗位' : ''}）</dd>
        <dt>测验</dt><dd>${esc(r.quiz.title)}（${esc(r.quiz.category)} · ${r.quiz.version}）</dd>
        <dt>事件</dt><dd>${({ started: '开考', submitted: '交卷评分', signed: '电子签署学习确认' })[r.event_type]}</dd>
        <dt>事件时间</dt><dd>${fmt(r.event_occurred_at)}</dd>
        <dt>成绩</dt><dd>${r.score} 分（要求 ${r.pass_threshold} 分，${r.passed ? '通过' : '未通过'}）</dd>
        <dt>签署时间</dt><dd>${r.signed_at ? fmt(r.signed_at) : '—'}</dd>
        <dt>电子签名</dt><dd>${esc(r.signature_name || '—')}</dd>
      </dl></div>`;
  }
  $('#vBtn').onclick = run;
  $('#vCode').onkeydown = (e) => e.key === 'Enter' && run();
  if (code) run();
}

/* ================= 用户与岗位管理 ================= */
async function pageUsers() {
  setMain(pageHead('用户与岗位管理', '高风险岗位（采购、资金、数据等）员工将适用更高通过分数线。',
    '<button class="btn" id="addUserBtn">+ 新增用户</button>') + '<div class="panel" id="uBox">加载中…</div>');
  const users = await api('/admin/users');
  $('#uBox').innerHTML = `<table><thead><tr><th>账号</th><th>姓名</th><th>部门</th><th>岗位</th><th>角色</th><th>高风险</th><th>状态</th><th>操作</th></tr></thead><tbody>
    ${users.map((u) => `<tr><td>${esc(u.username)}</td><td>${esc(u.full_name)}</td><td>${esc(u.department)}</td><td>${esc(u.position)}</td>
      <td>${roleName[u.role]}</td>
      <td><label class="switch"><input type="checkbox" data-hr="${u.id}" ${u.high_risk ? 'checked' : ''}> 高风险</label></td>
      <td>${u.active ? '<span class="badge pass">在职</span>' : '<span class="badge not_started">停用</span>'}</td>
      <td><button class="btn small ghost" data-edit="${u.id}">编辑</button></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-hr]').forEach((cb) => (cb.onchange = async () => {
    try { await api('/admin/users/' + cb.dataset.hr, { method: 'PUT', body: { high_risk: cb.checked } }); toast('高风险标记已更新', 'ok'); }
    catch (e) { toast(e.message, 'error'); cb.checked = !cb.checked; }
  }));
  document.querySelectorAll('[data-edit]').forEach((b) => {
    const u = users.find((x) => x.id === +b.dataset.edit);
    b.onclick = () => showModal(`编辑用户：${u.full_name}`, `
      <div class="field"><label>姓名</label><input id="euName" value="${esc(u.full_name)}"></div>
      <div class="field"><label>部门</label><input id="euDept" value="${esc(u.department)}"></div>
      <div class="field"><label>岗位</label><input id="euPos" value="${esc(u.position)}"></div>
      <div class="field"><label>角色</label><select id="euRole">
        ${['employee', 'legal', 'audit', 'admin'].map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${roleName[r]}</option>`).join('')}</select></div>
      <div class="field"><label>重置密码（留空则不修改）</label><input id="euPass" type="password"></div>
      <div class="field"><label><input type="checkbox" id="euActive" ${u.active ? 'checked' : ''}> 账号启用</label></div>
      <div class="row"><button class="btn ghost" id="mCancel">取消</button><button class="btn" id="mOk">保存</button></div>`,
      async () => {
        const body = { full_name: $('#euName').value, department: $('#euDept').value, position: $('#euPos').value, role: $('#euRole').value, active: $('#euActive').checked };
        if ($('#euPass').value) body.password = $('#euPass').value;
        await api('/admin/users/' + u.id, { method: 'PUT', body });
        toast('已保存', 'ok'); closeModal(); pageUsers();
      });
  });
  $('#addUserBtn').onclick = () => showModal('新增用户', `
    <div class="field"><label>账号</label><input id="nuUser"></div>
    <div class="field"><label>初始密码</label><input id="nuPass" type="password"></div>
    <div class="field"><label>姓名</label><input id="nuName"></div>
    <div class="field"><label>部门</label><input id="nuDept" placeholder="如 采购部"></div>
    <div class="field"><label>岗位</label><input id="nuPos" placeholder="如 采购专员"></div>
    <div class="field"><label>角色</label><select id="nuRole">${Object.entries(roleName).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
    <div class="field"><label><input type="checkbox" id="nuHR"> 高风险岗位（适用 90 分线）</label></div>
    <div class="row"><button class="btn ghost" id="mCancel">取消</button><button class="btn" id="mOk">创建</button></div>`,
    async () => {
      await api('/admin/users', { method: 'POST', body: {
        username: $('#nuUser').value.trim(), password: $('#nuPass').value, full_name: $('#nuName').value.trim(),
        department: $('#nuDept').value.trim(), position: $('#nuPos').value.trim(),
        role: $('#nuRole').value, high_risk: $('#nuHR').checked } });
      toast('用户已创建', 'ok'); closeModal(); pageUsers();
    });
}

/* ================= 通用弹窗 ================= */
function showModal(title, html, onOk) {
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.id = 'gModal';
  mask.innerHTML = `<div class="modal"><h3>${title}</h3>${html}</div>`;
  document.body.appendChild(mask);
  mask.addEventListener('click', (e) => { if (e.target === mask) closeModal(); });
  const cancel = mask.querySelector('#mCancel');
  if (cancel) cancel.onclick = closeModal;
  const ok = mask.querySelector('#mOk');
  if (ok && onOk) ok.onclick = async () => { try { await onOk(); } catch (e) { toast(e.message, 'error'); } };
}
function closeModal() { const m = $('#gModal'); if (m) m.remove(); }

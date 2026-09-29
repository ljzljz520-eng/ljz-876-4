const express = require('express');
const db = require('../db');
const { verifyChain } = require('../evidence');
const { requireAuth } = require('../auth');

const router = express.Router();

// 一致性检查：attempts 状态表必须与追加式证据事件载荷一致
function consistencyCheck() {
  const attempts = db.prepare('SELECT * FROM attempts ORDER BY id').all();
  const mismatches = [];
  for (const a of attempts) {
    const evs = db.prepare('SELECT * FROM attempt_events WHERE attempt_id=? ORDER BY id').all(a.id);
    if (!evs.some((e) => e.event_type === 'started'))
      mismatches.push({ attempt_id: a.id, issue: '缺少 started 证据事件' });
    const sub = evs.find((e) => e.event_type === 'submitted');
    if (a.status !== 'in_progress' && !sub) {
      mismatches.push({ attempt_id: a.id, issue: '状态已交卷但缺少 submitted 证据事件' });
    }
    if (sub) {
      const p = JSON.parse(sub.payload_json);
      if (p.score !== a.score)
        mismatches.push({ attempt_id: a.id, issue: `分数不一致：状态表=${a.score}，证据事件=${p.score}` });
      if (!!p.passed !== !!a.passed)
        mismatches.push({ attempt_id: a.id, issue: '通过标记与证据事件不一致' });
      if (p.duration_seconds !== a.duration_seconds)
        mismatches.push({ attempt_id: a.id, issue: '作答用时与证据事件不一致' });
    }
    const sig = evs.find((e) => e.event_type === 'signed');
    if (a.status === 'signed' && !sig)
      mismatches.push({ attempt_id: a.id, issue: '状态已签署但缺少 signed 证据事件' });
    if (sig && a.status !== 'signed')
      mismatches.push({ attempt_id: a.id, issue: '存在签署事件但状态未签署' });
  }
  return mismatches;
}

router.get('/chains', requireAuth(['admin', 'legal', 'audit']), (req, res) => {
  const events = verifyChain('attempt_events');
  const auditChain = verifyChain('audit_logs');
  const mismatches = consistencyCheck();
  res.json({
    evidence_chain: events,
    audit_chain: auditChain,
    state_vs_evidence_mismatches: mismatches,
    consistent: mismatches.length === 0 && events.ok && auditChain.ok,
    checked_at: new Date().toISOString(),
    note: '追加式双哈希链 + 状态一致性校验：改写分数/状态、删除或插入事件均会在此暴露。',
  });
});

// 公开验真
router.get('/code/:hash', (req, res) => {
  const h = String(req.params.hash || '').toLowerCase();
  const ev = db.prepare('SELECT * FROM attempt_events WHERE lower(record_hash)=?').get(h);
  if (!ev) {
    return res.status(404).json({
      valid: false,
      message: '验真失败：未找到对应记录。该凭证可能不存在，或证据库曾被篡改。',
    });
  }
  const a = db
    .prepare(
      `SELECT a.*, q.title AS quiz_title, q.category AS quiz_category,
              u.full_name, u.department, u.position, u.high_risk, u.username
       FROM attempts a JOIN users u ON u.id=a.user_id JOIN quizzes q ON q.id=a.quiz_id
       WHERE a.id=?`
    )
    .get(ev.attempt_id);
  res.json({
    valid: true,
    event_type: ev.event_type,
    event_occurred_at: ev.occurred_at,
    learner: { full_name: a.full_name, department: a.department, position: a.position, high_risk: !!a.high_risk },
    quiz: { title: a.quiz_title, category: a.quiz_category, version: 'v' + a.version_number },
    score: a.score, pass_threshold: a.pass_threshold, passed: !!a.passed,
    signed_at: a.signed_at, signature_name: a.signature_name,
    on_chain: true,
  });
});

module.exports = router;

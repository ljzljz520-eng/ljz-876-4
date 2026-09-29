const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
const STAFF = ['admin', 'legal', 'audit'];

function eligibleUserIds(quizId) {
  const assigns = db.prepare('SELECT * FROM assignments WHERE quiz_id=?').all(quizId);
  if (!assigns.length) return new Set(db.prepare('SELECT id FROM users WHERE active=1').all().map((u) => u.id));
  const ids = new Set();
  for (const a of assigns) {
    if (a.scope === 'all') {
      db.prepare('SELECT id FROM users WHERE active=1').all().forEach((u) => ids.add(u.id));
    } else if (a.scope === 'department') {
      db.prepare('SELECT id FROM users WHERE active=1 AND department=?').all(a.scope_value).forEach((u) => ids.add(u.id));
    } else if (a.scope === 'positions') {
      const vals = a.scope_value.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      if (vals.length) {
        const placeholders = vals.map(() => '?').join(',');
        db.prepare(`SELECT id FROM users WHERE active=1 AND position IN (${placeholders})`).all(...vals)
          .forEach((u) => ids.add(u.id));
      }
    } else if (a.scope === 'users') {
      const vals = a.scope_value.split(/[,，]/).map((s) => parseInt(s.trim(), 10)).filter(Number.isInteger);
      vals.forEach((id) => ids.add(id));
    }
  }
  return ids;
}

function personStatus(userId, quizId) {
  const attempts = db.prepare('SELECT * FROM attempts WHERE user_id=? AND quiz_id=? ORDER BY id').all(userId, quizId);
  if (!attempts.length) return { state: 'not_started', attempt_count: 0 };
  const signed = attempts.filter((a) => a.status === 'signed');
  const best = Math.max(...attempts.map((a) => a.score ?? 0));
  const latest = attempts[attempts.length - 1];
  if (signed.length) {
    const s = signed[signed.length - 1];
    return { state: 'signed', attempt_count: attempts.length, best_score: best, signed_at: s.signed_at, score: s.score, attempt_id: s.id };
  }
  if (latest.status === 'in_progress')
    return { state: 'in_progress', attempt_count: attempts.length, best_score: best, attempt_id: latest.id };
  return { state: 'submitted_unsigned', attempt_count: attempts.length, best_score: best, passed: !!latest.passed, score: latest.score, attempt_id: latest.id };
}

// 汇总看板：逐测验 + 逐状态人数（而不是只给通过人数）
router.get('/summary', requireAuth(STAFF), (req, res) => {
  const quizzes = db.prepare('SELECT * FROM quizzes ORDER BY id').all();
  const result = quizzes.map((q) => {
    const ids = [...eligibleUserIds(q.id)];
    const buckets = { signed: 0, submitted_unsigned: 0, in_progress: 0, not_started: 0 };
    const people = ids.map((uid) => {
      const u = db.prepare('SELECT id,full_name,department,position,high_risk FROM users WHERE id=?').get(uid);
      const st = personStatus(uid, q.id);
      buckets[st.state] += 1;
      return { ...u, ...st };
    });
    const highRiskPending = people.filter((p) => p.high_risk && p.state !== 'signed').length;
    return {
      quiz_id: q.id, title: q.title, category: q.category,
      version: q.current_version, published: !!q.published,
      pass_score: q.pass_score, high_risk_pass_score: q.high_risk_pass_score,
      eligible: ids.length, ...buckets, high_risk_pending: highRiskPending, people,
    };
  });
  res.json({ quizzes: result });
});

// 员工首页：我的待办与完成状态
router.get('/mine', requireAuth(), (req, res) => {
  const quizzes = db.prepare('SELECT * FROM quizzes WHERE published=1 ORDER BY id').all();
  const items = quizzes.map((q) => {
    const st = personStatus(req.user.id, q.id);
    const threshold = req.user.high_risk ? q.high_risk_pass_score : q.pass_score;
    return {
      quiz_id: q.id, title: q.title, category: q.category, version: q.current_version,
      pass_score: q.pass_score, high_risk_pass_score: q.high_risk_pass_score,
      my_threshold: threshold, ...st,
    };
  });
  res.json({ high_risk: !!req.user.high_risk, items });
});

module.exports = router;
module.exports.eligibleUserIds = eligibleUserIds;
module.exports.personStatus = personStatus;

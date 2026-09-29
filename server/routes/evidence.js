const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
const STAFF = ['admin', 'legal', 'audit'];

function getAttemptOrDie(req, res) {
  const a = db
    .prepare(
      `SELECT a.*, q.title AS quiz_title, q.category AS quiz_category,
              u.username, u.full_name, u.department, u.position, u.high_risk
       FROM attempts a JOIN quizzes q ON q.id=a.quiz_id JOIN users u ON u.id=a.user_id
       WHERE a.id=?`
    )
    .get(req.params.id);
  if (!a) { res.status(404).json({ error: '记录不存在' }); return null; }
  const staff = STAFF.includes(req.user.role);
  if (!staff && a.user_id !== req.user.id) { res.status(403).json({ error: '无权访问该证据' }); return null; }
  return a;
}

function buildEvidence(attempt) {
  const events = db.prepare('SELECT * FROM attempt_events WHERE attempt_id=? ORDER BY id').all(attempt);
  const questions = JSON.parse(db.prepare('SELECT questions_snapshot FROM attempts WHERE id=?').get(attempt).questions_snapshot);
  const answersRow = db.prepare('SELECT answers_json FROM attempts WHERE id=?').get(attempt);
  const answers = answersRow.answers_json ? JSON.parse(answersRow.answers_json) : null;
  const started = events.find((e) => e.event_type === 'started');
  const submitted = events.find((e) => e.event_type === 'submitted');
  const signed = events.find((e) => e.event_type === 'signed');
  const a = db.prepare('SELECT * FROM attempts WHERE id=?').get(attempt);
  const u = db.prepare('SELECT full_name,department,position,high_risk,username FROM users WHERE id=?').get(a.user_id);
  const q = db.prepare('SELECT title,category FROM quizzes WHERE id=?').get(a.quiz_id);
  return {
    evidence_id: `EV-${String(attempt).padStart(6, '0')}`,
    generated_at: new Date().toISOString(),
    attempt: {
      id: a.id, user: u, quiz: q, version_number: a.version_number,
        score: a.score, pass_threshold: a.pass_threshold, high_risk_required: !!a.high_risk_required,
        passed: !!a.passed, status: a.status,
        started_at: a.started_at, submitted_at: a.submitted_at, signed_at: a.signed_at,
        duration_seconds: a.duration_seconds,
        signature_name: a.signature_name, client_fingerprint: a.client_fingerprint,
        ip_address: a.ip_address, user_agent: a.user_agent,
        questions: questions.map((qq, i) => ({
          q: qq.q, options: qq.options, correct_answer: qq.answer,
          given_answer: answers ? answers[i] : null,
        })),
    },
    events: events.map((e) => ({
      seq: e.id, event_type: e.event_type, occurred_at: e.occurred_at,
      ip_address: e.ip_address, user_agent: e.user_agent,
      payload: e.payload_json ? JSON.parse(e.payload_json) : null,
      prev_hash: e.prev_hash, record_hash: e.record_hash,
    })),
    anchors: {
      started_event_hash: started?.record_hash || null,
      submitted_event_hash: submitted?.record_hash || null,
      signed_event_hash: signed?.record_hash || null,
    },
    verification_url: `/verify/${signed?.record_hash || started?.record_hash || ''}`,
  };
}

// 证据包（JSON）
router.get('/attempt/:id', requireAuth(), (req, res) => {
  const a = getAttemptOrDie(req, res);
  if (!a) return;
  res.json(buildEvidence(a.id));
});

// 导出 JSON / CSV
router.get('/attempt/:id/export', requireAuth(), (req, res) => {
  const a = getAttemptOrDie(req, res);
  if (!a) return;
  const ev = buildEvidence(a.id);
  const format = (req.query.format || 'json').toLowerCase();

  if (format === 'json') {
    res.setHeader('Content-Disposition', `attachment; filename="evidence-${ev.evidence_id}.json"`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(JSON.stringify(ev, null, 2));
  }

  const csvEscape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const rows = [
    ['证据编号', ev.evidence_id],
    ['员工账号', ev.attempt.user.username],
    ['员工姓名', ev.attempt.user.full_name],
    ['部门', ev.attempt.user.department],
    ['岗位', ev.attempt.user.position],
    ['是否高风险岗位', ev.attempt.user.high_risk ? '是' : '否'],
    ['测验名称', ev.attempt.quiz.title],
    ['测验分类', ev.attempt.quiz.category],
    ['试题版本', 'v' + ev.attempt.version_number],
    ['得分', ev.attempt.score ?? ''],
    ['适用通过分数线', ev.attempt.pass_threshold],
    ['是否通过', ev.attempt.score === null ? '' : ev.attempt.passed ? '通过' : '未通过'],
    ['开考时间(UTC)', ev.attempt.started_at],
    ['交卷时间(UTC)', ev.attempt.submitted_at || ''],
    ['签署时间(UTC)', ev.attempt.signed_at || ''],
    ['作答用时(秒)', ev.attempt.duration_seconds ?? ''],
    ['电子签名', ev.attempt.signature_name || ''],
    ['客户端IP', ev.attempt.ip_address || ''],
    ['客户端标识(User-Agent)', ev.attempt.user_agent || ''],
    ['设备指纹', ev.attempt.client_fingerprint || ''],
    ['开考事件哈希', ev.anchors.started_event_hash || ''],
    ['交卷事件哈希', ev.anchors.submitted_event_hash || ''],
    ['签署事件哈希(验真码)', ev.anchors.signed_event_hash || ''],
  ];
  let csv = '﻿字段,值\n' + rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`).join('\n');
  csv += '\n\n序号,事件,发生时间(UTC),IP,记录哈希,前序哈希\n';
  csv += ev.events
    .map((e) => [e.seq, e.event_type, e.occurred_at, e.ip_address || '', e.record_hash, e.prev_hash].map(csvEscape).join(','))
    .join('\n');
  res.setHeader('Content-Disposition', `attachment; filename="evidence-${ev.evidence_id}.csv"`);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.send(csv);
});

// 证据清单（管理）
router.get('/list', requireAuth(STAFF), (req, res) => {
  const { quiz_id, user_id, status, department } = req.query;
  const where = [];
  const params = [];
  if (quiz_id) { where.push('a.quiz_id=?'); params.push(quiz_id); }
  if (user_id) { where.push('a.user_id=?'); params.push(user_id); }
  if (status) { where.push('a.status=?'); params.push(status); }
  if (department) { where.push('u.department=?'); params.push(department); }
  const sql = `
    SELECT a.id,a.user_id,a.quiz_id,a.version_number,a.score,a.pass_threshold,a.high_risk_required,
           a.passed,a.status,a.started_at,a.submitted_at,a.signed_at,a.duration_seconds,
           a.signature_name,a.ip_address,
           u.full_name,u.department,u.position,u.high_risk,
           q.title AS quiz_title,q.category AS quiz_category
    FROM attempts a JOIN users u ON u.id=a.user_id JOIN quizzes q ON q.id=a.quiz_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY a.id DESC LIMIT 500`;
  res.json(db.prepare(sql).all(...params));
});

module.exports = router;
module.exports.buildEvidence = buildEvidence;

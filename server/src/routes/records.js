const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { authRequired, rolesAllowed, getClientIp, audit } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// 开始测验（创建进行中的记录）
router.post('/start', (req, res) => {
  const { quiz_id } = req.body;
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quiz_id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  if (quiz.status !== 'published') return res.status(400).json({ error: '测验未发布' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);

  // 检查是否有已签署的记录（已完成则不允许重考，除非是高风险未达标）
  const signed = db.prepare("SELECT * FROM quiz_records WHERE quiz_id = ? AND user_id = ? AND status = 'signed' ORDER BY id DESC LIMIT 1").get(quiz_id, req.user.id);
  if (signed) {
    return res.status(400).json({ error: '您已完成并签署该测验，学习记录已归档，无需重复作答' });
  }
  // 检查是否有进行中的记录
  const inProgress = db.prepare("SELECT * FROM quiz_records WHERE quiz_id = ? AND user_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1").get(quiz_id, req.user.id);
  if (inProgress) {
    return res.json({ record_id: inProgress.id, resume: true, message: '继续上次作答' });
  }

  const attemptRow = db.prepare('SELECT COUNT(*) AS c FROM quiz_records WHERE quiz_id = ? AND user_id = ?').get(quiz_id, req.user.id);
  const result = db.prepare(
    `INSERT INTO quiz_records (user_id, quiz_id, status, attempt_no, ip_address, user_agent)
     VALUES (?, ?, 'in_progress', ?, ?, ?)`
  ).run(req.user.id, quiz_id, attemptRow.c + 1, getClientIp(req), req.headers['user-agent'] || 'unknown');
  audit(db, { userId: req.user.id, action: 'start_quiz', targetType: 'quiz', targetId: quiz_id, detail: `开始测验《${quiz.title}》`, ip: getClientIp(req) });
  res.json({ record_id: result.lastInsertRowid, resume: false });
});

// 提交答案并评分
router.post('/:id/submit', (req, res) => {
  const record = db.prepare('SELECT * FROM quiz_records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: '记录不存在' });
  if (record.user_id !== req.user.id && !['admin', 'legal', 'audit'].includes(req.user.role)) {
    return res.status(403).json({ error: '无权操作此记录' });
  }
  if (record.status === 'signed') return res.status(400).json({ error: '该记录已签署，不可修改' });

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(record.quiz_id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(record.user_id);
  const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC').all(quiz.id);
  const answers = req.body.answers || {};

  let score = 0;
  let totalScore = 0;
  const graded = questions.map(q => {
    const correct = JSON.parse(q.correct_answer);
    const userAns = answers[q.id] ?? answers[String(q.id)] ?? [];
    const userArr = Array.isArray(userAns) ? userAns : [userAns];
    totalScore += q.score;
    let isCorrect = false;
    if (q.type === 'single' || q.type === 'judge') {
      isCorrect = userArr.length === 1 && String(userArr[0]) === String(correct[0]);
    } else if (q.type === 'multiple') {
      const a = [...userArr].map(String).sort().join(',');
      const b = [...correct].map(String).sort().join(',');
      isCorrect = a === b;
    }
    if (isCorrect) score += q.score;
    return { question_id: q.id, type: q.type, content: q.content, options: JSON.parse(q.options), correct_answer: correct, user_answer: userArr, is_correct: isCorrect, score: q.score };
  });

  const scorePercent = totalScore > 0 ? Math.round((score / totalScore) * 1000) / 10 : 0;
  const passed = scorePercent >= quiz.passing_score;
  const highRiskPassed = user.is_high_risk ? scorePercent >= quiz.high_risk_required_score : true;
  const now = new Date();
  const started = new Date(record.started_at.replace(' ', 'T'));
  const duration = Math.max(1, Math.round((now - started) / 1000));

  db.prepare(
    `UPDATE quiz_records SET score = ?, total_score = ?, passed = ?, high_risk_passed = ?, status = 'completed',
     answers = ?, completed_at = datetime('now', 'localtime'), duration_seconds = ? WHERE id = ?`
  ).run(scorePercent, totalScore, passed ? 1 : 0, highRiskPassed ? 1 : 0, JSON.stringify(answers), duration, record.id);

  audit(db, { userId: req.user.id, action: 'submit_quiz', targetType: 'record', targetId: record.id, detail: `提交《${quiz.title}》得分 ${scorePercent} 分`, ip: getClientIp(req) });

  res.json({
    record_id: record.id,
    score: scorePercent,
    total_score: totalScore,
    passed,
    high_risk_passed: highRiskPassed,
    is_high_risk: !!user.is_high_risk,
    passing_score: quiz.passing_score,
    high_risk_required_score: quiz.high_risk_required_score,
    duration_seconds: duration,
    graded,
  });
});

// 签署学习确认（核心：电子签名 + 时间戳 + IP，形成不可篡改的证据）
router.post('/:id/sign', (req, res) => {
  const record = db.prepare('SELECT * FROM quiz_records WHERE id = ?').get(req.params.id);
  if (!record) return res.status(404).json({ error: '记录不存在' });
  if (record.user_id !== req.user.id) return res.status(403).json({ error: '只能签署本人的学习记录' });
  if (record.status !== 'completed') return res.status(400).json({ error: '请先完成测验再签署' });
  if (record.passed !== 1) return res.status(400).json({ error: '测验未通过，不能签署学习确认，请重新学习' });
  if (record.high_risk_passed !== 1) return res.status(400).json({ error: '您是高风险岗位，本次成绩未达到岗位要求的分数线，不能签署学习确认，请重新学习' });

  const { signed_name } = req.body;
  if (!signed_name || !signed_name.trim()) return res.status(400).json({ error: '请输入电子签名（本人姓名）' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (signed_name.trim() !== user.name) {
    return res.status(400).json({ error: '签名必须与本人真实姓名一致' });
  }

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(record.quiz_id);
  const confirmationText = `本人已认真学习《${quiz.title}》全部内容，理解并承诺遵守相关规定。本人确认以上学习过程真实有效，如有不实愿承担相应责任。`;
  const certificateNo = 'CER-' + new Date().getFullYear() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || 'unknown';

  db.prepare(
    `INSERT INTO signatures (record_id, user_id, signed_name, ip_address, user_agent, confirmation_text, certificate_no)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(record.id, req.user.id, signed_name.trim(), ip, ua, confirmationText, certificateNo);
  db.prepare("UPDATE quiz_records SET status = 'signed' WHERE id = ?").run(record.id);

  audit(db, { userId: req.user.id, action: 'sign_confirmation', targetType: 'record', targetId: record.id, detail: `签署《${quiz.title}》学习确认，证书号 ${certificateNo}`, ip });

  res.json({
    message: '学习确认签署成功',
    certificate_no: certificateNo,
    signed_at: new Date().toISOString(),
    confirmation_text: confirmationText,
  });
});

// 我的学习记录
router.get('/my', (req, res) => {
  const records = db.prepare(
    `SELECT r.*, q.title AS quiz_title, q.category, q.passing_score, q.high_risk_required_score,
     u.is_high_risk,
     s.signed_name, s.signed_at, s.certificate_no
     FROM quiz_records r
     JOIN quizzes q ON r.quiz_id = q.id
     JOIN users u ON r.user_id = u.id
     LEFT JOIN signatures s ON s.record_id = r.id
     WHERE r.user_id = ?
     ORDER BY r.started_at DESC`
  ).all(req.user.id).map(r => ({ ...r, is_high_risk: !!r.is_high_risk }));
  res.json(records);
});

// 全部学习记录（管理视角，可按部门/测验/状态筛选）
router.get('/', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const { quiz_id, department, status, keyword, high_risk } = req.query;
  let sql = `SELECT r.*, u.name, u.employee_no, u.department, u.position, u.is_high_risk,
     q.title AS quiz_title, q.category,
     s.signed_name, s.signed_at, s.certificate_no, s.ip_address AS sign_ip
     FROM quiz_records r
     JOIN users u ON r.user_id = u.id
     JOIN quizzes q ON r.quiz_id = q.id
     LEFT JOIN signatures s ON s.record_id = r.id
     WHERE 1=1`;
  const params = [];
  if (quiz_id) { sql += ' AND r.quiz_id = ?'; params.push(quiz_id); }
  if (department) { sql += ' AND u.department = ?'; params.push(department); }
  if (status) { sql += ' AND r.status = ?'; params.push(status); }
  if (high_risk !== undefined && high_risk !== '') { sql += ' AND u.is_high_risk = ?'; params.push(high_risk === 'true' ? 1 : 0); }
  if (keyword) { sql += ' AND (u.name LIKE ? OR u.employee_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  sql += ' ORDER BY r.started_at DESC';
  const records = db.prepare(sql).all(...params).map(r => ({ ...r, is_high_risk: !!r.is_high_risk }));
  res.json(records);
});

// 记录详情（含签署信息、答案明细）
router.get('/:id', (req, res) => {
  const record = db.prepare(
    `SELECT r.*, u.name, u.employee_no, u.department, u.position, u.is_high_risk,
     q.title AS quiz_title, q.category, q.passing_score, q.high_risk_required_score,
     s.signed_name, s.signed_at, s.ip_address AS sign_ip, s.user_agent AS sign_ua, s.confirmation_text, s.certificate_no
     FROM quiz_records r
     JOIN users u ON r.user_id = u.id
     JOIN quizzes q ON r.quiz_id = q.id
     LEFT JOIN signatures s ON s.record_id = r.id
     WHERE r.id = ?`
  ).get(req.params.id);
  if (!record) return res.status(404).json({ error: '记录不存在' });
  if (record.user_id !== req.user.id && !['admin', 'legal', 'audit'].includes(req.user.role)) {
    return res.status(403).json({ error: '无权查看此记录' });
  }
  const questions = db.prepare('SELECT id, type, content, options, correct_answer, score FROM questions WHERE quiz_id = ? ORDER BY sort_order ASC, id ASC').all(record.quiz_id);
  const answers = record.answers ? JSON.parse(record.answers) : {};
  const graded = questions.map(q => {
    const correct = JSON.parse(q.correct_answer);
    const userAns = answers[q.id] ?? answers[String(q.id)] ?? [];
    const userArr = Array.isArray(userAns) ? userAns : [userAns];
    let isCorrect = false;
    if (q.type === 'single' || q.type === 'judge') {
      isCorrect = userArr.length === 1 && String(userArr[0]) === String(correct[0]);
    } else if (q.type === 'multiple') {
      isCorrect = [...userArr].map(String).sort().join(',') === [...correct].map(String).sort().join(',');
    }
    return { ...q, options: JSON.parse(q.options), correct_answer: correct, user_answer: userArr, is_correct: isCorrect };
  });
  res.json({ ...record, is_high_risk: !!record.is_high_risk, questions: graded });
});

// 证书/学习证明
router.get('/:id/certificate', (req, res) => {
  const record = db.prepare(
    `SELECT r.*, u.name, u.employee_no, u.department, u.position, u.is_high_risk,
     q.title AS quiz_title, q.category,
     s.signed_name, s.signed_at, s.ip_address AS sign_ip, s.confirmation_text, s.certificate_no
     FROM quiz_records r
     JOIN users u ON r.user_id = u.id
     JOIN quizzes q ON r.quiz_id = q.id
     LEFT JOIN signatures s ON s.record_id = r.id
     WHERE r.id = ?`
  ).get(req.params.id);
  if (!record || record.status !== 'signed') return res.status(404).json({ error: '未找到已签署的学习证明' });
  if (record.user_id !== req.user.id && !['admin', 'legal', 'audit'].includes(req.user.role)) {
    return res.status(403).json({ error: '无权查看此证明' });
  }
  res.json({ ...record, is_high_risk: !!record.is_high_risk });
});

// 导出学习记录（CSV，作为书面证据）
router.get('/export/csv', rolesAllowed('admin', 'legal', 'audit'), (req, res) => {
  const { quiz_id, department } = req.query;
  let sql = `SELECT u.employee_no, u.name, u.department, u.position,
     CASE WHEN u.is_high_risk = 1 THEN '是' ELSE '否' END AS high_risk,
     q.title, q.category, r.score, r.total_score,
     CASE WHEN r.passed = 1 THEN '通过' ELSE '未通过' END AS result,
     r.started_at, r.completed_at, r.duration_seconds,
     s.signed_name, s.signed_at, s.ip_address AS sign_ip, s.certificate_no
     FROM quiz_records r
     JOIN users u ON r.user_id = u.id
     JOIN quizzes q ON r.quiz_id = q.id
     LEFT JOIN signatures s ON s.record_id = r.id
     WHERE r.status = 'signed'`;
  const params = [];
  if (quiz_id) { sql += ' AND r.quiz_id = ?'; params.push(quiz_id); }
  if (department) { sql += ' AND u.department = ?'; params.push(department); }
  sql += ' ORDER BY s.signed_at DESC';
  const rows = db.prepare(sql).all(...params);
  const columns = [
    { key: 'employee_no', label: '工号' },
    { key: 'name', label: '姓名' },
    { key: 'department', label: '部门' },
    { key: 'position', label: '岗位' },
    { key: 'high_risk', label: '高风险岗位' },
    { key: 'title', label: '测验名称' },
    { key: 'category', label: '分类' },
    { key: 'score', label: '得分' },
    { key: 'total_score', label: '总分' },
    { key: 'result', label: '结果' },
    { key: 'started_at', label: '开始时间' },
    { key: 'completed_at', label: '完成时间' },
    { key: 'duration_seconds', label: '用时(秒)' },
    { key: 'signed_name', label: '电子签名' },
    { key: 'signed_at', label: '签署时间' },
    { key: 'sign_ip', label: '签署IP' },
    { key: 'certificate_no', label: '证书编号' },
  ];
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    columns.map(c => escape(c.label)).join(','),
    ...rows.map(r => columns.map(c => escape(r[c.key])).join(',')),
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=learning-records-${Date.now()}.csv`);
  res.send('﻿' + csv);
});

module.exports = router;

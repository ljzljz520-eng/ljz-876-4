const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { audit } = require('../evidence');

const router = express.Router();
const STAFF = ['admin', 'legal', 'audit'];

function validateQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return '至少需要一道题';
  for (let i = 0; i < questions.length; i++) {
    const item = questions[i];
    if (!item || typeof item.q !== 'string' || !item.q.trim()) return `第 ${i + 1} 题题干为空`;
    if (!Array.isArray(item.options) || item.options.length < 2) return `第 ${i + 1} 题至少两个选项`;
    if (!item.options.every((o) => typeof o === 'string' && o.trim())) return `第 ${i + 1} 题选项不合法`;
    if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length)
      return `第 ${i + 1} 题正确答案未设置`;
  }
  return null;
}

const stripAnswers = (qs) => qs.map(({ answer, ...rest }) => rest);

// 列表
router.get('/', requireAuth(), (req, res) => {
  const isStaff = STAFF.includes(req.user.role);
  const rows = isStaff
    ? db.prepare('SELECT * FROM quizzes ORDER BY id DESC').all()
    : db.prepare('SELECT * FROM quizzes WHERE published=1 ORDER BY id DESC').all();
  res.json(rows);
});

// 详情：员工不返回正确答案与分值以外的答案字段
router.get('/:id', requireAuth(), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  const version = db
    .prepare('SELECT * FROM quiz_versions WHERE quiz_id=? ORDER BY version DESC LIMIT 1')
    .get(quiz.id);
  if (!version) return res.status(404).json({ error: '测验尚未发布任何版本' });
  if (!STAFF.includes(req.user.role) && !quiz.published) return res.status(403).json({ error: '测验未发布' });
  const questions = JSON.parse(version.questions_json);
  res.json({
    ...quiz,
    version_number: version.version,
    published_at: version.published_at,
    questions: STAFF.includes(req.user.role) ? questions : stripAnswers(questions),
  });
});

// 版本历史
router.get('/:id/versions', requireAuth(STAFF), (req, res) => {
  const versions = db
    .prepare(
      `SELECT v.id,v.version,v.question_count,v.points_total,v.published_at,v.published_by,
              u.full_name AS publisher_name
       FROM quiz_versions v LEFT JOIN users u ON u.id=v.published_by
       WHERE v.quiz_id=? ORDER BY v.version DESC`
    )
    .all(req.params.id);
  res.json(versions);
});

// 新建测验（可直接带题目，发布为 v1）
router.post('/', requireAuth(['admin', 'legal']), (req, res) => {
  const { title, category, description = '', pass_score = 80, high_risk_pass_score = 90,
    time_limit_minutes = 30, min_duration_seconds = 60, questions = [], publish = true } = req.body || {};
  if (!title || !category) return res.status(400).json({ error: '标题和分类必填' });
  const ps = parseInt(pass_score, 10);
  const hs = parseInt(high_risk_pass_score, 10);
  if (!(ps >= 1 && ps <= 100) || !(hs >= ps && hs <= 100))
    return res.status(400).json({ error: '分数线要求：1 ≤ 普通线 ≤ 高风险线 ≤ 100' });
  const err = validateQuestions(questions);
  if (publish && err) return res.status(400).json({ error: err });

  const quizId = db
    .prepare(
      `INSERT INTO quizzes (title,category,description,pass_score,high_risk_pass_score,time_limit_minutes,min_duration_seconds,published,current_version,created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`
    )
    .run(title, category, description, ps, hs, parseInt(time_limit_minutes, 10) || 30,
      parseInt(min_duration_seconds, 10) || 0, publish ? 1 : 0, publish ? 1 : 0, req.user.id).lastInsertRowid;

  if (publish) {
    const points = questions.length * 10;
    db.prepare(
      `INSERT INTO quiz_versions (quiz_id,version,questions_json,question_count,points_total,published_by)
       VALUES (?,?,?,?,?,?)`
    ).run(quizId, 1, JSON.stringify(questions), questions.length, points, req.user.id);
    db.prepare('INSERT INTO assignments (quiz_id,scope,scope_value,required,created_by) VALUES (?,\'all\',\'\',1,?)')
      .run(quizId, req.user.id);
  }
  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'QUIZ_CREATE', entity: 'quiz',
    entityId: quizId, detail: { title, category, publish }, ip: req.clientIp });
  res.json({ id: quizId });
});

// 更新元数据
router.put('/:id', requireAuth(['admin', 'legal']), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  const fields = ['title', 'category', 'description', 'pass_score', 'high_risk_pass_score',
    'time_limit_minutes', 'min_duration_seconds'];
  const sets = [];
  const vals = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) { sets.push(`${f}=?`); vals.push(req.body[f]); }
  }
  if (req.body.pass_score !== undefined || req.body.high_risk_pass_score !== undefined) {
    const ps = +(req.body.pass_score ?? quiz.pass_score);
    const hs = +(req.body.high_risk_pass_score ?? quiz.high_risk_pass_score);
    if (!(ps >= 1 && hs >= ps && hs <= 100)) return res.status(400).json({ error: '分数线不合法' });
  }
  if (!sets.length) return res.json({ ok: true });
  sets.push("updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')");
  vals.push(quiz.id);
  db.prepare(`UPDATE quizzes SET ${sets.join(',')} WHERE id=?`).run(...vals);
  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'QUIZ_UPDATE', entity: 'quiz',
    entityId: quiz.id, detail: { fields: Object.keys(req.body).filter((k) => fields.includes(k)) }, ip: req.clientIp });
  res.json({ ok: true });
});

// 发布新版本（题目变更固化，不影响历史考试证据）
router.post('/:id/publish', requireAuth(['admin', 'legal']), (req, res) => {
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(req.params.id);
  if (!quiz) return res.status(404).json({ error: '测验不存在' });
  const { questions } = req.body || {};
  const err = validateQuestions(questions);
  if (err) return res.status(400).json({ error: err });

  const nextVersion = quiz.current_version + 1;
  const points = questions.length * 10;
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO quiz_versions (quiz_id,version,questions_json,question_count,points_total,published_by)
       VALUES (?,?,?,?,?,?)`
    ).run(quiz.id, nextVersion, JSON.stringify(questions), questions.length, points, req.user.id);
    db.prepare('UPDATE quizzes SET current_version=?, published=1, updated_at=? WHERE id=?')
      .run(nextVersion, new Date().toISOString(), quiz.id);
  });
  tx();
  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'QUIZ_PUBLISH_VERSION', entity: 'quiz',
    entityId: quiz.id, detail: { version: nextVersion, questionCount: questions.length }, ip: req.clientIp });
  res.json({ version: nextVersion });
});

// 指派
router.get('/:id/assignments', requireAuth(STAFF), (req, res) => {
  const rows = db.prepare('SELECT * FROM assignments WHERE quiz_id=? ORDER BY id DESC').all(req.params.id);
  res.json(rows);
});
router.post('/:id/assignments', requireAuth(['admin', 'legal', 'audit']), (req, res) => {
  const { scope = 'all', scope_value = '', required = 1, due_date = null } = req.body || {};
  if (!['all', 'department', 'positions', 'users'].includes(scope))
    return res.status(400).json({ error: '指派范围不合法' });
  const info = db.prepare(
    `INSERT INTO assignments (quiz_id,scope,scope_value,required,due_date,created_by) VALUES (?,?,?,?,?,?)`
  ).run(req.params.id, scope, scope_value, required ? 1 : 0, due_date, req.user.id);
  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'ASSIGNMENT_CREATE', entity: 'quiz',
    entityId: req.params.id, detail: { scope, scope_value, required, due_date }, ip: req.clientIp });
  res.json({ id: info.lastInsertRowid });
});

module.exports = router;

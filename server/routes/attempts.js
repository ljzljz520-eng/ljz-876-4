const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { appendEvent, audit } = require('../evidence');

const router = express.Router();

function loadCurrentVersion(quizId) {
  return db
    .prepare('SELECT * FROM quiz_versions WHERE quiz_id=? ORDER BY version DESC LIMIT 1')
    .get(quizId);
}

// 1) 开始考试：服务器记录开考时刻、固化试题快照、记录 IP/UA/设备指纹
router.post('/start', requireAuth(['employee', 'admin', 'legal', 'audit']), (req, res) => {
  const { quiz_id, fingerprint } = req.body || {};
  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(quiz_id);
  if (!quiz || !quiz.published) return res.status(404).json({ error: '测验不存在或未发布' });
  const version = loadCurrentVersion(quiz.id);
  if (!version) return res.status(400).json({ error: '测验没有可考版本' });

  const questions = JSON.parse(version.questions_json);
  const startedAt = new Date().toISOString();
  const threshold = req.user.high_risk ? quiz.high_risk_pass_score : quiz.pass_score;

  const result = db.transaction(() => {
    const attemptId = db
      .prepare(
        `INSERT INTO attempts (user_id,quiz_id,version_id,version_number,questions_snapshot,points_total,
          pass_threshold,high_risk_required,status,started_at,client_fingerprint,ip_address,user_agent)
         VALUES (?,?,?,?,?,?,?,?, 'in_progress', ?, ?, ?, ?)`
      )
      .run(
        req.user.id, quiz.id, version.id, version.version, version.questions_json, version.points_total,
        threshold, req.user.high_risk ? 1 : 0, startedAt,
        typeof fingerprint === 'string' ? fingerprint.slice(0, 500) : null,
        req.clientIp, req.ua
      ).lastInsertRowid;

    appendEvent({
      attemptId, type: 'started', actorId: req.user.id,
      payload: {
        quiz_id: quiz.id, quiz_title: quiz.title, version: version.version,
        user_snapshot: {
          id: req.user.id, username: req.user.username, full_name: req.user.full_name,
          department: req.user.department, position: req.user.position, high_risk: !!req.user.high_risk,
        },
        pass_threshold: threshold, high_risk_required: !!req.user.high_risk,
      },
      ip: req.clientIp, ua: req.ua, at: startedAt,
    });
    return attemptId;
  })();

  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'ATTEMPT_START', entity: 'attempt',
    entityId: result, detail: { quiz_id: quiz.id, version: version.version }, ip: req.clientIp });

  // 返回给考生时剥离正确答案
  const stripped = questions.map(({ answer, ...rest }) => rest);
  res.json({
    attempt_id: result,
    version_number: version.version,
    time_limit_minutes: quiz.time_limit_minutes,
    started_at: startedAt,
    questions: stripped,
  });
});

// 2) 交卷：服务器评分，记录提交时刻、用时、IP/UA
router.post('/:id/submit', requireAuth(['employee', 'admin', 'legal', 'audit']), (req, res) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id);
  if (!attempt) return res.status(404).json({ error: '考试记录不存在' });
  if (attempt.user_id !== req.user.id) return res.status(403).json({ error: '只能提交本人的考试' });
  if (attempt.status !== 'in_progress') return res.status(400).json({ error: '该考试已交卷' });

  const answersRaw = (req.body || {}).answers;
  if (!Array.isArray(answersRaw)) return res.status(400).json({ error: '答案格式不合法' });

  const quiz = db.prepare('SELECT * FROM quizzes WHERE id=?').get(attempt.quiz_id);
  const questions = JSON.parse(attempt.questions_snapshot);
  const answers = questions.map((q, i) => {
    const v = answersRaw[i];
    return Number.isInteger(v) && v >= 0 && v < q.options.length ? v : null; // 未答/非法记 null（0 分）
  });

  let correct = 0;
  const grading = questions.map((q, i) => {
    const ok = answers[i] === q.answer;
    if (ok) correct += 1;
    return { index: i, given: answers[i], correct: q.answer, is_correct: ok };
  });
  const score = Math.round((correct / questions.length) * 100);
  const passed = score >= attempt.pass_threshold ? 1 : 0;
  const submittedAt = new Date().toISOString();
  const duration = Math.max(0, Math.round((new Date(submittedAt) - new Date(attempt.started_at)) / 1000));

  db.transaction(() => {
    db.prepare(
      `UPDATE attempts SET answers_json=?, score=?, passed=?, status='submitted',
         submitted_at=?, duration_seconds=? WHERE id=?`
    ).run(JSON.stringify(answers), score, passed, submittedAt, duration, attempt.id);

    appendEvent({
      attemptId: attempt.id, type: 'submitted', actorId: req.user.id, at: submittedAt,
      payload: {
        score, passed: !!passed, pass_threshold: attempt.pass_threshold,
        high_risk_required: !!attempt.high_risk_required, correct, total: questions.length,
        duration_seconds: duration, too_fast: quiz.min_duration_seconds > 0 && duration < quiz.min_duration_seconds,
        grading, answers,
      },
      ip: req.clientIp, ua: req.ua,
    });
  })();

  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'ATTEMPT_SUBMIT', entity: 'attempt',
    entityId: attempt.id, detail: { score, passed: !!passed, duration }, ip: req.clientIp });

  res.json({
    attempt_id: attempt.id, score, passed: !!passed,
    pass_threshold: attempt.pass_threshold, high_risk_required: !!attempt.high_risk_required,
    correct, total: questions.length, duration_seconds: duration,
    too_fast: quiz.min_duration_seconds > 0 && duration < quiz.min_duration_seconds,
    signable: passed === 1,
  });
});

// 3) 学习确认签署：未达岗位分数线禁止签署；固化签署声明与签署时刻
router.post('/:id/sign', requireAuth(['employee', 'admin', 'legal', 'audit']), (req, res) => {
  const attempt = db.prepare('SELECT * FROM attempts WHERE id=?').get(req.params.id);
  if (!attempt) return res.status(404).json({ error: '考试记录不存在' });
  if (attempt.user_id !== req.user.id) return res.status(403).json({ error: '只能签署本人的确认书' });
  if (attempt.status === 'in_progress') return res.status(400).json({ error: '请先完成考试并交卷' });
  if (attempt.status === 'signed') return res.status(400).json({ error: '已签署，请勿重复签署' });
  if (!attempt.passed) {
    return res.status(400).json({
      error: `分数 ${attempt.score} 未达到岗位要求分数线 ${attempt.pass_threshold}，请重新参加考试`,
    });
  }
  const { signature_name, signature_text } = req.body || {};
  if (!signature_name || !signature_text || String(signature_name).trim() !== req.user.full_name)
    return res.status(400).json({ error: '签署姓名须与本人姓名一致' });
  if (String(signature_text).trim() !== req.user.full_name)
    return res.status(400).json({ error: '请逐字输入本人姓名作为电子签名' });

  const signedAt = new Date().toISOString();
  const quiz = db.prepare('SELECT id FROM quizzes WHERE id=?').get(attempt.quiz_id);
  const declaration =
    '本人确认已完整学习上述合规材料并独立完成测验，已知晓相关红线与法律责任，承诺遵照执行。';

  db.transaction(() => {
    db.prepare(`UPDATE attempts SET status='signed', signed_at=?, signature_name=?, signature_text=? WHERE id=?`)
      .run(signedAt, String(signature_name).trim(), String(signature_text).trim(), attempt.id);
    appendEvent({
      attemptId: attempt.id, type: 'signed', actorId: req.user.id, at: signedAt,
      payload: {
        signature_name: String(signature_name).trim(),
        declaration,
        user_confirm: {
          department: req.user.department, position: req.user.position,
          high_risk: !!req.user.high_risk,
        },
      },
      ip: req.clientIp, ua: req.ua,
    });
  })();

  audit({ actorId: req.user.id, actorName: req.user.full_name, action: 'ATTEMPT_SIGN', entity: 'attempt',
    entityId: attempt.id, detail: { quiz_id: attempt.quiz_id, score: attempt.score }, ip: req.clientIp });

  res.json({ ok: true, signed_at: signedAt, declaration });
});

// 我的考试记录
router.get('/my', requireAuth(), (req, res) => {
  const rows = db
    .prepare(
      `SELECT a.*, q.title AS quiz_title, q.category AS quiz_category, q.pass_score, q.high_risk_pass_score
       FROM attempts a JOIN quizzes q ON q.id=a.quiz_id
       WHERE a.user_id=? ORDER BY a.id DESC`
    )
    .all(req.user.id);
  res.json(rows);
});

// 单次记录详情（本人或管理角色）
router.get('/:id', requireAuth(), (req, res) => {
  const attempt = db
    .prepare(
      `SELECT a.*, q.title AS quiz_title, q.category AS quiz_category, q.time_limit_minutes,
              u.full_name, u.department, u.position, u.high_risk
       FROM attempts a JOIN quizzes q ON q.id=a.quiz_id JOIN users u ON u.id=a.user_id
       WHERE a.id=?`
    )
    .get(req.params.id);
  if (!attempt) return res.status(404).json({ error: '记录不存在' });
  const staff = ['admin', 'legal', 'audit'].includes(req.user.role);
  if (!staff && attempt.user_id !== req.user.id) return res.status(403).json({ error: '无权查看' });

  const questions = JSON.parse(attempt.questions_snapshot);
  const answers = attempt.answers_json ? JSON.parse(attempt.answers_json) : null;
  const events = db.prepare('SELECT id,event_type,actor_id,occurred_at,payload_json,ip_address,user_agent,prev_hash,record_hash FROM attempt_events WHERE attempt_id=? ORDER BY id').all(attempt.id);

  const detail = {
    ...attempt,
    questions: questions.map((qq, i) => ({
      q: qq.q, options: qq.options,
      given: answers ? answers[i] : null,
      ...(staff || attempt.user_id === req.user.id ? { answer: qq.answer } : {}),
    })),
    answers,
    events,
  };
  res.json(detail);
});

module.exports = router;

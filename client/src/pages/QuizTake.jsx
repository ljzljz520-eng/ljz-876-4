import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function QuizTake() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [signed, setSigned] = useState(false);
  const [certificate, setCertificate] = useState(null);
  const [signedName, setSignedName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    api.quiz(id).then(async (q) => {
      setQuiz(q);
      const startRes = await api.startQuiz(q.id);
      setRecordId(startRes.record_id);
      if (q.time_limit > 0) setTimeLeft(q.time_limit * 60);
    }).catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (timeLeft === null || result) return;
    if (timeLeft <= 0) {
      handleSubmit();
      return;
    }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [timeLeft, result]);

  const handleAnswer = (qid, value, type) => {
    setAnswers(prev => {
      if (type === 'multiple') {
        const arr = prev[qid] || [];
        const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];
        return { ...prev, [qid]: next };
      }
      return { ...prev, [qid]: [value] };
    });
  };

  const handleSubmit = async () => {
    if (submitting || result) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await api.submitRecord(recordId, answers);
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSign = async () => {
    if (!signedName.trim()) { setError('请输入您的真实姓名作为电子签名'); return; }
    setError('');
    try {
      const res = await api.signRecord(recordId, signedName);
      setCertificate(res);
      setSigned(true);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;
  if (error && !quiz) return <div className="card p-8 text-center text-red-600">{error}</div>;
  if (!quiz) return null;

  // 签署成功
  if (signed && certificate) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">✓</div>
          <h1 className="text-2xl font-bold text-slate-800">学习确认签署成功</h1>
          <p className="text-slate-500 mt-2">您的学习记录已生成，包含电子签名、时间戳和IP地址，可作为合规培训证据长期保存。</p>
          <div className="mt-6 p-4 bg-slate-50 rounded-lg text-left space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">证书编号</span><span className="font-mono font-medium">{certificate.certificate_no}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">签署时间</span><span>{new Date(certificate.signed_at).toLocaleString('zh-CN')}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">电子签名</span><span className="font-medium">{signedName}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">测验成绩</span><span className="font-semibold text-emerald-600">{result.score} 分</span></div>
          </div>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to={`/certificate/${recordId}`} className="btn btn-primary">查看学习证明</Link>
            <Link to="/my-records" className="btn btn-secondary">我的学习记录</Link>
          </div>
        </div>
      </div>
    );
  }

  // 结果页（待签署）
  if (result) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="card p-8">
          <div className="text-center mb-6">
            <div className={`text-5xl font-bold mb-2 ${result.passed ? 'text-emerald-600' : 'text-red-600'}`}>{result.score}</div>
            <div className="text-slate-500">分（满分100）</div>
            {result.passed ? (
              <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">✓ 测验通过</div>
            ) : (
              <div className="mt-3 inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">✗ 未通过</div>
            )}
            {result.is_high_risk && result.passed && !result.high_risk_passed && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                您是高风险岗位，需达到 {result.high_risk_required_score} 分，本次未达到要求，请重新学习后再测。
              </div>
            )}
            {result.is_high_risk && result.high_risk_passed && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700 text-sm">
                高风险岗位达标（要求 {result.high_risk_required_score} 分）
              </div>
            )}
          </div>

          {/* 答题详情 */}
          <div className="space-y-3 mb-6">
            {result.graded.map((g, i) => (
              <div key={g.question_id} className={`p-3 rounded-lg border ${g.is_correct ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div className="text-sm font-medium text-slate-800 mb-1">{i + 1}. {g.content}</div>
                <div className="text-xs text-slate-600">
                  您的答案：{g.user_answer.map(a => g.options[parseInt(a)]).join('、') || '未作答'}
                  {!g.is_correct && <span className="text-red-600 ml-2">正确答案：{g.correct_answer.map(a => g.options[parseInt(a)]).join('、')}</span>}
                </div>
              </div>
            ))}
          </div>

          {result.passed && (!result.is_high_risk || result.high_risk_passed) ? (
            <div className="border-t border-slate-200 pt-6">
              <h3 className="font-semibold text-slate-800 mb-3">签署学习确认</h3>
              <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 mb-4">
                <p className="font-medium text-slate-800 mb-2">学习确认书</p>
                <p>本人已认真学习《{quiz.title}》全部内容，理解并承诺遵守相关规定。本人确认以上学习过程真实有效，如有不实愿承担相应责任。</p>
              </div>
              <div className="mb-4">
                <label className="label">电子签名（请输入您的真实姓名）</label>
                <input className="input" value={signedName} onChange={e => setSignedName(e.target.value)} placeholder={`请输入"${user.name}"`} />
                <p className="text-xs text-slate-400 mt-1">签名将与您的账号身份核对，并记录签署时间、IP地址</p>
              </div>
              {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
              <button onClick={handleSign} className="btn btn-success w-full py-2.5">确认签署并提交</button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-slate-500 text-sm mb-4">
                {result.is_high_risk && result.passed && !result.high_risk_passed
                  ? `您是高风险岗位，本次成绩未达到 ${result.high_risk_required_score} 分的岗位要求，请重新学习后再次尝试。`
                  : `请重新学习后再次尝试${result.is_high_risk ? `。高风险岗位须达到 ${result.high_risk_required_score} 分` : ''}。`}
              </p>
              <Link to="/quizzes" className="btn btn-primary">返回测验中心</Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 作答页
  const answeredCount = Object.keys(answers).filter(k => answers[k]?.length > 0).length;
  const totalQuestions = quiz.questions.length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{quiz.title}</h1>
            <p className="text-sm text-slate-500 mt-1">{quiz.category} · 共 {totalQuestions} 题 · 合格线 {quiz.passing_score} 分{user.is_high_risk ? ` · 高风险岗位 ${quiz.high_risk_required_score} 分` : ''}</p>
          </div>
          {timeLeft !== null && (
            <div className={`text-right ${timeLeft < 60 ? 'text-red-600' : 'text-slate-600'}`}>
              <div className="text-2xl font-mono font-bold">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div>
              <div className="text-xs text-slate-400">剩余时间</div>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${(answeredCount / totalQuestions) * 100}%` }} />
          </div>
          <span className="text-sm text-slate-500 whitespace-nowrap">{answeredCount}/{totalQuestions} 已答</span>
        </div>
      </div>

      <div className="space-y-4">
        {quiz.questions.map((q, idx) => (
          <div key={q.id} className="card p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-semibold shrink-0">{idx + 1}</span>
              <div>
                <div className="font-medium text-slate-800">{q.content}</div>
                <div className="text-xs text-slate-400 mt-1">{q.type === 'single' ? '单选题' : q.type === 'multiple' ? '多选题' : '判断题'} · {q.score} 分</div>
              </div>
            </div>
            <div className="space-y-2 ml-10">
              {q.options.map((opt, oi) => {
                const selected = (answers[q.id] || []).includes(oi);
                return (
                  <label key={oi} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selected ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <input type={q.type === 'multiple' ? 'checkbox' : 'radio'}
                      checked={selected}
                      onChange={() => handleAnswer(q.id, oi, q.type)}
                      className="accent-brand-600" />
                    <span className="text-sm text-slate-700">{opt}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="sticky bottom-4 card p-4 flex items-center justify-between shadow-lg">
        <div className="text-sm text-slate-500">已答 {answeredCount}/{totalQuestions} 题</div>
        <button onClick={handleSubmit} disabled={submitting || answeredCount < totalQuestions} className="btn btn-primary px-8 py-2.5">
          {submitting ? '提交中...' : '提交答卷'}
        </button>
      </div>
    </div>
  );
}

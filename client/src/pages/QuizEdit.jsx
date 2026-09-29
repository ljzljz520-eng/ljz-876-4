import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

const emptyQuestion = () => ({ type: 'single', content: '', options: ['', ''], correct_answer: [], score: 5 });

export default function QuizEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState({
    title: '', category: '反舞弊', description: '', passing_score: 60, high_risk_required_score: 90, time_limit: 0,
  });
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isEdit) {
      api.quiz(id).then(q => {
        setForm({
          title: q.title, category: q.category, description: q.description || '',
          passing_score: q.passing_score, high_risk_required_score: q.high_risk_required_score, time_limit: q.time_limit,
        });
        setQuestions(q.questions.length ? q.questions.map(qq => ({
          type: qq.type, content: qq.content, options: qq.options, correct_answer: qq.correct_answer, score: qq.score,
        })) : [emptyQuestion()]);
      }).catch(err => setError(err.message)).finally(() => setLoading(false));
    }
  }, [id]);

  const updateQuestion = (idx, field, value) => {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };
  const updateOption = (qi, oi, value) => {
    setQuestions(prev => prev.map((q, i) => i === qi ? { ...q, options: q.options.map((o, j) => j === oi ? value : o) } : q));
  };
  const toggleCorrect = (qi, oi) => {
    setQuestions(prev => prev.map((q, i) => {
      if (i !== qi) return q;
      if (q.type === 'multiple') {
        const arr = q.correct_answer.includes(oi) ? q.correct_answer.filter(a => a !== oi) : [...q.correct_answer, oi];
        return { ...q, correct_answer: arr };
      }
      return { ...q, correct_answer: [oi] };
    }));
  };
  const addOption = (qi) => {
    setQuestions(prev => prev.map((q, i) => i === qi ? { ...q, options: [...q.options, ''] } : q));
  };
  const removeOption = (qi, oi) => {
    setQuestions(prev => prev.map((q, i) => i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi), correct_answer: q.correct_answer.filter(a => a !== oi).map(a => a > oi ? a - 1 : a) } : q));
  };
  const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion()]);
  const removeQuestion = (idx) => setQuestions(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async (publish = false) => {
    setError('');
    if (!form.title.trim()) { setError('请填写测验标题'); return; }
    if (questions.length === 0) { setError('请至少添加一道题目'); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.content.trim()) { setError(`第 ${i + 1} 题未填写题目内容`); return; }
      if (q.options.some(o => !o.trim())) { setError(`第 ${i + 1} 题选项不完整`); return; }
      if (q.correct_answer.length === 0) { setError(`第 ${i + 1} 题未设置正确答案`); return; }
    }
    setSaving(true);
    try {
      const payload = { ...form, questions };
      if (isEdit) {
        await api.updateQuiz(id, payload);
        if (publish) await api.publishQuiz(id);
      } else {
        const res = await api.createQuiz(payload);
        if (publish) await api.publishQuiz(res.id);
      }
      navigate('/manage/quizzes');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{isEdit ? '编辑测验' : '新建测验'}</h1>
          <p className="text-slate-500 text-sm mt-1">填写测验信息和题目，发布后员工可在测验中心作答</p>
        </div>
        <Link to="/manage/quizzes" className="btn btn-secondary">返回</Link>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

      <div className="card p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">基本信息</h2>
        <div>
          <label className="label">测验标题 *</label>
          <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：反舞弊合规测验" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">分类</label>
            <select className="input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
              <option value="反舞弊">反舞弊</option>
              <option value="数据安全">数据安全</option>
              <option value="采购红线">采购红线</option>
            </select>
          </div>
          <div>
            <label className="label">考试时限（分钟，0为不限）</label>
            <input type="number" className="input" value={form.time_limit} onChange={e => setForm({ ...form, time_limit: parseInt(e.target.value) || 0 })} />
          </div>
        </div>
        <div>
          <label className="label">测验说明</label>
          <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="请输入测验说明" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">合格分数（%）</label>
            <input type="number" className="input" value={form.passing_score} onChange={e => setForm({ ...form, passing_score: parseFloat(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="label">高风险岗位要求分数（%）</label>
            <input type="number" className="input" value={form.high_risk_required_score} onChange={e => setForm({ ...form, high_risk_required_score: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">题目列表（{questions.length} 题）</h2>
          <button onClick={addQuestion} className="btn btn-secondary text-sm">+ 添加题目</button>
        </div>
        {questions.map((q, qi) => (
          <div key={qi} className="card p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-sm font-semibold shrink-0">{qi + 1}</span>
              <div className="flex-1 space-y-3">
                <div className="flex gap-2">
                  <select className="input w-28" value={q.type} onChange={e => updateQuestion(qi, 'type', e.target.value)}>
                    <option value="single">单选题</option>
                    <option value="multiple">多选题</option>
                    <option value="judge">判断题</option>
                  </select>
                  <input className="input flex-1" value={q.content} onChange={e => updateQuestion(qi, 'content', e.target.value)} placeholder="请输入题目内容" />
                  <input type="number" className="input w-20" value={q.score} onChange={e => updateQuestion(qi, 'score', parseFloat(e.target.value) || 0)} title="题目分值" />
                </div>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type={q.type === 'multiple' ? 'checkbox' : 'radio'}
                        checked={q.correct_answer.includes(oi)}
                        onChange={() => toggleCorrect(qi, oi)}
                        className="accent-emerald-600" />
                      <input className="input flex-1" value={opt} onChange={e => updateOption(qi, oi, e.target.value)} placeholder={`选项 ${oi + 1}`} />
                      {q.options.length > 2 && <button onClick={() => removeOption(qi, oi)} className="text-red-500 text-sm px-2">删除</button>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => addOption(qi)} className="text-brand-600 text-sm hover:underline">+ 添加选项</button>
                  {questions.length > 1 && <button onClick={() => removeQuestion(qi)} className="text-red-500 text-sm hover:underline ml-auto">删除此题</button>}
                </div>
                <p className="text-xs text-slate-400">提示：勾选正确答案{q.type === 'multiple' ? '（多选题可勾选多个）' : ''}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 card p-4 flex gap-3 justify-end shadow-lg">
        <button onClick={() => handleSave(false)} disabled={saving} className="btn btn-secondary">保存草稿</button>
        <button onClick={() => handleSave(true)} disabled={saving} className="btn btn-primary">{saving ? '保存中...' : '保存并发布'}</button>
      </div>
    </div>
  );
}

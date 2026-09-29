import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function RecordDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [signedName, setSignedName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.record(id).then(setRecord).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [id]);

  const handleSign = async () => {
    if (!signedName.trim()) { setError('请输入您的真实姓名作为电子签名'); return; }
    setError('');
    try {
      await api.signRecord(record.id, signedName);
      const updated = await api.record(id);
      setRecord(updated);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;
  if (error) return <div className="card p-8 text-center text-red-600">{error}</div>;
  if (!record) return null;

  const canSign = record.status === 'completed' && record.passed === 1 && (!record.is_high_risk || record.high_risk_passed === 1) && record.user_id === user.id;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/my-records" className="hover:text-brand-600">我的学习记录</Link>
        <span>/</span>
        <span className="text-slate-800">记录详情</span>
      </div>

      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{record.quiz_title}</h1>
            <p className="text-sm text-slate-500 mt-1">{record.category} · {record.name} ({record.employee_no})</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${record.passed ? 'text-emerald-600' : 'text-red-600'}`}>{record.score}分</div>
            <div className="text-xs text-slate-400">合格线 {record.passing_score} 分{record.is_high_risk ? ` · 高风险线 ${record.high_risk_required_score} 分` : ''}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-400">开始时间</div><div className="font-medium">{record.started_at}</div></div>
          <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-400">完成时间</div><div className="font-medium">{record.completed_at || '-'}</div></div>
          <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-400">用时</div><div className="font-medium">{record.duration_seconds ? `${Math.floor(record.duration_seconds / 60)}分${record.duration_seconds % 60}秒` : '-'}</div></div>
          <div className="p-3 bg-slate-50 rounded-lg"><div className="text-xs text-slate-400">状态</div>
            <div>{record.status === 'signed' ? <span className="badge bg-emerald-100 text-emerald-700">已签署</span>
              : record.passed ? <span className="badge bg-amber-100 text-amber-700">待签署</span>
              : <span className="badge bg-red-100 text-red-700">未通过</span>}</div>
          </div>
        </div>

        {record.status === 'signed' && (
          <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
              <span>✓</span> 已签署学习确认
            </div>
            <div className="text-sm text-emerald-800 space-y-1">
              <div>电子签名：{record.signed_name}</div>
              <div>签署时间：{record.signed_at}</div>
              <div>签署IP：{record.sign_ip}</div>
              <div>证书编号：{record.certificate_no}</div>
            </div>
            <Link to={`/certificate/${record.id}`} className="inline-block mt-3 text-brand-600 hover:underline text-sm">查看学习证明 →</Link>
          </div>
        )}
      </div>

      {/* 答题详情 */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-800 mb-4">答题详情</h2>
        <div className="space-y-3">
          {record.questions.map((q, i) => (
            <div key={q.id} className={`p-3 rounded-lg border ${q.is_correct ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
              <div className="text-sm font-medium text-slate-800 mb-1">{i + 1}. {q.content}</div>
              <div className="text-xs text-slate-600">
                您的答案：{q.user_answer.map(a => q.options[parseInt(a)]).join('、') || '未作答'}
                {!q.is_correct && <span className="text-red-600 ml-2">正确答案：{q.correct_answer.map(a => q.options[parseInt(a)]).join('、')}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 签署区 */}
      {canSign && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-800 mb-3">签署学习确认</h2>
          <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600 mb-4">
            <p className="font-medium text-slate-800 mb-2">学习确认书</p>
            <p>本人已认真学习《{record.quiz_title}》全部内容，理解并承诺遵守相关规定。本人确认以上学习过程真实有效，如有不实愿承担相应责任。</p>
          </div>
          <div className="mb-4">
            <label className="label">电子签名（请输入您的真实姓名）</label>
            <input className="input" value={signedName} onChange={e => setSignedName(e.target.value)} placeholder={`请输入"${user.name}"`} />
            <p className="text-xs text-slate-400 mt-1">签名将与您的账号身份核对，并记录签署时间、IP地址</p>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <button onClick={handleSign} className="btn btn-success w-full py-2.5">确认签署并提交</button>
        </div>
      )}
    </div>
  );
}

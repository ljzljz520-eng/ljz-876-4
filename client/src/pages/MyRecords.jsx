import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function MyRecords() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myRecords().then(setRecords).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">我的学习记录</h1>
        <p className="text-slate-500 text-sm mt-1">每份记录都包含您的电子签名、签署时间和IP地址，是您完成合规培训的有效证明</p>
      </div>

      {records.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-slate-400 mb-4">暂无学习记录</div>
          <Link to="/quizzes" className="btn btn-primary">去参加测验</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800">{r.quiz_title}</h3>
                    <span className="badge bg-slate-100 text-slate-700">{r.category}</span>
                  </div>
                  <div className="text-sm text-slate-500 space-y-0.5">
                    <div>开始时间：{r.started_at}</div>
                    {r.completed_at && <div>完成时间：{r.completed_at}</div>}
                    {r.signed_at && <div>签署时间：{r.signed_at}</div>}
                    {r.duration_seconds && <div>用时：{Math.floor(r.duration_seconds / 60)}分{r.duration_seconds % 60}秒</div>}
                  </div>
                </div>
                <div className="text-right ml-4">
                  {r.status === 'signed' ? (
                    <>
                      <div className="text-2xl font-bold text-emerald-600">{r.score}分</div>
                      <span className="badge bg-emerald-100 text-emerald-700 mt-1">已签署</span>
                    </>
                  ) : r.status === 'completed' ? (
                    <>
                      <div className={`text-2xl font-bold ${r.passed ? 'text-emerald-600' : 'text-red-600'}`}>{r.score}分</div>
                      <span className={`badge mt-1 ${r.passed ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {r.passed ? '待签署' : '未通过'}
                      </span>
                    </>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-700">进行中</span>
                  )}
                </div>
              </div>
              {r.status === 'signed' && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-xs text-slate-400">
                    电子签名：{r.signed_name} · 证书号：{r.certificate_no}
                  </div>
                  <Link to={`/certificate/${r.id}`} className="text-brand-600 hover:underline text-sm">查看学习证明 →</Link>
                </div>
              )}
              {r.status === 'completed' && r.passed && (!r.is_high_risk || r.high_risk_passed) && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <Link to={`/records/${r.id}`} className="btn btn-success btn-sm">去签署学习确认</Link>
                </div>
              )}
              {r.status === 'completed' && r.passed && r.is_high_risk && !r.high_risk_passed && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-red-600 mb-2">高风险岗位未达到 {r.high_risk_required_score} 分要求</div>
                  <Link to={`/quizzes`} className="btn btn-primary btn-sm">重新学习</Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

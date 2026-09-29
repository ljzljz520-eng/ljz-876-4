import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const categoryColors = {
  '反舞弊': 'bg-red-100 text-red-700',
  '数据安全': 'bg-blue-100 text-blue-700',
  '采购红线': 'bg-amber-100 text-amber-700',
};

export default function QuizList() {
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [myRecords, setMyRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all([api.quizzes({ scope: 'mine' }), api.myRecords()])
      .then(([q, r]) => { setQuizzes(q); setMyRecords(r); })
      .finally(() => setLoading(false));
  }, []);

  const getRecordStatus = (quizId) => {
    const rec = myRecords.find(r => r.quiz_id === quizId);
    return rec;
  };

  const filtered = quizzes.filter(q => !filter || q.category === filter);
  const categories = [...new Set(quizzes.map(q => q.category))];

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">测验中心</h1>
        <p className="text-slate-500 text-sm mt-1">选择测验开始学习，通过后请签署学习确认。{user.is_high_risk && <span className="text-red-600 font-medium"> 您是高风险岗位，需达到 {quizzes[0]?.high_risk_required_score || 90} 分。</span>}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFilter('')} className={`btn ${!filter ? 'btn-primary' : 'btn-secondary'}`}>全部</button>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`btn ${filter === c ? 'btn-primary' : 'btn-secondary'}`}>{c}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">暂无已发布的测验</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(q => {
            const rec = getRecordStatus(q.id);
            return (
              <div key={q.id} className="card p-5 flex flex-col hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <span className={`badge ${categoryColors[q.category] || 'bg-slate-100 text-slate-700'}`}>{q.category}</span>
                  {rec?.status === 'signed' && <span className="badge bg-emerald-100 text-emerald-700">已完成</span>}
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{q.title}</h3>
                <p className="text-sm text-slate-500 flex-1 line-clamp-2">{q.description}</p>
                <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                  <div className="flex justify-between"><span>题目数量</span><span>{q.question_count} 题</span></div>
                  <div className="flex justify-between"><span>合格分数</span><span>{q.passing_score} 分</span></div>
                  {user.is_high_risk && <div className="flex justify-between text-red-600"><span>高风险岗位要求</span><span className="font-semibold">{q.high_risk_required_score} 分</span></div>}
                  <div className="flex justify-between"><span>已签署人数</span><span>{q.signed_count} 人</span></div>
                </div>
                <div className="mt-4">
                  {rec?.status === 'signed' ? (
                    <Link to={`/certificate/${rec.id}`} className="btn btn-secondary w-full">查看学习证明</Link>
                  ) : rec?.status === 'completed' ? (
                    <Link to={`/records/${rec.id}`} className="btn btn-success w-full">去签署确认</Link>
                  ) : rec?.status === 'in_progress' ? (
                    <Link to={`/quizzes/${q.id}/take`} className="btn btn-primary w-full">继续作答</Link>
                  ) : (
                    <Link to={`/quizzes/${q.id}/take`} className="btn btn-primary w-full">开始学习</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

const categoryColors = {
  '反舞弊': 'bg-red-100 text-red-700',
  '数据安全': 'bg-blue-100 text-blue-700',
  '采购红线': 'bg-amber-100 text-amber-700',
};

export default function QuizManage() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.quizzes({}).then(setQuizzes).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handlePublish = async (id) => {
    if (!confirm('确定发布该测验？发布后员工可见。')) return;
    await api.publishQuiz(id);
    load();
  };
  const handleArchive = async (id) => {
    if (!confirm('确定归档该测验？归档后员工不可见。')) return;
    await api.archiveQuiz(id);
    load();
  };
  const handleDelete = async (id) => {
    if (!confirm('确定删除该测验及其所有题目？此操作不可恢复。')) return;
    await api.deleteQuiz(id);
    load();
  };

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">测验管理</h1>
          <p className="text-slate-500 text-sm mt-1">发布反舞弊、数据安全、采购红线等合规测验</p>
        </div>
        <Link to="/manage/quizzes/new" className="btn btn-primary">+ 新建测验</Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200 bg-slate-50">
            <th className="table-th">测验标题</th><th className="table-th">分类</th><th className="table-th">题数</th><th className="table-th">合格线/高风险线</th><th className="table-th">已签署</th><th className="table-th">状态</th><th className="table-th">操作</th>
          </tr></thead>
          <tbody>
            {quizzes.map(q => (
              <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="table-td font-medium">{q.title}</td>
                <td className="table-td"><span className={`badge ${categoryColors[q.category] || 'bg-slate-100 text-slate-700'}`}>{q.category}</span></td>
                <td className="table-td">{q.question_count}</td>
                <td className="table-td text-xs">{q.passing_score} / <span className="text-red-600">{q.high_risk_required_score}</span></td>
                <td className="table-td">{q.signed_count}</td>
                <td className="table-td">
                  {q.status === 'published' ? <span className="badge bg-emerald-100 text-emerald-700">已发布</span>
                    : q.status === 'draft' ? <span className="badge bg-slate-100 text-slate-700">草稿</span>
                    : <span className="badge bg-amber-100 text-amber-700">已归档</span>}
                </td>
                <td className="table-td">
                  <div className="flex gap-2 text-xs">
                    {q.status === 'draft' && <Link to={`/manage/quizzes/${q.id}/edit`} className="text-brand-600 hover:underline">编辑</Link>}
                    {q.status === 'draft' && <button onClick={() => handlePublish(q.id)} className="text-emerald-600 hover:underline">发布</button>}
                    {q.status === 'published' && <button onClick={() => handleArchive(q.id)} className="text-amber-600 hover:underline">归档</button>}
                    {q.status === 'archived' && <button onClick={() => handlePublish(q.id)} className="text-emerald-600 hover:underline">重新发布</button>}
                    <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:underline">删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

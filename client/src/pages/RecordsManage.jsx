import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function RecordsManage() {
  const [records, setRecords] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ quiz_id: '', department: '', status: '', high_risk: '', keyword: '' });

  useEffect(() => {
    Promise.all([
      api.records(filters),
      api.quizzes({}),
      api.departments(),
    ]).then(([r, q, d]) => {
      setRecords(r);
      setQuizzes(q);
      setDepartments(d);
    }).finally(() => setLoading(false));
  }, [filters]);

  const handleExport = () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams();
    if (filters.quiz_id) params.set('quiz_id', filters.quiz_id);
    if (filters.department) params.set('department', filters.department);
    // 用 fetch 带 token 下载
    fetch(`/api/records/export/csv?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `学习记录证据_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
      });
  };

  const statusBadge = (r) => {
    if (r.status === 'signed') return <span className="badge bg-emerald-100 text-emerald-700">已签署</span>;
    if (r.status === 'completed') return r.passed ? <span className="badge bg-amber-100 text-amber-700">待签署</span> : <span className="badge bg-red-100 text-red-700">未通过</span>;
    return <span className="badge bg-slate-100 text-slate-700">进行中</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">学习记录证据</h1>
          <p className="text-slate-500 text-sm mt-1">每份记录包含电子签名、签署时间与IP地址，可导出作为合规培训证据</p>
        </div>
        <button onClick={handleExport} className="btn btn-secondary">导出 CSV 证据</button>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <input className="input" placeholder="姓名/工号" value={filters.keyword} onChange={e => setFilters({ ...filters, keyword: e.target.value })} />
          <select className="input" value={filters.quiz_id} onChange={e => setFilters({ ...filters, quiz_id: e.target.value })}>
            <option value="">全部测验</option>
            {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
          </select>
          <select className="input" value={filters.department} onChange={e => setFilters({ ...filters, department: e.target.value })}>
            <option value="">全部部门</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="input" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="">全部状态</option>
            <option value="signed">已签署</option>
            <option value="completed">已完成</option>
            <option value="in_progress">进行中</option>
          </select>
          <select className="input" value={filters.high_risk} onChange={e => setFilters({ ...filters, high_risk: e.target.value })}>
            <option value="">全部岗位</option>
            <option value="true">高风险岗位</option>
            <option value="false">普通岗位</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="table-th">员工</th><th className="table-th">部门/岗位</th><th className="table-th">测验</th><th className="table-th">得分</th><th className="table-th">状态</th><th className="table-th">电子签名</th><th className="table-th">签署时间</th><th className="table-th">签署IP</th><th className="table-th">操作</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="9" className="text-center py-8 text-slate-400">加载中...</td></tr>
              ) : records.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-8 text-slate-400">暂无记录</td></tr>
              ) : records.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="table-td">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-400">{r.employee_no}</div>
                  </td>
                  <td className="table-td">
                    <div>{r.department}</div>
                    <div className="text-xs text-slate-400">{r.position}{r.is_high_risk && <span className="text-red-500 ml-1">高风险</span>}</div>
                  </td>
                  <td className="table-td">{r.quiz_title}</td>
                  <td className="table-td">
                    <span className={r.passed ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>{r.score ?? '-'}</span>
                  </td>
                  <td className="table-td">{statusBadge(r)}</td>
                  <td className="table-td">{r.signed_name || '-'}</td>
                  <td className="table-td text-xs text-slate-500">{r.signed_at || '-'}</td>
                  <td className="table-td text-xs font-mono text-slate-500">{r.sign_ip || '-'}</td>
                  <td className="table-td">
                    <Link to={`/records/${r.id}`} className="text-brand-600 hover:underline text-sm">详情</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-slate-400">共 {records.length} 条记录 · 数据包含完整证据链，可随时追溯"谁在什么时候学过"</div>
    </div>
  );
}

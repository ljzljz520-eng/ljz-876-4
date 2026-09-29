import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 复用 dashboard stats 没有日志，这里直接请求 records 接口不返回日志；
    // 审计日志通过专门接口获取（在下方补充）
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/dashboard/audit-logs', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const actionLabels = {
    login_success: '登录成功', login_failed: '登录失败', change_password: '修改密码',
    create_user: '创建用户', update_user: '更新用户', delete_user: '删除用户', reset_password: '重置密码',
    create_quiz: '创建测验', update_quiz: '更新测验', publish_quiz: '发布测验', archive_quiz: '归档测验', delete_quiz: '删除测验',
    start_quiz: '开始测验', submit_quiz: '提交测验', sign_confirmation: '签署确认',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">操作审计日志</h1>
        <p className="text-slate-500 text-sm mt-1">系统所有关键操作均留痕，可追溯谁在什么时候做了什么</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200 bg-slate-50">
              <th className="table-th">时间</th><th className="table-th">操作人</th><th className="table-th">操作</th><th className="table-th">详情</th><th className="table-th">IP地址</th>
            </tr></thead>
            <tbody>
              {loading ? <tr><td colSpan="5" className="text-center py-8 text-slate-400">加载中...</td></tr>
                : logs.length === 0 ? <tr><td colSpan="5" className="text-center py-8 text-slate-400">暂无日志</td></tr>
                : logs.map(log => (
                  <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="table-td text-xs text-slate-500 whitespace-nowrap">{log.created_at}</td>
                    <td className="table-td">{log.operator_name || '系统'}</td>
                    <td className="table-td"><span className="badge bg-brand-100 text-brand-700">{actionLabels[log.action] || log.action}</span></td>
                    <td className="table-td text-slate-600">{log.detail}</td>
                    <td className="table-td text-xs font-mono text-slate-500">{log.ip_address || '-'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

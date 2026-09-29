import React, { useState, useEffect } from 'react';
import { api } from '../api';

export default function UserManage() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ employee_no: '', name: '', department: '', position: '', is_high_risk: false, role: 'employee', password: '' });
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.users({}), api.departments()]).then(([u, d]) => {
      setUsers(u);
      setDepartments(d);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ employee_no: '', name: '', department: departments[0] || '', position: '', is_high_risk: false, role: 'employee', password: '' });
    setError('');
    setShowModal(true);
  };
  const openEdit = (u) => {
    setEditing(u);
    setForm({ employee_no: u.employee_no, name: u.name, department: u.department, position: u.position, is_high_risk: u.is_high_risk, role: u.role, password: '' });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async () => {
    setError('');
    try {
      if (editing) {
        await api.updateUser(editing.id, { name: form.name, department: form.department, position: form.position, is_high_risk: form.is_high_risk, role: form.role });
      } else {
        await api.createUser(form);
      }
      setShowModal(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleReset = async (u) => {
    if (!confirm(`确定重置 ${u.name} 的密码为 123456？`)) return;
    const res = await api.resetPassword(u.id);
    alert(res.message);
  };
  const handleDelete = async (u) => {
    if (!confirm(`确定删除用户 ${u.name}(${u.employee_no})？此操作不可恢复。`)) return;
    await api.deleteUser(u.id);
    load();
  };
  const toggleActive = async (u) => {
    await api.updateUser(u.id, { active: !u.active });
    load();
  };

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">用户管理</h1>
          <p className="text-slate-500 text-sm mt-1">管理员工账号、岗位与高风险标识</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">+ 新建用户</button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead><tr className="border-b border-slate-200 bg-slate-50">
            <th className="table-th">工号</th><th className="table-th">姓名</th><th className="table-th">部门</th><th className="table-th">岗位</th><th className="table-th">角色</th><th className="table-th">高风险</th><th className="table-th">状态</th><th className="table-th">操作</th>
          </tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="table-td font-mono text-xs">{u.employee_no}</td>
                <td className="table-td font-medium">{u.name}</td>
                <td className="table-td">{u.department}</td>
                <td className="table-td">{u.position}</td>
                <td className="table-td"><span className="badge bg-slate-100 text-slate-700">{u.role === 'admin' ? '管理员' : u.role === 'legal' ? '法务' : u.role === 'audit' ? '审计' : '员工'}</span></td>
                <td className="table-td">{u.is_high_risk ? <span className="badge bg-red-100 text-red-700">高风险</span> : '-'}</td>
                <td className="table-td">
                  <button onClick={() => toggleActive(u)} className={`badge ${u.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    {u.active ? '正常' : '停用'}
                  </button>
                </td>
                <td className="table-td">
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => openEdit(u)} className="text-brand-600 hover:underline">编辑</button>
                    <button onClick={() => handleReset(u)} className="text-amber-600 hover:underline">重置密码</button>
                    <button onClick={() => handleDelete(u)} className="text-red-600 hover:underline">删除</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">{editing ? '编辑用户' : '新建用户'}</h2>
            {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">工号 *</label>
                  <input className="input" value={form.employee_no} disabled={!!editing} onChange={e => setForm({ ...form, employee_no: e.target.value })} />
                </div>
                <div>
                  <label className="label">姓名 *</label>
                  <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">部门 *</label>
                  <input className="input" list="dept-list" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} />
                  <datalist id="dept-list">{departments.map(d => <option key={d} value={d} />)}</datalist>
                </div>
                <div>
                  <label className="label">岗位 *</label>
                  <input className="input" value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">角色</label>
                  <select className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="employee">员工</option>
                    <option value="legal">法务</option>
                    <option value="audit">审计</option>
                    <option value="admin">管理员</option>
                  </select>
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={form.is_high_risk} onChange={e => setForm({ ...form, is_high_risk: e.target.checked })} className="accent-red-600" />
                    高风险岗位
                  </label>
                </div>
              </div>
              {!editing && (
                <div>
                  <label className="label">初始密码（留空则为 123456）</label>
                  <input className="input" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="123456" />
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">取消</button>
              <button onClick={handleSubmit} className="btn btn-primary">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

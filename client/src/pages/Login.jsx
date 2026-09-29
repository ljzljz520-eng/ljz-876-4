import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [employeeNo, setEmployeeNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(employeeNo.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const quickFill = (no) => {
    setEmployeeNo(no);
    setPassword('123456');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-800 via-brand-700 to-brand-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-white/15 rounded-2xl items-center justify-center text-3xl font-bold text-white mb-4">合</div>
          <h1 className="text-2xl font-bold text-white">企业内控合规测评平台</h1>
          <p className="text-brand-200 text-sm mt-2">反舞弊 · 数据安全 · 采购红线 — 学习证据全程可追溯</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-lg font-semibold text-slate-800 mb-6">账号登录</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">工号</label>
              <input className="input" value={employeeNo} onChange={e => setEmployeeNo(e.target.value)} placeholder="请输入工号" required />
            </div>
            <div>
              <label className="label">密码</label>
              <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="请输入密码" required />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary w-full py-2.5">
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-500 mb-3">演示账号（密码均为 123456），点击快速填充：</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button onClick={() => quickFill('A001')} className="px-2 py-1.5 bg-slate-50 hover:bg-brand-50 rounded text-slate-600 text-left">A001 管理员</button>
              <button onClick={() => quickFill('L001')} className="px-2 py-1.5 bg-slate-50 hover:bg-brand-50 rounded text-slate-600 text-left">L001 法务</button>
              <button onClick={() => quickFill('U001')} className="px-2 py-1.5 bg-slate-50 hover:bg-brand-50 rounded text-slate-600 text-left">U001 审计</button>
              <button onClick={() => quickFill('E001')} className="px-2 py-1.5 bg-slate-50 hover:bg-brand-50 rounded text-slate-600 text-left">E001 张三(高风险)</button>
              <button onClick={() => quickFill('E004')} className="px-2 py-1.5 bg-slate-50 hover:bg-brand-50 rounded text-slate-600 text-left">E004 赵六(高风险)</button>
              <button onClick={() => quickFill('E005')} className="px-2 py-1.5 bg-slate-50 hover:bg-brand-50 rounded text-slate-600 text-left">E005 钱七(员工)</button>
            </div>
          </div>
        </div>
        <p className="text-center text-brand-200 text-xs mt-6">登录即表示您同意学习记录被记录并作为合规培训证据保存</p>
      </div>
    </div>
  );
}

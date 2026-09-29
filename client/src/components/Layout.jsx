import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleLabels = { admin: '管理员', legal: '法务', audit: '审计', employee: '员工' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isManager = ['admin', 'legal', 'audit'].includes(user.role);

  const navItems = [
    { to: '/', label: '工作台', end: true },
    { to: '/quizzes', label: '测验中心' },
    { to: '/my-records', label: '我的学习记录' },
  ];

  const manageItems = [
    { to: '/manage/quizzes', label: '测验管理', roles: ['admin', 'legal', 'audit'] },
    { to: '/manage/records', label: '学习记录证据', roles: ['admin', 'legal', 'audit'] },
    { to: '/manage/users', label: '用户管理', roles: ['admin'] },
    { to: '/manage/audit', label: '操作审计日志', roles: ['admin', 'legal', 'audit'] },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center font-bold text-lg">合</div>
                <div>
                  <div className="font-bold text-base leading-tight">内控合规测评平台</div>
                  <div className="text-xs text-brand-200 leading-tight">学习证据链 · 全程可追溯</div>
                </div>
              </div>
              <nav className="hidden md:flex items-center gap-1">
                {navItems.map(item => (
                  <NavLink key={item.to} to={item.to} end={item.end}
                    className={({ isActive }) => `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-white/20 text-white' : 'text-brand-100 hover:bg-white/10'}`}>
                    {item.label}
                  </NavLink>
                ))}
                {isManager && (
                  <div className="relative group">
                    <button className="px-3 py-2 rounded-lg text-sm font-medium text-brand-100 hover:bg-white/10 flex items-center gap-1">
                      管理 <span className="text-xs">▾</span>
                    </button>
                    <div className="absolute left-0 top-full pt-1 hidden group-hover:block z-50">
                      <div className="bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[160px]">
                        {manageItems.filter(i => i.roles.includes(user.role)).map(item => (
                          <NavLink key={item.to} to={item.to}
                            className={({ isActive }) => `block px-4 py-2 text-sm ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                            {item.label}
                          </NavLink>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium">{user.name}</div>
                <div className="text-xs text-brand-200">{user.department} · {roleLabels[user.role]}{user.is_high_risk ? ' · 高风险岗位' : ''}</div>
              </div>
              <button onClick={handleLogout} className="btn bg-white/10 text-white hover:bg-white/20 text-sm">退出</button>
              <button className="md:hidden text-white p-1" onClick={() => setMenuOpen(!menuOpen)}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            </div>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 px-4 py-2">
            {navItems.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-white/20' : 'text-brand-100'}`}>
                {item.label}
              </NavLink>
            ))}
            {isManager && manageItems.filter(i => i.roles.includes(user.role)).map(item => (
              <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}
                className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-white/20' : 'text-brand-100'}`}>
                {item.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>
      <footer className="bg-white border-t border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          企业内控合规测评平台 · 学习记录含电子签名、时间戳与IP地址，可作为合规培训证据长期保存
        </div>
      </footer>
    </div>
  );
}

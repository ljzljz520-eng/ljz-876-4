import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const categoryColors = {
  '反舞弊': 'bg-red-100 text-red-700',
  '数据安全': 'bg-blue-100 text-blue-700',
  '采购红线': 'bg-amber-100 text-amber-700',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const isManager = ['admin', 'legal', 'audit'].includes(user.role);

  useEffect(() => {
    Promise.all([
      isManager ? api.dashboardStats() : Promise.resolve(null),
      api.myStats(),
    ]).then(([s, m]) => {
      setStats(s);
      setMyStats(m);
    }).finally(() => setLoading(false));
  }, [isManager]);

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;

  // 员工视角
  if (!isManager) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">工作台</h1>
          <p className="text-slate-500 text-sm mt-1">欢迎，{user.name}。{user.is_high_risk ? '您所在岗位为高风险岗位，测验需达到更高分数要求。' : '请完成以下合规测验并签署学习确认。'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="已完成签署" value={myStats?.signed || 0} color="emerald" />
          <StatCard label="进行中" value={myStats?.inProgress || 0} color="amber" />
          <StatCard label="可参加测验" value={myStats?.available || 0} color="brand" />
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-800">我的学习记录</h2>
            <Link to="/quizzes" className="text-sm text-brand-600 hover:text-brand-700">去测验中心 →</Link>
          </div>
          {myStats?.records?.length === 0 ? (
            <div className="text-center py-8 text-slate-400">暂无学习记录，快去参加测验吧</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200">
                  <th className="table-th">测验</th><th className="table-th">分类</th><th className="table-th">得分</th><th className="table-th">状态</th><th className="table-th">签署时间</th><th className="table-th">操作</th>
                </tr></thead>
                <tbody>
                  {myStats?.records?.map(r => (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="table-td font-medium">{r.title}</td>
                      <td className="table-td"><span className={`badge ${categoryColors[r.category] || 'bg-slate-100 text-slate-700'}`}>{r.category}</span></td>
                      <td className="table-td">{r.score ?? '-'} 分</td>
                      <td className="table-td">
                        {r.status === 'signed' ? <span className="badge bg-emerald-100 text-emerald-700">已签署</span>
                          : r.status === 'completed' ? <span className="badge bg-amber-100 text-amber-700">待签署</span>
                          : <span className="badge bg-slate-100 text-slate-700">进行中</span>}
                      </td>
                      <td className="table-td text-slate-500">{r.signed_at || '-'}</td>
                      <td className="table-td">
                        {r.status === 'signed' ? <Link to={`/certificate/${r.id}`} className="text-brand-600 hover:underline text-sm">查看证明</Link>
                          : r.status === 'completed' ? <Link to={`/records/${r.id}`} className="text-brand-600 hover:underline text-sm">去签署</Link>
                          : <Link to={`/quizzes/${r.id}/take`} className="text-brand-600 hover:underline text-sm">继续</Link>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 管理视角
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">合规培训管理工作台</h1>
        <p className="text-slate-500 text-sm mt-1">实时掌握全员学习情况，每份记录含电子签名、时间戳与IP，可作为合规证据追溯</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="员工总数" value={stats?.overview?.totalEmployees || 0} color="brand" />
        <StatCard label="高风险岗位" value={stats?.overview?.highRiskCount || 0} color="red" />
        <StatCard label="已发布测验" value={stats?.overview?.publishedQuizzes || 0} color="amber" />
        <StatCard label="已签署学习记录" value={stats?.overview?.totalSigned || 0} color="emerald" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 高风险岗位达标情况 */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-1">高风险岗位达标情况</h2>
          <p className="text-xs text-slate-500 mb-4">高风险岗位须达到测验要求的更高分数（默认90分）</p>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {stats?.highRiskUsers?.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div>
                  <div className="font-medium text-sm text-slate-800">{u.name} <span className="text-xs text-slate-400">({u.employee_no})</span></div>
                  <div className="text-xs text-slate-500">{u.department} · {u.position}</div>
                </div>
                <div className="text-right">
                  {u.failed_count > 0 ? (
                    <span className="badge bg-red-100 text-red-700">有未达标记录</span>
                  ) : u.signed_count > 0 ? (
                    <span className="badge bg-emerald-100 text-emerald-700">已达标 {u.signed_count} 项</span>
                  ) : (
                    <span className="badge bg-amber-100 text-amber-700">未开始</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 部门签署统计 */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-4">各部门学习完成率</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {stats?.deptStats?.map(d => {
              const rate = d.employee_count > 0 ? Math.round((d.signed_count / d.employee_count) * 100) : 0;
              return (
                <div key={d.department}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{d.department}</span>
                    <span className="text-slate-500">{d.signed_count}/{d.employee_count} 人 ({rate}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${rate >= 100 ? 'bg-emerald-500' : rate >= 50 ? 'bg-brand-500' : 'bg-amber-500'}`} style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 各测验学习情况 */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">各测验学习情况</h2>
          <Link to="/manage/records" className="text-sm text-brand-600 hover:text-brand-700">查看全部证据 →</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-slate-200">
              <th className="table-th">测验名称</th><th className="table-th">分类</th><th className="table-th">合格线</th><th className="table-th">高风险线</th><th className="table-th">已签署</th><th className="table-th">未通过</th><th className="table-th">进行中</th>
            </tr></thead>
            <tbody>
              {stats?.quizStats?.map(q => (
                <tr key={q.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="table-td font-medium">{q.title}</td>
                  <td className="table-td"><span className={`badge ${categoryColors[q.category] || 'bg-slate-100 text-slate-700'}`}>{q.category}</span></td>
                  <td className="table-td">{q.passing_score}分</td>
                  <td className="table-td text-red-600 font-medium">{q.high_risk_required_score}分</td>
                  <td className="table-td"><span className="text-emerald-600 font-semibold">{q.signed_count}</span> 人</td>
                  <td className="table-td">{q.failed_count > 0 ? <span className="text-red-600 font-semibold">{q.failed_count}</span> : 0}</td>
                  <td className="table-td text-amber-600">{q.in_progress_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 最近签署动态 */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-1">最近签署动态</h2>
          <p className="text-xs text-slate-500 mb-4">谁在什么时候签署了学习确认</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stats?.recentSigns?.length === 0 && <div className="text-center py-8 text-slate-400">暂无签署记录</div>}
            {stats?.recentSigns?.map(s => (
              <div key={s.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="w-8 h-8 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">签</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-800"><span className="font-medium">{s.name}</span> 签署了《{s.quiz_title}》</div>
                  <div className="text-xs text-slate-500 mt-0.5">{s.department} · {s.signed_at} · {s.ip_address}</div>
                  <div className="text-xs text-slate-400 mt-0.5">证书号 {s.certificate_no}</div>
                </div>
                <div className="text-sm font-semibold text-emerald-600">{s.score}分</div>
              </div>
            ))}
          </div>
        </div>

        {/* 待完成学习 */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 mb-1">待完成学习员工</h2>
          <p className="text-xs text-slate-500 mb-4">高风险岗位未完成的员工将优先提醒</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {stats?.pendingUsers?.length === 0 && <div className="text-center py-8 text-slate-400">全员已完成学习</div>}
            {stats?.pendingUsers?.map(u => (
              <div key={u.id} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-slate-800">
                    {u.name} <span className="text-xs text-slate-400">({u.employee_no})</span>
                    {u.is_high_risk && <span className="badge bg-red-100 text-red-700 ml-2">高风险</span>}
                  </div>
                  <div className="text-xs text-slate-500">{u.department} · {u.position}</div>
                </div>
                <div className="text-xs text-amber-600 mt-1.5">待完成：{u.pending_quizzes.join('、')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colors = {
    brand: 'bg-brand-50 text-brand-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className="card p-5">
      <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-3 ${colors[color]}`}>
        <span className="text-lg font-bold">{value}</span>
      </div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}

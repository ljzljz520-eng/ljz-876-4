import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

export default function Certificate() {
  const { id } = useParams();
  const [cert, setCert] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.certificate(id).then(setCert).catch(err => setError(err.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-12 text-slate-500">加载中...</div>;
  if (error) return <div className="card p-8 text-center text-red-600">{error}</div>;
  if (!cert) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/my-records" className="text-sm text-slate-500 hover:text-brand-600">← 返回我的学习记录</Link>
        <button onClick={() => window.print()} className="btn btn-secondary">打印 / 保存PDF</button>
      </div>

      <div className="card p-10 border-4 border-double border-brand-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-full -mr-16 -mt-16 opacity-50" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brand-50 rounded-full -ml-12 -mb-12 opacity-50" />

        <div className="text-center relative">
          <div className="inline-flex w-14 h-14 bg-brand-600 text-white rounded-xl items-center justify-center text-2xl font-bold mb-4">合</div>
          <h1 className="text-2xl font-bold text-slate-800">企业内控合规培训学习证明</h1>
          <p className="text-slate-400 text-sm mt-1">CERTIFICATE OF COMPLIANCE TRAINING</p>
          <div className="w-24 h-1 bg-brand-600 mx-auto mt-4 rounded" />
        </div>

        <div className="mt-8 space-y-4 text-sm relative">
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">证书编号</span>
            <span className="font-mono font-semibold text-brand-700">{cert.certificate_no}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">学员姓名</span>
            <span className="font-medium">{cert.name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">工号 / 部门 / 岗位</span>
            <span className="font-medium">{cert.employee_no} · {cert.department} · {cert.position}{cert.is_high_risk ? '（高风险岗位）' : ''}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">培训课程</span>
            <span className="font-medium">{cert.quiz_title}（{cert.category}）</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">考核成绩</span>
            <span className="font-semibold text-emerald-600">{cert.score} 分</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">电子签名</span>
            <span className="font-medium">{cert.signed_name}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">签署时间</span>
            <span className="font-medium">{cert.signed_at}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">签署IP地址</span>
            <span className="font-mono text-xs">{cert.sign_ip}</span>
          </div>
        </div>

        <div className="mt-8 p-4 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed">
          <p className="font-medium text-slate-800 mb-1">学习确认声明</p>
          <p>{cert.confirmation_text}</p>
        </div>

        <div className="mt-8 flex items-end justify-between relative">
          <div className="text-xs text-slate-400">
            <p>本证明由企业内控合规测评平台出具</p>
            <p>证书编号可在平台验证，真实有效</p>
          </div>
          <div className="text-center">
            <div className="w-20 h-20 border-2 border-red-300 rounded-full flex items-center justify-center text-red-400 text-xs font-bold rotate-12">
              合规培训<br />专用章
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 text-xs text-slate-500">
        <p className="font-medium text-slate-700 mb-1">证据效力说明</p>
        <p>本学习证明关联完整的学习记录，包括：开始时间、完成时间、答题详情、考核成绩、电子签名（本人真实姓名）、签署时间戳及IP地址。记录一经签署不可篡改，可作为合规培训的有效证据保存和追溯。</p>
      </div>
    </div>
  );
}

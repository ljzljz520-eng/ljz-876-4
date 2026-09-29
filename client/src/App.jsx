import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import QuizList from './pages/QuizList';
import QuizTake from './pages/QuizTake';
import MyRecords from './pages/MyRecords';
import RecordDetail from './pages/RecordDetail';
import Certificate from './pages/Certificate';
import QuizManage from './pages/QuizManage';
import QuizEdit from './pages/QuizEdit';
import RecordsManage from './pages/RecordsManage';
import UserManage from './pages/UserManage';
import AuditLogs from './pages/AuditLogs';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-center text-slate-500">加载中...</div>;

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/quizzes" element={<QuizList />} />
        <Route path="/quizzes/:id/take" element={<QuizTake />} />
        <Route path="/my-records" element={<MyRecords />} />
        <Route path="/records/:id" element={<RecordDetail />} />
        <Route path="/certificate/:id" element={<Certificate />} />
        <Route path="/manage/quizzes" element={<ProtectedRoute roles={['admin', 'legal', 'audit']}><QuizManage /></ProtectedRoute>} />
        <Route path="/manage/quizzes/new" element={<ProtectedRoute roles={['admin', 'legal', 'audit']}><QuizEdit /></ProtectedRoute>} />
        <Route path="/manage/quizzes/:id/edit" element={<ProtectedRoute roles={['admin', 'legal', 'audit']}><QuizEdit /></ProtectedRoute>} />
        <Route path="/manage/records" element={<ProtectedRoute roles={['admin', 'legal', 'audit']}><RecordsManage /></ProtectedRoute>} />
        <Route path="/manage/users" element={<ProtectedRoute roles={['admin']}><UserManage /></ProtectedRoute>} />
        <Route path="/manage/audit" element={<ProtectedRoute roles={['admin', 'legal', 'audit']}><AuditLogs /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

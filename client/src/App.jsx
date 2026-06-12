import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import {
  Inventory, Movements, Returns, Projects, Materials, Engineers,
  Approvals, Categories, Users, Audit, Settings, ChangePassword,
  BatteryCollections, ProjectCosts
} from './pages/Pages';

function PrivateRoute({ children, requireSA=false }) {
  const { user, loading, isSA } = useAuth();
  if (loading) return <div style={{ padding:40,textAlign:'center',color:'var(--color-text-secondary)' }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requireSA && !isSA()) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
          <Route path="/movements" element={<PrivateRoute><Movements /></PrivateRoute>} />
          <Route path="/returns" element={<PrivateRoute><Returns /></PrivateRoute>} />
          <Route path="/projects" element={<PrivateRoute><Projects /></PrivateRoute>} />
          <Route path="/materials" element={<PrivateRoute><Materials /></PrivateRoute>} />
          <Route path="/engineers" element={<PrivateRoute><Engineers /></PrivateRoute>} />
          <Route path="/approvals" element={<PrivateRoute requireSA><Approvals /></PrivateRoute>} />
          <Route path="/categories" element={<PrivateRoute requireSA><Categories /></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute requireSA><Users /></PrivateRoute>} />
          <Route path="/audit" element={<PrivateRoute requireSA><Audit /></PrivateRoute>} />
          <Route path="/project-costs" element={<PrivateRoute><ProjectCosts /></PrivateRoute>} />
          <Route path="/battery-collections" element={<PrivateRoute><BatteryCollections /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/change-password" element={<PrivateRoute><ChangePassword /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

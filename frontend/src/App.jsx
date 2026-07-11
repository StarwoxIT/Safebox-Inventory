import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import QuoteEditor from './pages/QuoteEditor';
import QuoteHistory from './pages/QuoteHistory';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import StockMovements from './pages/StockMovements';
import Categories from './pages/Categories';
import Returns from './pages/Returns';
import BatteryCollections from './pages/BatteryCollections';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import ChangePassword from './pages/ChangePassword';
import Users from './pages/Users';
import CompanyProfile from './pages/CompanyProfile';
import AuditTrail from './pages/AuditTrail';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:projectId" element={<ProjectDetail />} />
        <Route path="projects/:projectId/quotes/new" element={<QuoteEditor />} />
        <Route path="quotes/:quoteId/edit" element={<QuoteEditor />} />
        <Route path="quotes/:quoteId/history" element={<QuoteHistory />} />
        <Route path="products" element={<Products />} />
        <Route path="products/:productId" element={<ProductDetail />} />
        <Route path="stock-movements" element={<StockMovements />} />
        <Route path="categories" element={<Categories />} />
        <Route path="returns" element={<Returns />} />
        <Route path="battery-collections" element={<BatteryCollections />} />
        <Route
          path="approvals"
          element={
            <ProtectedRoute roles={['super_admin']}>
              <Approvals />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<Settings />} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={['super_admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="company-profile"
          element={
            <ProtectedRoute roles={['admin', 'super_admin']}>
              <CompanyProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit-trail"
          element={
            <ProtectedRoute roles={['super_admin']}>
              <AuditTrail />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

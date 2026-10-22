import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectForm from './pages/ProjectForm';
import ProjectDetail from './pages/ProjectDetail';
import QuoteEditor from './pages/QuoteEditor';
import QuoteHistory from './pages/QuoteHistory';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import StockMovements from './pages/StockMovements';
import Categories from './pages/Categories';
import Returns from './pages/Returns';
import BatteryCollections from './pages/BatteryCollections';
import PaymentTracker from './pages/PaymentTracker';
import PaymentTrackerDetail from './pages/PaymentTrackerDetail';
import PaymentUpdate from './pages/PaymentUpdate';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import ChangePassword from './pages/ChangePassword';
import Users from './pages/Users';
import CompanyProfile from './pages/CompanyProfile';
import AuditTrail from './pages/AuditTrail';
import Reports from './pages/Reports';
import StockMovementReport from './pages/StockMovementReport';
import ProductReport from './pages/ProductReport';
import DocumentsList from './pages/DocumentsList';
import DocumentEditor from './pages/DocumentEditor';
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
        <Route path="projects" element={<ProtectedRoute departments={['engineering']}><Projects /></ProtectedRoute>} />
        <Route path="projects/new" element={<ProtectedRoute departments={['engineering']}><ProjectForm /></ProtectedRoute>} />
        <Route path="projects/:projectId" element={<ProtectedRoute departments={['engineering', 'finance']}><ProjectDetail /></ProtectedRoute>} />
        <Route path="projects/:projectId/quotes/new" element={<ProtectedRoute roles={['super_admin']}><QuoteEditor /></ProtectedRoute>} />
        <Route path="quotes/:quoteId/edit" element={<ProtectedRoute roles={['super_admin']}><QuoteEditor /></ProtectedRoute>} />
        <Route path="quotes/:quoteId/history" element={<ProtectedRoute roles={['super_admin']}><QuoteHistory /></ProtectedRoute>} />
        <Route path="products" element={<ProtectedRoute departments={['finance']}><Products /></ProtectedRoute>} />
        <Route path="products/:productId" element={<ProtectedRoute departments={['finance']}><ProductDetail /></ProtectedRoute>} />
        <Route path="stock-movements" element={<ProtectedRoute departments={['finance']}><StockMovements /></ProtectedRoute>} />
        <Route path="categories" element={<ProtectedRoute departments={['finance']}><Categories /></ProtectedRoute>} />
        <Route path="returns" element={<ProtectedRoute departments={['finance']}><Returns /></ProtectedRoute>} />
        <Route path="battery-collections" element={<ProtectedRoute departments={['finance']}><BatteryCollections /></ProtectedRoute>} />
        <Route
          path="payment-tracker"
          element={
            <ProtectedRoute departments={['finance']}>
              <PaymentTracker />
            </ProtectedRoute>
          }
        />
        <Route
          path="payment-tracker/:planId"
          element={
            <ProtectedRoute departments={['finance']}>
              <PaymentTrackerDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="payment-tracker/:planId/update"
          element={
            <ProtectedRoute departments={['finance']}>
              <PaymentUpdate />
            </ProtectedRoute>
          }
        />
        <Route
          path="approvals"
          element={
            <ProtectedRoute roles={['super_admin']}>
              <Approvals />
            </ProtectedRoute>
          }
        />
        <Route path="settings" element={<ProtectedRoute roles={['super_admin']}><Settings /></ProtectedRoute>} />
        <Route path="change-password" element={<ChangePassword />} />
        <Route
          path="users"
          element={
            <ProtectedRoute roles={['super_admin']}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route path="company-profile" element={<ProtectedRoute roles={['super_admin']}><CompanyProfile /></ProtectedRoute>} />
        <Route
          path="audit-trail"
          element={
            <ProtectedRoute roles={['super_admin']}>
              <AuditTrail />
            </ProtectedRoute>
          }
        />
        <Route path="reports" element={<ProtectedRoute departments={['finance']}><Reports /></ProtectedRoute>} />
        <Route path="reports/stock-movements" element={<ProtectedRoute departments={['finance']}><StockMovementReport /></ProtectedRoute>} />
        <Route path="reports/products" element={<ProtectedRoute departments={['finance']}><ProductReport /></ProtectedRoute>} />
        <Route path="invoices" element={<ProtectedRoute departments={['finance']}><DocumentsList docType="invoice" /></ProtectedRoute>} />
        <Route path="invoices/new" element={<ProtectedRoute departments={['finance']}><DocumentEditor docType="invoice" /></ProtectedRoute>} />
        <Route path="receipts" element={<ProtectedRoute departments={['finance']}><DocumentsList docType="receipt" /></ProtectedRoute>} />
        <Route path="receipts/new" element={<ProtectedRoute departments={['finance']}><DocumentEditor docType="receipt" /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

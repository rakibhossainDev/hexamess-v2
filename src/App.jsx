import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Lazy Load Components
const Login = lazy(() => import('./components/Login'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const DashboardHome = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.DashboardHome })));
const MemberDashboard = lazy(() => import('./components/MemberDashboard'));
const MealManagement = lazy(() => import('./components/MealManagement'));
const MarketExpense = lazy(() => import('./components/MarketExpense'));
const MemberList = lazy(() => import('./components/MemberList'));
const BazarManager = lazy(() => import('./components/BazarManager'));
const HistoryArchive = lazy(() => import('./components/HistoryArchive'));
const Settings = lazy(() => import('./components/Settings'));
const Profile = lazy(() => import('./components/Profile'));

// Loading Placeholder
const LoadingFallback = () => (
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'var(--bg-color)', color:'var(--text-primary)' }}>
    <p>লোড হচ্ছে...</p>
  </div>
);

/* ─── Route Guards ─── */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const userId = localStorage.getItem('hexamess-user-id');
  const role = localStorage.getItem('hexamess-user-role');
  const isAdmin = localStorage.getItem('hexamess-admin') === 'true';

  if (!userId) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // If manager, go to admin. If member, go to member.
    return <Navigate to={role === 'manager' ? "/admin" : "/member"} replace />;
  }

  return children;
};

const PublicGuard = ({ children }) => {
  const userId = localStorage.getItem('hexamess-user-id');
  const role = localStorage.getItem('hexamess-user-role');

  if (userId) {
    return <Navigate to={role === 'manager' ? "/admin" : "/member"} replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<PublicGuard><Login /></PublicGuard>} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['manager']}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="meals" element={<MealManagement />} />
            <Route path="market" element={<BazarManager />} />
            <Route path="expenses" element={<MarketExpense />} />
            <Route path="members" element={<MemberList />} />
            <Route path="members/:id" element={<Profile isAdminView={true} />} />
            <Route path="history" element={<HistoryArchive />} />
            <Route path="settings" element={<Settings />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Protected Member Routes */}
          <Route
            path="/member"
            element={
              <ProtectedRoute allowedRoles={['member', 'manager']}>
                <MemberDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/member/profile" element={<ProtectedRoute allowedRoles={['member', 'manager']}><Profile /></ProtectedRoute>} />
          <Route path="/member/meals" element={<ProtectedRoute allowedRoles={['member', 'manager']}><MemberDashboard /></ProtectedRoute>} />
          <Route path="/member/market" element={<ProtectedRoute allowedRoles={['member', 'manager']}><MemberDashboard /></ProtectedRoute>} />
          <Route path="/member/history" element={<ProtectedRoute allowedRoles={['member', 'manager']}><HistoryArchive /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

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
const MarketManager = lazy(() => import('./components/MarketManager'));
const HistoryArchive = lazy(() => import('./components/HistoryArchive'));
const Settings = lazy(() => import('./components/Settings'));
const Profile = lazy(() => import('./components/Profile'));

// Loading Placeholder
const LoadingFallback = () => (
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'var(--bg-color)', color:'var(--text-primary)' }}>
    <p>লোড হচ্ছে...</p>
  </div>
);

/* ─── Admin Route Guard ─── */
const AdminGuard = ({ children }) => {
  const isAdmin = localStorage.getItem('hexamess-admin') === 'true';
  const role = localStorage.getItem('hexamess-user-role');
  
  // Super-admin check or manager role check
  if (!isAdmin || role !== 'manager') {
    return <Navigate to="/" replace />;
  }
  return children;
};

/* ─── Member Route Guard ─── */
const MemberGuard = ({ children }) => {
  const userId = localStorage.getItem('hexamess-user-id');
  if (!userId) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Login />} />

          {/* Protected Admin Routes */}
          <Route
            path="/admin"
            element={
              <AdminGuard>
                <AdminDashboard />
              </AdminGuard>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="meals" element={<MealManagement />} />
            <Route path="market" element={<MarketManager />} />
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
              <MemberGuard>
                <MemberDashboard />
              </MemberGuard>
            }
          />
          <Route path="/member/profile" element={<MemberGuard><Profile /></MemberGuard>} />
          {/* We can expand member routes if needed, but for now it's a single dashboard */}
          <Route path="/member/meals" element={<MemberGuard><MemberDashboard /></MemberGuard>} />
          <Route path="/member/market" element={<MemberGuard><MemberDashboard /></MemberGuard>} />
          <Route path="/member/history" element={<MemberGuard><HistoryArchive /></MemberGuard>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;

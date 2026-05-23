import { lazy, Suspense, useState, useEffect, createContext, useContext } from 'react';
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
const DepositManager = lazy(() => import('./components/DepositManager'));

// Loading Placeholder
const LoadingFallback = () => (
  <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100vh', background:'var(--bg-color)', color:'var(--text-primary)' }}>
    <p>লোড হচ্ছে...</p>
  </div>
);

/* ─── Auth Context & Provider ─── */
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const savedUserJson = localStorage.getItem('hexa_user');
      if (savedUserJson) {
        try {
          const user = JSON.parse(savedUserJson);
          setCurrentUser(user);
          setUserRole(user.role || 'member');
        } catch (e) {
          console.error("Auth Parsing Error:", e);
          setCurrentUser(null);
          setUserRole(null);
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setAuthLoading(false);
    };

    checkAuth();
    window.addEventListener('storage', checkAuth);
    return () => window.removeEventListener('storage', checkAuth);
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

/* ─── Route Guards ─── */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const savedUserJson = localStorage.getItem('hexa_user');
  
  if (!savedUserJson) {
    return <Navigate to="/" replace />;
  }

  let user = null;
  try {
    user = JSON.parse(savedUserJson);
  } catch (e) {
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const userRole = user.role;

  if (allowedRoles && (!userRole || !allowedRoles.includes(userRole))) {
    return <Navigate to={userRole === 'manager' || userRole === 'admin' ? "/admin" : "/dashboard"} replace />;
  }

  return children;
};

const PublicGuard = ({ children }) => {
  const savedUserJson = localStorage.getItem('hexa_user');

  if (savedUserJson) {
    let user = null;
    try {
      user = JSON.parse(savedUserJson);
    } catch (e) {}

    if (user) {
      const userRole = user.role;
      return <Navigate to={userRole === 'manager' || userRole === 'admin' ? "/admin" : "/dashboard"} replace />;
    }
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<PublicGuard><Login /></PublicGuard>} />

            {/* Protected Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={['manager', 'admin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              <Route path="meals" element={<MealManagement />} />
              <Route path="market" element={<BazarManager />} />
              <Route path="expenses" element={<MarketExpense />} />
              <Route path="deposits" element={<DepositManager />} />
              <Route path="members" element={<MemberList />} />
              <Route path="members/:id" element={<Profile isAdminView={true} />} />
              <Route path="history" element={<HistoryArchive />} />
              <Route path="settings" element={<Settings />} />
              <Route path="profile" element={<Profile />} />
            </Route>

            {/* Protected Member Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute allowedRoles={['member', 'manager']}>
                  <MemberDashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/dashboard/profile" element={<ProtectedRoute allowedRoles={['member', 'manager']}><Profile /></ProtectedRoute>} />
            <Route path="/dashboard/meals" element={<ProtectedRoute allowedRoles={['member', 'manager']}><MemberDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/market" element={<ProtectedRoute allowedRoles={['member', 'manager']}><MemberDashboard /></ProtectedRoute>} />
            <Route path="/dashboard/history" element={<ProtectedRoute allowedRoles={['member', 'manager']}><HistoryArchive /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;

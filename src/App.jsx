import { lazy, Suspense, useState, useEffect, createContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Lazy Load Components
const Login = lazy(() => import('./components/Login'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const DashboardHome = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.DashboardHome })));
const MemberDashboard = lazy(() => import('./components/UserDashboard'));
const MealManagement = lazy(() => import('./components/MealManagement'));
const FixedExpenses = lazy(() => import('./components/FixedExpenses'));
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

  let user;
  try {
    user = JSON.parse(savedUserJson);
  } catch (error) {
    console.error(error);
    return <Navigate to="/" replace />;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  const userRole = user.username === 'manager' ? 'manager' : 'member';

  if (allowedRoles && (!userRole || !allowedRoles.includes(userRole))) {
    return <Navigate to={userRole === 'manager' ? "/admin" : "/dashboard"} replace />;
  }

  return children;
};

const PublicGuard = ({ children }) => {
  const savedUserJson = localStorage.getItem('hexa_user');

  if (savedUserJson) {
    let user;
    try {
      user = JSON.parse(savedUserJson);
    } catch (error) {
      console.error(error);
    }

    if (user) {
      const userRole = user.username === 'manager' ? 'manager' : 'member';
      return <Navigate to={userRole === 'manager' ? "/admin" : "/dashboard"} replace />;
    }
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <div className="fixed top-[-10%] right-[-5%] w-72 h-72 bg-cyan-500/20 dark:bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] left-[-5%] w-72 h-72 bg-purple-500/10 dark:bg-purple-500/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <Router>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public */}
            <Route path="/" element={<PublicGuard><Login /></PublicGuard>} />
            <Route path="/login" element={<PublicGuard><Login /></PublicGuard>} />

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
              <Route path="expenses" element={<FixedExpenses />} />
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
            <Route path="/dashboard/meals" element={<ProtectedRoute allowedRoles={['member', 'manager']}><MealManagement /></ProtectedRoute>} />
            <Route path="/dashboard/market" element={<ProtectedRoute allowedRoles={['member', 'manager']}><BazarManager /></ProtectedRoute>} />
            <Route path="/dashboard/expenses" element={<ProtectedRoute allowedRoles={['member', 'manager']}><FixedExpenses /></ProtectedRoute>} />
            <Route path="/dashboard/deposits" element={<ProtectedRoute allowedRoles={['member', 'manager']}><DepositManager /></ProtectedRoute>} />
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

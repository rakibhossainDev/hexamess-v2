import { lazy, Suspense, useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { auth, db, doc, getDoc } from './utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';

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

/* ─── Auth Context & Provider ─── */
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Fetch role from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          } else {
            setUserRole('member'); // Default fallback
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole('member');
        }
      } else {
        setCurrentUser(null);
        setUserRole(null);
      }
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, userRole, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

/* ─── Route Guards ─── */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole, authLoading } = useAuth();

  if (authLoading) return <LoadingFallback />;

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && (!userRole || !allowedRoles.includes(userRole))) {
    return <Navigate to={userRole === 'manager' || userRole === 'admin' ? "/admin" : "/dashboard"} replace />;
  }

  return children;
};

const PublicGuard = ({ children }) => {
  const { currentUser, userRole, authLoading } = useAuth();

  if (authLoading) return <LoadingFallback />;

  if (currentUser) {
    // If we have a user but role is not loaded yet, wait.
    if (!userRole) return <LoadingFallback />;
    return <Navigate to={userRole === 'manager' || userRole === 'admin' ? "/admin" : "/dashboard"} replace />;
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

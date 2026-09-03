// Firestore Rules: set to 'allow read, write: if true;' for testing if you see permission errors.
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import {
  db, collection, doc, onSnapshot, query, where, writeBatch, serverTimestamp, increment, getDocs
} from '../utils/firebase';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import BottomNav from './BottomNav';

const MealManagement = () => {
  const currentUser = JSON.parse(localStorage.getItem('hexa_user') || '{}');
  const isManagerUser = currentUser?.username === 'manager';
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  const [members, setMembers] = useState([]);
  const [inputMeals, setInputMeals] = useState({}); 
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toasts, showToast, removeToast } = useToast();

  // 1. Uniform Date Handling (DD-MM-YYYY)
  const { docIdDate, monthYear } = useMemo(() => {
    if (!selectedDate) return { docIdDate: '', monthYear: '' };
    const [y, m, d] = selectedDate.split('-');
    return {
      docIdDate: `${d}-${m}-${y}`,
      monthYear: `${m}-${y}`
    };
  }, [selectedDate]);

  // 2. Real-time Listeners (Members Sync)
  useEffect(() => {
    if (!db) return;
    
    const safetyTimeout = setTimeout(() => setLoading(false), 3000);

    // Member List Sync
    const unsubMembers = onSnapshot(collection(db, 'users'), (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      clearTimeout(safetyTimeout);
    });

    return () => {
      unsubMembers();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // 3. Real-time Date-specific Sync (Pre-fill dropdowns)
  useEffect(() => {
    if (!db || !selectedDate) return;

    // Use selectedDate (YYYY-MM-DD) for the date query as it's the standard format for sorting
    const q = query(collection(db, 'daily_meals'), where('date', '==', selectedDate));
    
    const unsubSelectedDate = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setInputMeals({});
        return;
      }
      
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.memberId) {
          mealsMap[data.memberId] = Number(data.count || 0);
        }
      });
      setInputMeals(mealsMap);
    });

    return () => unsubSelectedDate();
  }, [selectedDate]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  const currentTotal = useMemo(() => Object.values(inputMeals).reduce((s, v) => s + v, 0), [inputMeals]);

  const handleMealChange = (memberId, value) => {
    setInputMeals(prev => ({ ...prev, [memberId]: Number(value) }));
  };

  // 4. Unified Save Operation with Global Total Sync
  const handleSaveAll = async () => {
    if (!db || saving) return;
    setSaving(true);
    
    try {
      // 1. Fetch the exact previous state for this date first
      const prevQuery = query(collection(db, 'daily_meals'), where('date', '==', selectedDate));
      const prevSnap = await getDocs(prevQuery);
      const previousData = {};
      prevSnap.docs.forEach(d => {
        const data = d.data();
        if (data.memberId) {
          previousData[data.memberId] = Number(data.count || 0);
        }
      });

      const batch = writeBatch(db);
      
      activeMembers.forEach(member => {
        const newMeal = Number(inputMeals[member.id] || 0);
        const oldMeal = Number(previousData[member.id] || 0);
        const diff = newMeal - oldMeal;
        
        // UNIFIED ID PATTERN: ${memberId}_${DD-MM-YYYY}
        const mealDocId = `${member.id}_${docIdDate}`;
        const mealRef = doc(db, 'daily_meals', mealDocId);

        // Update the daily document
        batch.set(mealRef, {
          memberId: member.id,
          date: selectedDate,      // YYYY-MM-DD for correct sorting in MemberDashboard
          monthYear: monthYear, // MM-YYYY
          count: newMeal,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Safely increment the user's running total if it changed
        if (diff !== 0) {
          batch.update(doc(db, 'users', member.id), {
            total_meals: increment(diff)
          });
        }
      });

      await batch.commit();
      showToast("তথ্য সেভ হয়েছে, বস!", "success");
    } catch (error) {
      console.error("Save Error:", error);
      alert("সেভ হয়নি! এরর: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const renderContent = () => (
    <div className="fade-in">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="card glass-card bg-white border border-slate-100 shadow-sm rounded-xl p-5" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ color: 'var(--accent-blue)', marginBottom: '0.25rem' }}>
              {isManagerUser ? 'ম্যানেজ ডেইলি মিল' : 'মিল হিসেব ও ইতিহাস'}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              তারিখ: <span style={{ color: 'var(--accent-orange)', fontWeight: '600' }}>{formatDisplayDate(selectedDate)}</span>
            </p>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input 
              type="date" 
              className="form-control" 
              value={selectedDate} 
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: '180px' }}
            />
          </div>
        </div>
      </div>

      <div className="card glass-card">
        {/* Mobile View (Cards) */}
        <div className="block md:hidden space-y-4">
          {activeMembers.map(member => (
            <div key={member.id} className="bg-[var(--surface-color)] p-4 rounded-xl border border-[var(--border-color)] shadow-sm flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0">
                  <div className="absolute inset-0 w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300 flex items-center justify-center font-bold">
                    {member.name.charAt(0)}
                  </div>
                  {member.photoURL && (
                    <img 
                      src={member.photoURL} 
                      alt={member.name} 
                      className="absolute inset-0 w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0 rounded-full object-cover border border-cyan-500 z-10 bg-[var(--surface-color)]" 
                      onError={(e) => e.target.style.display = 'none'}
                    />
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[var(--text-primary)]">{member.name}</div>
                  <div className="text-xs text-[var(--text-secondary)]">@{member.username}</div>
                </div>
                <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-700 rounded-full">{Number(member.total_meals) || 0}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[var(--border-color)] pt-3 mt-1">
                <span className="text-sm font-medium">আজকের মিল:</span>
                {isManagerUser ? (
                  <select 
                    className="form-control bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block px-4 py-2 shadow-sm cursor-pointer hover:border-emerald-400 transition-all" 
                    value={inputMeals[member.id] || 0}
                    onChange={(e) => handleMealChange(member.id, e.target.value)}
                    style={{ width: '80px' }}
                  >
                    {[0, 1, 2, 3, 4, 5].map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                ) : (
                  <span className="badge badge-orange" style={{ fontSize: '0.9rem', padding: '0.25rem 0.75rem', fontWeight: 'bold' }}>
                    {inputMeals[member.id] || 0} টি
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View (Grid Layout) */}
        <div className="hidden md:block w-full max-w-5xl mx-auto">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-4 items-center w-full uppercase tracking-wider text-xs font-semibold text-slate-500 pb-4 border-b border-slate-200 px-2">
            <div className="col-span-6">মেম্বার প্রোফাইল</div>
            <div className="col-span-3 text-center">মোট মিল (চলমান)</div>
            <div className="col-span-3 flex justify-end">মিল ইনপুট</div>
          </div>

          {/* Member Rows */}
          <div className="flex flex-col mt-2">
            {activeMembers.map(member => (
              <div key={member.id} className="grid grid-cols-12 gap-4 items-center w-full py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors duration-150 px-2 rounded-lg">
                
                {/* Profile Section */}
                <div className="col-span-6 flex items-center gap-3">
                  <div className="relative w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0">
                    <div className="absolute inset-0 w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300 flex items-center justify-center font-bold">
                      {member.name.charAt(0)}
                    </div>
                    {member.photoURL && (
                      <img 
                        src={member.photoURL} 
                        alt={member.name} 
                        className="absolute inset-0 w-12 h-12 md:w-14 md:h-14 min-w-[48px] min-h-[48px] flex-shrink-0 rounded-full object-cover border border-cyan-500 z-10 bg-[var(--surface-color)]" 
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">{member.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">@{member.username}</div>
                  </div>
                </div>

                {/* Total Meals Section */}
                <div className="col-span-3 flex justify-center">
                  <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-700 rounded-full">
                    {Number(member.total_meals) || 0}
                  </span>
                </div>

                {/* Meal Input Section */}
                <div className="col-span-3 flex justify-end">
                  {isManagerUser ? (
                    <select 
                      className="form-control bg-white border border-slate-300 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 block px-4 py-2 shadow-sm cursor-pointer hover:border-emerald-400 transition-all" 
                      value={inputMeals[member.id] || 0}
                      onChange={(e) => handleMealChange(member.id, e.target.value)}
                      style={{ width: '100px' }}
                    >
                      {[0, 1, 2, 3, 4, 5].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="badge badge-orange" style={{ fontSize: '0.9rem', padding: '0.25rem 0.75rem', fontWeight: 'bold' }}>
                      {inputMeals[member.id] || 0} টি
                    </span>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>

        <div style={{ 
          marginTop: '2rem', 
          padding: '1.5rem', 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>নির্বাচিত তারিখের মোট মিল</p>
            <span style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--accent-orange)' }}>{currentTotal} টি</span>
          </div>
          {isManagerUser && (
            <button 
              className="btn btn-primary" 
              onClick={handleSaveAll}
              disabled={saving}
              style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
            >
              {saving ? 'সেভ হচ্ছে...' : 'সব মিল সেভ করুন'}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '50vh', flexDirection: 'column', gap: '1rem' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)' }}>মেম্বার ডাটা লোড হচ্ছে...</p>
      </div>
    );
  }

  if (isAdminPath) {
    return renderContent();
  }

  return (
    <div className="app-layout" style={{ fontFamily: "'Hind Siliguri', sans-serif" }}>
      <Sidebar isManager={isManagerUser} />
      <main className="main-content" style={{ padding: '0 0 80px 0', flex: 1 }}>
        <Navbar userName={currentUser?.name} userRole={isManagerUser ? 'ম্যানেজার' : 'সদস্য'} photoURL={currentUser?.photoURL} />
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {renderContent()}
        </div>
      </main>
      <BottomNav isManager={isManagerUser} />
    </div>
  );
};

export default MealManagement;

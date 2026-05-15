// Firestore Rules: set to 'allow read, write: if true;' for testing if you see permission errors.
import { useState, useEffect, useMemo } from 'react';
import {
  db, collection, doc, onSnapshot, query, where, writeBatch, serverTimestamp
} from '../utils/firebase';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from './Toast';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [inputMeals, setInputMeals] = useState({}); 
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lifetimeMeals, setLifetimeMeals] = useState({}); // Aggregated totals per member
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

  // 2. Real-time Listeners (Members, Config, Lifetime Totals)
  useEffect(() => {
    if (!db) return;
    
    setLoading(true);
    const safetyTimeout = setTimeout(() => setLoading(false), 3000);

    // Member List Sync
    const unsubMembers = onSnapshot(collection(db, 'users'), (snap) => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      clearTimeout(safetyTimeout);
    });

    // System Config Sync
    const unsubConfig = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });

    // Lifetime Meal Aggregation (Unified from daily_meals)
    const unsubLifetime = onSnapshot(collection(db, 'daily_meals'), (snap) => {
      const totals = snap.docs.reduce((acc, d) => {
        const data = d.data();
        if (data.memberId) {
          const count = Number(data.count || 0);
          acc[data.memberId] = (acc[data.memberId] || 0) + count;
        }
        return acc;
      }, {});
      setLifetimeMeals(totals);
    });

    return () => {
      unsubMembers();
      unsubConfig();
      unsubLifetime();
      clearTimeout(safetyTimeout);
    };
  }, []);

  // 3. Real-time Date-specific Sync (Pre-fill dropdowns)
  useEffect(() => {
    if (!db || !docIdDate) return;

    const unsubSelectedDate = onSnapshot(
      query(collection(db, 'daily_meals'), where('date', '==', docIdDate)),
      (snap) => {
        const mealsMap = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.memberId) mealsMap[data.memberId] = Number(data.count || 0);
        });
        setInputMeals(mealsMap);
      }
    );

    return () => unsubSelectedDate();
  }, [docIdDate]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  const currentTotal = useMemo(() => Object.values(inputMeals).reduce((s, v) => s + v, 0), [inputMeals]);

  const handleMealChange = (memberId, value) => {
    setInputMeals(prev => ({ ...prev, [memberId]: Number(value) }));
  };

  // 4. Unified Save Operation
  const handleSaveAll = async () => {
    if (!db || saving) return;
    setSaving(true);
    const batch = writeBatch(db);
    
    try {
      activeMembers.forEach(member => {
        const count = Number(inputMeals[member.id] || 0);
        
        // UNIFIED ID PATTERN: ${memberId}_${DD-MM-YYYY}
        const mealDocId = `${member.id}_${docIdDate}`;
        const mealRef = doc(db, 'daily_meals', mealDocId);

        batch.set(mealRef, {
          memberId: member.id,
          date: docIdDate,      // DD-MM-YYYY
          monthYear: monthYear, // MM-YYYY
          count: count,
          updatedAt: serverTimestamp()
        }, { merge: true });
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

  if (loading) return (
    <div className="flex-center" style={{ height: '50vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="spinner" />
      <p style={{ color: 'var(--text-secondary)' }}>মেম্বার ডাটা লোড হচ্ছে...</p>
    </div>
  );

  return (
    <div className="fade-in">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="card glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ color: 'var(--accent-blue)', marginBottom: '0.25rem' }}>ম্যানেজ ডেইলি মিল</h2>
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
                <div className="avatar flex-shrink-0">{member.name[0]}</div>
                <div className="flex-1">
                  <div className="font-semibold text-[var(--text-primary)]">{member.name}</div>
                  <div className="text-xs text-[var(--text-secondary)]">@{member.username}</div>
                </div>
                <span className="badge badge-blue whitespace-nowrap text-xs">মোট: {lifetimeMeals[member.id] || 0}</span>
              </div>
              <div className="flex justify-between items-center border-t border-[var(--border-color)] pt-3 mt-1">
                <span className="text-sm font-medium">আজকের মিল:</span>
                <select 
                  className="form-control" 
                  value={inputMeals[member.id] || 0}
                  onChange={(e) => handleMealChange(member.id, e.target.value)}
                  style={{ width: '80px', minHeight: '36px', padding: '0.25rem 0.5rem' }}
                >
                  {[0, 0.5, 1, 1.5, 2, 2.5, 3].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View (Table) */}
        <div className="hidden md:block table-container">
          <table className="meal-table">
            <thead>
              <tr>
                <th>মেম্বার প্রোফাইল</th>
                <th style={{ textAlign: 'center' }}>মোট মিল (লাইফটাইম)</th>
                <th style={{ textAlign: 'right', width: '150px' }}>মিল ইনপুট</th>
              </tr>
            </thead>
            <tbody>
              {activeMembers.map(member => (
                <tr key={member.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar">{member.name[0]}</div>
                      <div>
                        <div style={{ fontWeight: '600' }}>{member.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{member.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-blue">মোট: {lifetimeMeals[member.id] || 0}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <select 
                      className="form-control" 
                      value={inputMeals[member.id] || 0}
                      onChange={(e) => handleMealChange(member.id, e.target.value)}
                      style={{ width: '100px', marginLeft: 'auto' }}
                    >
                      {[0, 0.5, 1, 1.5, 2, 2.5, 3].map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
          <button 
            className="btn btn-primary" 
            onClick={handleSaveAll}
            disabled={saving}
            style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
          >
            {saving ? 'সেভ হচ্ছে...' : 'সব মিল সেভ করুন'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MealManagement;

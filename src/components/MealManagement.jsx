// Firestore Rules: set to 'allow read, write: if true;' for testing if you see permission errors.
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  db, collection, doc, onSnapshot, query, where, writeBatch, setDoc, serverTimestamp, getDocs
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
  const [lifetimeMeals, setLifetimeMeals] = useState({}); // Stores lifetime total per member
  const { toasts, showToast, removeToast } = useToast();

  // Format date to DD/MM/YYYY for Firestore Document IDs
  const docIdDate = useMemo(() => {
    if (!selectedDate) return '';
    const [y, m, d] = selectedDate.split('-');
    return `${d}/${m}/${y}`;
  }, [selectedDate]);

  // 3. Persistence: Fetch saved meals for selected date
  const fetchSavedMeals = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    
    // Safety timeout for loading state
    const timeout = setTimeout(() => setLoading(false), 5000);

    try {
      const q = query(collection(db, 'daily_meals'), where('date', '==', docIdDate));
      const snap = await getDocs(q);
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.memberId) mealsMap[data.memberId] = Number(data.count) || 0;
      });
      
      console.log(`Fetched ${snap.size} meal records for ${docIdDate}`);
      setInputMeals(mealsMap);
      clearTimeout(timeout);
    } catch (error) {
      console.error("Fetch Meals Error:", error);
    } finally {
      setLoading(false);
    }
  }, [docIdDate]);

  useEffect(() => {
    if (!db) return;
    
    setLoading(true);
    // Timeout Safety: Force loading to false after 3 seconds
    const safetyTimeout = setTimeout(() => setLoading(false), 3000);

    const unsubMembers = onSnapshot(collection(db, 'users'), 
      (snap) => {
        if (snap.empty) {
          console.warn("Users collection is empty!");
          setMembers([]);
        } else {
          setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        setLoading(false);
        clearTimeout(safetyTimeout);
      },
      (error) => {
        console.error("Error fetching users:", error);
        alert("ইউজার ডাটা লোড করতে সমস্যা হয়েছে। এরর: " + error.message);
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    );

    const unsubConfig = onSnapshot(doc(db, 'config', 'settings'), 
      (snap) => {
        if (snap.exists()) setConfig(snap.data());
      },
      (error) => {
        console.error("Error fetching config:", error);
      }
    );

    // Lifetime Meal Aggregation Listener
    const unsubLifetime = onSnapshot(collection(db, 'daily_meals'), 
      (snap) => {
        const totals = {};
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.memberId) {
            totals[data.memberId] = (totals[data.memberId] || 0) + (Number(data.count) || 0);
          }
        });
        setLifetimeMeals(totals);
      },
      (error) => {
        console.error("Error fetching lifetime meals:", error);
      }
    );

    return () => { 
      unsubMembers(); 
      unsubConfig(); 
      unsubLifetime();
      clearTimeout(safetyTimeout);
    };
  }, []);

  useEffect(() => {
    fetchSavedMeals();
  }, [fetchSavedMeals]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  
  const currentTotal = useMemo(() => {
    return Object.values(inputMeals).reduce((s, v) => s + v, 0);
  }, [inputMeals]);

  const handleMealChange = (memberId, value) => {
    setInputMeals(prev => ({ ...prev, [memberId]: Number(value) }));
  };

  // 1 & 2. Robust Batch Save & Sync System
  const handleSaveAll = async () => {
    if (!db || saving) return;
    
    // Fallback month ID if config is missing
    const currentMonthId = config?.current_month_id || selectedDate.substring(0, 7);

    setSaving(true);
    const batch = writeBatch(db);
    
    try {
      const activeMembers = members.filter(m => m.status === 'active');
      let totalSum = 0;

      activeMembers.forEach(member => {
        const countValue = inputMeals[member.id] || 0;
        const count = Number(countValue); // Ensure 'count' is saved as a Number
        totalSum += count;

        // Doc ID Format: meal_${memberId}_${docIdDate} (DD/MM/YYYY)
        const mealDocId = `meal_${member.id}_${docIdDate}`;
        const mealRef = doc(db, 'daily_meals', mealDocId);

        batch.set(mealRef, {
          memberId: member.id,
          date: docIdDate,
          count: count,
          month_id: currentMonthId,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      
      showToast("তথ্য সেভ হয়েছে, বস!", "success");
      // All totals (Lifetime, Today, Monthly) are automated via Firestore listeners!
    } catch (error) {
      console.error("Batch Save Error:", error);
      alert("সেভ হয়নি! এরর: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>🍽️ মিল ম্যানেজমেন্ট (Robust Sync)</h2>
        <div className="form-group" style={{ margin: 0 }}>
          <input 
            type="date" 
            className="form-control" 
            value={selectedDate} 
            onChange={(e) => setSelectedDate(e.target.value)} 
            style={{ width: 'auto', background: '#111', color: '#fff', border: '1px solid #333' }}
          />
        </div>
      </div>

      <div className="card glass-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--accent-blue)' }}>মেম্বার তালিকা ({formatDisplayDate(selectedDate)})</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>প্রতি মেম্বারের মিল ড্রপডাউন থেকে সিলেক্ট করুন</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>ইনপুটকৃত মোট মিল</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-blue)' }}>{currentTotal} টি</div>
          </div>
        </div>

        {loading && activeMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#666' }}>
            লোড হচ্ছে...
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#000', color: '#888', fontSize: '0.9rem', textAlign: 'left' }}>
                  <th style={{ padding: '1rem' }}>সদস্য</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>মিল (০-৫)</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ padding: '4rem', textAlign: 'center', color: '#666' }}>
                      কোন মেম্বার পাওয়া যায়নি
                    </td>
                  </tr>
                ) : (
                  activeMembers.map(member => (
                    <tr key={member.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#fff' }}>{member.name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#666' }}>@{member.username}</div>
                        </div>
                        <div style={{ 
                          padding: '0.25rem 0.6rem', background: 'rgba(30, 58, 138, 0.3)', 
                          color: '#60a5fa', borderRadius: '6px', fontSize: '0.75rem', 
                          fontWeight: '700', border: '1px solid rgba(96, 165, 250, 0.2)' 
                        }}>
                          মোট মিল: {lifetimeMeals[member.id] || 0}
                        </div>
                      </div>
                    </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <select 
                          className="form-control"
                          style={{ 
                            width: '85px', margin: '0 auto', background: '#000', color: '#fff', 
                            border: '1px solid #444', fontWeight: '800', textAlign: 'center'
                          }}
                          value={inputMeals[member.id] ?? 0}
                          onChange={(e) => handleMealChange(member.id, e.target.value)}
                        >
                          {[0, 1, 2, 3, 4, 5].map(v => (
                            <option key={v} value={v}>{v}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary meal-save-btn"
            disabled={saving || loading || activeMembers.length === 0}
            onClick={handleSaveAll}
            style={{ 
              width: '100%', maxWidth: '320px', padding: '1.1rem', borderRadius: '12px', fontSize: '1rem', 
              fontWeight: '800', transition: 'all 0.15s ease', boxShadow: '0 4px 25px rgba(0,0,0,0.4)'
            }}
          >
            {saving ? 'সেভ হচ্ছে...' : '💾 আজকের সব মিল সেভ করুন'}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .meal-save-btn:active { transform: scale(0.96); }
        .meal-save-btn:hover:not(:disabled) { background: #1d4ed8; box-shadow: 0 6px 30px rgba(29, 78, 216, 0.3); }
        .glass-card { background: rgba(18, 18, 18, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); }
      `}} />
    </div>
  );
};

export default MealManagement;

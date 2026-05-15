import { useState, useEffect, useMemo } from 'react';
import {
  db, collection, doc, onSnapshot, query, where, writeBatch, setDoc, serverTimestamp
} from '../firebase';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [inputMeals, setInputMeals] = useState({}); 
  const [dbMeals, setDbMeals] = useState({});       
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Format YYYY-MM-DD to DD-MM-YYYY for Document IDs
  const docIdDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-');
    return `${d}-${m}-${y}`;
  }, [selectedDate]);

  // 1. Resilient Member Fetching
  useEffect(() => {
    if (!db) return;
    const unsubMembers = onSnapshot(collection(db, 'users'), snap => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMembers(users);
      clearTimeout(loadTimeout);
      setLoading(false);
    }, (error) => {
      console.error("Fetch Members Error:", error);
      setLoading(false);
    });

    const unsubConfig = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) {
        setConfig(snap.data());
      }
    });

    return () => { unsubMembers(); unsubConfig(); clearTimeout(loadTimeout); };
  }, []);

  // 2. Meal Fetching & Persistence
  useEffect(() => {
    if (!db) return;
    
    const loadTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsubMeals = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('date', '==', docIdDate)
    ), snap => {
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.memberId) {
          mealsMap[data.memberId] = Number(data.count) || 0;
        }
      });
      setDbMeals(mealsMap);
      setInputMeals(mealsMap);
      clearTimeout(loadTimeout);
      setLoading(false);
    }, (error) => {
      console.error("Fetch Meals Error:", error);
      setLoading(false);
    });

    return () => { unsubMeals(); clearTimeout(loadTimeout); };
  }, [docIdDate]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  
  const todayTotal = useMemo(() => {
    return Object.values(inputMeals).reduce((s, v) => s + v, 0);
  }, [inputMeals]);

  const handleMealChange = (memberId, value) => {
    setInputMeals(prev => ({ ...prev, [memberId]: Number(value) }));
  };

  const handleSaveAll = async () => {
    if (!db || saving) return;
    
    // Non-blocking check for config
    if (!config) {
      showToast('সিস্টেম কনফিগ পাওয়া যায়নি। পরে আবার চেষ্টা করুন।', 'error');
      return;
    }
    
    setSaving(true);
    const batch = writeBatch(db);

    try {
      let calculatedTotal = 0;

      activeMembers.forEach(member => {
        const count = Number(inputMeals[member.id] || 0);
        calculatedTotal += count;

        const mealDocId = `meal_${member.id}_${docIdDate}`;
        const mealRef = doc(db, 'daily_meals', mealDocId);

        batch.set(mealRef, {
          memberId: member.id,
          date: docIdDate,
          count: count,
          month_id: config.current_month_id,
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      // SYNC WITH DASHBOARD: Update meal_summaries
      const summaryRef = doc(db, 'meal_summaries', docIdDate);
      batch.set(summaryRef, {
        date: docIdDate,
        totalMeals: calculatedTotal,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      alert("তথ্য সেভ হয়েছে, বস!");
    } catch (error) {
      console.error("Meal Save Error:", error);
      alert("বস, তথ্য সেভ হয়নি! " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', fontFamily: "'Hind Siliguri', sans-serif" }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>🍽️ মিল ম্যানেজমেন্ট</h2>
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

      <div className="card glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--accent-blue)' }}>মেম্বার তালিকা ({formatDisplayDate(selectedDate)})</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>সঠিক মিল ইনপুট দিয়ে সেভ করুন</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>আজকের মোট মিল</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-blue)' }}>{todayTotal} টি</div>
          </div>
        </div>

        {loading && activeMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#666' }}>মেম্বার তালিকা লোড হচ্ছে...</div>
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#000', color: '#888', fontSize: '0.9rem', textAlign: 'left' }}>
                  <th style={{ padding: '1rem' }}>মেম্বার নাম</th>
                  <th style={{ padding: '1rem', textAlign: 'center' }}>মিল সংখ্যা (০-৫)</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map(member => (
                  <tr key={member.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: '#fff' }}>{member.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>@{member.username}</div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <select 
                        className="form-control"
                        style={{ 
                          width: '80px', margin: '0 auto', background: '#000', color: '#fff', 
                          border: '1px solid #333', fontWeight: '800', textAlign: 'center'
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
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary meal-save-btn"
            disabled={saving || activeMembers.length === 0}
            onClick={handleSaveAll}
            style={{ 
              width: '280px', padding: '1.1rem', borderRadius: '12px', fontSize: '1rem', 
              fontWeight: '800', transition: 'transform 0.15s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
            }}
          >
            {saving ? 'সেভ হচ্ছে...' : '💾 আজকের সব মিল সেভ করুন'}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes spin { to { transform: rotate(360deg); } }
        .meal-save-btn:active { transform: scale(0.95); }
        .meal-save-btn:hover:not(:disabled) { background: #1d4ed8; filter: brightness(1.2); }
        .glass-card { background: rgba(18, 18, 18, 0.7); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.06); }
      `}} />
    </div>
  );
};

export default MealManagement;

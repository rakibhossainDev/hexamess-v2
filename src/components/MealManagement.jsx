import { useState, useEffect, useMemo } from 'react';
import {
  db, collection, doc, onSnapshot, query, where, writeBatch, setDoc, serverTimestamp
} from '../firebase';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [inputMeals, setInputMeals] = useState({}); // Local state for dropdowns
  const [dbMeals, setDbMeals] = useState({});       // Verified database state
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Format YYYY-MM-DD to DD-MM-YYYY for Document IDs (Consistency with Dashboard)
  const docIdDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-');
    return `${d}-${m}-${y}`;
  }, [selectedDate]);

  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsub2 = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // Fetch individual meal records for selected date
  useEffect(() => {
    if (!db || !config) return;
    setLoading(true);

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
      // Sync local input buffer with DB, but don't overwrite if user is typing (simplified here as they only use dropdowns)
      setInputMeals(mealsMap);
      setLoading(false);
    }, (error) => {
      console.error("Fetch Meals Error:", error);
      setLoading(false);
    });

    return () => unsubMeals();
  }, [config, docIdDate]);

  const activeMembers = useMemo(() => members.filter(m => m.status === 'active'), [members]);
  
  const todayTotal = useMemo(() => {
    return Object.values(inputMeals).reduce((s, v) => s + v, 0);
  }, [inputMeals]);

  const handleMealChange = (memberId, value) => {
    setInputMeals(prev => ({ ...prev, [memberId]: Number(value) }));
  };

  const handleSaveAll = async () => {
    if (!db || !config || saving) return;
    setSaving(true);
    const batch = writeBatch(db);

    try {
      let totalForDay = 0;

      activeMembers.forEach(member => {
        const count = Number(inputMeals[member.id] || 0);
        totalForDay += count;

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
        totalMeals: totalForDay,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await batch.commit();
      window.alert("তথ্য সেভ হয়েছে, বস!");
    } catch (error) {
      console.error("Meal Save Error:", error);
      window.alert("বস, তথ্য সেভ হয়নি! " + error.message);
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
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#888' }}>প্রতি মেম্বারের মিল ইনপুট দিন</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#888' }}>আজকের মোট মিল</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '900', color: 'var(--accent-blue)' }}>{todayTotal} টি</div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#666' }}>লোড হচ্ছে...</div>
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
                {activeMembers.length === 0 && (
                  <tr><td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>কোনো সক্রিয় মেম্বার পাওয়া যায়নি।</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
          <button 
            className="btn btn-primary meal-save-btn"
            disabled={saving || loading}
            onClick={handleSaveAll}
            style={{ 
              width: '280px', padding: '1.1rem', borderRadius: '12px', fontSize: '1rem', 
              fontWeight: '800', transition: 'transform 0.15s ease', boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {saving ? 'সেভ হচ্ছে...' : '💾 আজকের সব মিল সেভ করুন'}
          </button>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .meal-save-btn:active { transform: scale(0.95); }
        .meal-save-btn:hover:not(:disabled) { background: #1d4ed8; filter: brightness(1.1); }
        .glass-card { background: rgba(20, 20, 20, 0.6); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.05); }
      `}} />
    </div>
  );
};

export default MealManagement;

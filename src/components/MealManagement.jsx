import { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, setDoc, query, where, updateDoc, increment, writeBatch } from '../utils/firebase';
import { getTodayDateString } from '../utils/monthUtils';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({}); // Local edited state (dropdowns)
  const [dbMeals, setDbMeals] = useState({});       // Persistent DB state (for totals)
  const [monthMeals, setMonthMeals] = useState({}); // Cumulative monthly DB state
  const [loading, setLoading] = useState(true);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [config, setConfig] = useState(null);

  const MEAL_OPTIONS = [0, 1, 2, 3, 4, 5];

  const formatToSlash = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const displayDate = useMemo(() => formatToSlash(selectedDate), [selectedDate]);

  // 1. Initial Data Fetch (Members & Settings)
  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(collection(db, 'users'), snap => {
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(doc(db, 'config', 'settings'), snap => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => { unsub1(); unsub2(); };
  }, []);

  // 2. Data Fetching (Persistence & Initial Load): Sync totals with saved DB data
  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;
    setMealsLoading(true);

    const unsubDaily = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('date', '==', displayDate)
    ), snap => {
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        mealsMap[data.memberId] = data.count || 0;
      });
      
      // Update both DB state (for totals) AND Local state (for dropdowns)
      // This ensures that on initial load or date change, the dropdowns reflect the DB.
      setDbMeals(mealsMap);
      setTodayMeals(mealsMap); 
      setMealsLoading(false);
    });

    const unsubMonth = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('month_id', '==', mid)
    ), snap => {
      const totalsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        totalsMap[data.memberId] = (totalsMap[data.memberId] || 0) + (Number(data.count) || 0);
      });
      setMonthMeals(totalsMap);
    });

    return () => { unsubDaily(); unsubMonth(); };
  }, [config, displayDate]);

  // 1. Disable Real-time Summation logic:
  // Dropdown only updates todayMeals, NOT dbMeals.
  const handleDropdownChange = (memberId, value) => {
    const numVal = parseInt(value) || 0;
    setTodayMeals(prev => ({
      ...prev,
      [memberId]: numVal
    }));
  };

  // 2. Save-Triggered Calculation logic:
  const handleSaveAll = async () => {
    if (!db || !config || saving) return;
    setSaving(true);
    const dateId = displayDate.replace(/\//g, '_');
    const batch = writeBatch(db);

    try {
      for (const member of members) {
        const currentCount = Number(todayMeals[member.id] || 0);
        const prevCount = Number(dbMeals[member.id] || 0);
        const delta = currentCount - prevCount;

        const mealDocId = `meal_${member.id}_${dateId}`;
        const mealRef = doc(db, 'daily_meals', mealDocId);

        batch.set(mealRef, {
          memberId: member.id,
          date: displayDate,
          count: currentCount,
          month_id: config.current_month_id,
          updatedAt: new Date()
        }, { merge: true });

        if (delta !== 0) {
          const userRef = doc(db, 'users', member.id);
          batch.update(userRef, {
            total_meals: increment(delta)
          });
        }
      }

      // After SUCCESSFUL commitment, the onSnapshot listener will trigger 
      // and update dbMeals/monthMeals, which refreshes the summary boxes.
      await batch.commit();
      window.alert("সফলভাবে সেভ হয়েছে!");
    } catch (err) {
      console.error(err);
      window.alert("ব্যর্থ! ডাটা সেভ করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  // Summary Boxes reflect ONLY the DB state (dbMeals, monthMeals)
  // todayMeals is ignored here to satisfy the "Calculate only on Save" rule.
  const totalTodaySaved = Object.values(dbMeals).reduce((s, c) => s + (Number(c) || 0), 0);
  const totalMonthSaved = Object.values(monthMeals).reduce((s, c) => s + (Number(c) || 0), 0);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>লোড হচ্ছে...</div>;

  return (
    <div className="meal-management-unified" style={{ fontFamily: "'Hind Siliguri', sans-serif", padding: '1rem', color: '#fff' }}>
      
      {/* Date Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: '#1a1a1a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>🍽️ মিল ম্যানেজমেন্ট ({displayDate})</h2>
        <input 
          type="date" 
          style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #444', background: '#000', color: '#fff', fontWeight: '700' }}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
        
        {/* Left Side: Member List Card */}
        <div className="left-side">
          <div className="card" style={{ background: '#111', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #222', background: '#1a1a1a', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
              <span>মেম্বার তালিকা</span>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>মিল সংখ্যা (০-৫)</span>
            </div>
            
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #1a1a1a' }}>
                  <div>
                    <div style={{ fontWeight: '700' }}>{m.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>@{m.username}</div>
                  </div>
                  
                  <select 
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #444', background: '#000', color: '#fff', fontWeight: '700', width: '100px', cursor: 'pointer' }}
                    value={todayMeals[m.id] || 0}
                    onChange={(e) => handleDropdownChange(m.id, e.target.value)}
                  >
                    {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Centered Save Button Inside Card */}
            <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center', background: '#111', borderTop: '1px solid #222' }}>
              <button 
                onClick={handleSaveAll}
                disabled={saving || mealsLoading}
                style={{ 
                  width: '250px',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: '800',
                  fontSize: '1rem',
                  cursor: (saving || mealsLoading) ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.3s ease',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem'
                }}
              >
                {saving ? <div className="spinner-sm"></div> : '💾 আজকের সব মিল সেভ করুন'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Summary Preview */}
        <div className="right-side">
          <div className="card" style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333', position: 'sticky', top: '1rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#00d1ff', fontSize: '1.25rem' }}>📊 প্রিভিউ ({displayDate})</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1rem', background: '#111', borderRadius: '12px', borderLeft: '4px solid #00d1ff' }}>
                <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>আজকের মোট মিল:</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#00d1ff' }}>{totalTodaySaved} টি</div>
              </div>
              <div style={{ padding: '1rem', background: '#111', borderRadius: '12px', borderLeft: '4px solid #ff9500' }}>
                <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>এই মাসের মোট মিল:</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ff9500' }}>{totalMonthSaved} টি</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem 0', color: '#888', fontSize: '0.85rem', textTransform: 'uppercase' }}>মেম্বার ব্রেকডাউন (সেভ করা ডেটা)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                    <span style={{ fontWeight: '600' }}>{m.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ color: '#00d1ff', fontWeight: '700' }}>{dbMeals[m.id] || 0}</span>
                      <span style={{ color: '#444', margin: '0 5px' }}>|</span>
                      <span style={{ color: '#888', fontSize: '0.8rem' }}>মাস: {monthMeals[m.id] || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');
        body { background: #000; }
        .spinner-sm { width: 18px; height: 18px; border: 3px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}} />
    </div>
  );
};

export default MealManagement;

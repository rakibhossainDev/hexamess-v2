import { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, setDoc, query, where, getDocs, updateDoc, increment } from '../utils/firebase';
import { getTodayDateString } from '../utils/monthUtils';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({}); // Input State
  const [savedMeals, setSavedMeals] = useState({}); // DB State for "Today's Total"
  const [monthTotal, setMonthTotal] = useState(0);   // DB State for "Monthly Total"
  const [selectedDate, setSelectedDate] = useState(getTodayDateString()); // YYYY-MM-DD
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const MEAL_OPTIONS = [0, 1, 2, 3, 4, 5];

  // Helper: DD/MM/YYYY
  const formatDisplayDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const displayDate = useMemo(() => formatDisplayDate(selectedDate), [selectedDate]);

  // 1. Initial Fetch (Members & Settings)
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

  // 3. DATA PERSISTENCE (Refresh Fix): Fetch on selectedDate change
  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;

    // Fetch for the specific date
    const fetchDaily = async () => {
      const q = query(collection(db, 'daily_meals'), where('date', '==', displayDate));
      const snap = await getDocs(q);
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        mealsMap[data.memberId] = data.count || 0;
      });
      setTodayMeals(mealsMap); // Populate Dropdowns
      setSavedMeals(mealsMap); // Update Today's Summary Box
    };

    // Fetch for the monthly total
    const fetchMonthTotal = async () => {
      const q = query(collection(db, 'daily_meals'), where('month_id', '==', mid));
      const snap = await getDocs(q);
      let total = 0;
      snap.docs.forEach(d => total += (Number(d.data().count) || 0));
      setMonthTotal(total); // Update Monthly Summary Box
    };

    fetchDaily();
    fetchMonthTotal();
  }, [config, displayDate]);

  // 1. Dropdown State Fix (Immediate Update)
  const handleDropdownChange = (memberId, value) => {
    const num = parseInt(value) || 0;
    setTodayMeals(prev => ({ ...prev, [memberId]: num }));
  };

  // 2. SAVE LOGIC (Calculation only on success)
  const handleSaveAll = async () => {
    if (!db || !config || saving) return;
    setSaving(true);

    try {
      const promises = members.map(async (member) => {
        const count = Number(todayMeals[member.id] || 0);
        const prevCount = Number(savedMeals[member.id] || 0);
        const delta = count - prevCount;
        
        // STRICT Document ID: memberId_date
        const dateKey = displayDate.replace(/\//g, '_');
        const mealDocId = `${member.id}_${dateKey}`;

        // a. Save to daily_meals
        await setDoc(doc(db, 'daily_meals', mealDocId), {
          memberId: member.id,
          date: displayDate,
          count: count,
          month_id: config.current_month_id,
          updatedAt: new Date()
        }, { merge: true });

        // b. Update lifetime aggregate
        if (delta !== 0) {
          await updateDoc(doc(db, 'users', member.id), {
            total_meals: increment(delta)
          });
        }
      });

      // Wait for all Firestore promises to resolve
      await Promise.all(promises);

      // 2. UPDATE TOTALS: Only AFTER success
      const newTotalToday = Object.values(todayMeals).reduce((s, c) => s + (Number(c) || 0), 0);
      setSavedMeals({ ...todayMeals });
      
      // Re-fetch Month Total for accuracy
      const mid = config.current_month_id;
      const q = query(collection(db, 'daily_meals'), where('month_id', '==', mid));
      const snap = await getDocs(q);
      let mTotal = 0;
      snap.docs.forEach(d => mTotal += (Number(d.data().count) || 0));
      setMonthTotal(mTotal);

      window.alert("সফলভাবে সেভ হয়েছে!");
    } catch (err) {
      console.error(err);
      window.alert("সেভ ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
    } finally {
      setSaving(false);
    }
  };

  const currentBoxToday = Object.values(savedMeals).reduce((s, c) => s + (Number(c) || 0), 0);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>LOAD...</div>;

  return (
    <div className="meal-management-reconstructed" style={{ fontFamily: "'Hind Siliguri', sans-serif", color: '#fff', padding: '1rem' }}>
      
      {/* Date Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: '#111', padding: '1.5rem', borderRadius: '12px', border: '1px solid #222' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>🍽️ মিল ম্যানেজমেন্ট ({displayDate})</h2>
        <input 
          type="date" 
          style={{ padding: '0.6rem', borderRadius: '10px', border: '1px solid #333', background: '#000', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
        
        {/* Left Side: Member List Card */}
        <div className="left-side">
          <div className="card" style={{ background: '#0a0a0a', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #222', background: '#111', fontWeight: '700' }}>মেম্বার তালিকা</div>
            
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #111' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{m.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>@{m.username}</div>
                  </div>
                  
                  <select 
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #333', background: '#000', color: '#fff', fontWeight: '700', width: '90px', cursor: 'pointer' }}
                    value={todayMeals[m.id] || 0}
                    onChange={(e) => handleDropdownChange(m.id, e.target.value)}
                  >
                    {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* 1. SAVE BUTTON: Inside the card at the very bottom */}
            <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', background: '#0a0a0a', borderTop: '1px solid #222' }}>
              <button 
                onClick={handleSaveAll}
                disabled={saving}
                style={{ 
                  width: '260px',
                  padding: '1.1rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: '800',
                  fontSize: '1rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  zIndex: 50,
                  boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)',
                  transition: 'all 0.3s ease',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem'
                }}
              >
                {saving ? (
                  <>
                    <div className="loader-sm"></div>
                    <span>সেভ হচ্ছে...</span>
                  </>
                ) : '💾 আজকের সব মিল সেভ করুন'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Preview Summary */}
        <div className="right-side">
          <div className="card" style={{ background: '#111', padding: '1.5rem', borderRadius: '16px', border: '1px solid #222', position: 'sticky', top: '1rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#00d1ff', fontSize: '1.2rem', fontWeight: '700' }}>📊 আজকের প্রিভিউ ({displayDate})</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1.25rem', background: '#000', borderRadius: '12px', borderLeft: '5px solid #2563eb' }}>
                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>আজকের মোট মিল:</div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#2563eb', marginTop: '0.25rem' }}>{currentBoxToday} টি</div>
              </div>
              <div style={{ padding: '1.25rem', background: '#000', borderRadius: '12px', borderLeft: '5px solid #ff9500' }}>
                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>এই মাসের মোট মিল:</div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#ff9500', marginTop: '0.25rem' }}>{monthTotal} টি</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #222', paddingTop: '1.5rem' }}>
              <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '1px' }}>সদস্য ব্রেকডাউন (সংরক্ষিত)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>{m.name}</span>
                    <span style={{ fontWeight: '800', color: (savedMeals[m.id] > 0 ? '#2563eb' : '#444') }}>
                      {savedMeals[m.id] || 0}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');
        
        .loader-sm {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Scrollbar Styling */
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default MealManagement;

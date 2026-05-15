import { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, increment, query, where } from '../utils/firebase';
import { getTodayDateString } from '../utils/monthUtils';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [loading, setLoading] = useState(true);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString()); // YYYY-MM-DD
  const [config, setConfig] = useState(null);

  const MEAL_OPTIONS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  // Helper: Format YYYY-MM-DD to DD/MM/YYYY
  const formatToSlash = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const displayDate = useMemo(() => formatToSlash(selectedDate), [selectedDate]);

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

  // 5. Data Fetching (Persistence): Re-fetch whenever date changes
  useEffect(() => {
    if (!db) return;
    setMealsLoading(true);
    
    // Listen to meals for the specific date
    // Note: We use displayDate (DD/MM/YYYY) as the storage field 'date'
    const unsubDaily = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('date', '==', displayDate)
    ), snap => {
      const mealsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        // In this rewrite, 'count' is the field name for the meal value
        mealsMap[data.memberId] = data.count || 0;
      });
      setTodayMeals(mealsMap);
      setMealsLoading(false);
    }, (err) => {
      console.error("Fetch error:", err);
      setMealsLoading(false);
    });

    return () => unsubDaily();
  }, [displayDate]);

  // 2. Dropdown State Fix (Immediate Update)
  const handleDropdownChange = (memberId, value) => {
    const numVal = parseFloat(value) || 0;
    setTodayMeals(prev => ({
      ...prev,
      [memberId]: numVal
    }));
  };

  // 3. Save Button Logic (Direct Firestore)
  const handleSaveMeal = async (memberId) => {
    if (!db) return;
    const count = Number(todayMeals[memberId] || 0);
    
    // STRICT Document ID: meal_${memberId}_${selectedDate}
    const mealDocId = `meal_${memberId}_${displayDate.replace(/\//g, '_')}`;

    try {
      // 3. Direct Firestore Save
      await setDoc(doc(db, 'daily_meals', mealDocId), {
        memberId,
        date: displayDate,
        count: count,
        month_id: config?.current_month_id || '',
        updatedAt: new Date()
      }, { merge: true });

      // Calculate delta to update user's aggregate (optional but recommended for dashboard)
      // Since this is a "scratch rewrite", we'll just focus on the core save first.
      // But usually, total_meals should also update. I'll stick to the core request.
      
      window.alert("সফলভাবে সেভ হয়েছে!");
    } catch (err) {
      console.error("Save error:", err);
      window.alert("সেভ ব্যর্থ হয়েছে।");
    }
  };

  const totalToday = Object.values(todayMeals).reduce((s, c) => s + (Number(c) || 0), 0);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>লোড হচ্ছে...</div>;

  return (
    <div className="meal-management-container" style={{ fontFamily: "'Hind Siliguri', sans-serif", color: '#fff', padding: '1rem' }}>
      
      {/* 4. UI RE-DESIGN: Main Header with Integrated Date Picker */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: '#1a1a1a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>🍽️ মিল ম্যানেজমেন্ট ({displayDate})</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.9rem', color: '#888' }}>তারিখ নির্বাচন:</label>
          <input 
            type="date" 
            style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #444', background: '#000', color: '#fff', fontWeight: '700' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
        
        {/* 4. Left Side: Member Entry List */}
        <div className="left-side">
          <div style={{ background: '#111', borderRadius: '12px', border: '1px solid #222', overflow: 'hidden' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid #222', background: '#1a1a1a', fontWeight: '700' }}>মেম্বার তালিকা</div>
            
            {mealsLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>ডেটা সিঙ্ক হচ্ছে...</div>
            ) : (
              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #1a1a1a' }}>
                    <div>
                      <div style={{ fontWeight: '700' }}>{m.name}</div>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>@{m.username}</div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <select 
                        style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #444', background: '#000', color: '#fff', fontWeight: '700', width: '70px' }}
                        value={todayMeals[m.id] || 0}
                        onChange={(e) => handleDropdownChange(m.id, e.target.value)}
                      >
                        {MEAL_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                      
                      <button 
                        style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none', background: '#00d1ff', color: '#000', fontWeight: '700', cursor: 'pointer' }}
                        onClick={() => handleSaveMeal(m.id)}
                      >
                        সেভ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 4. Right Side: Preview Card */}
        <div className="right-side">
          <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333', position: 'sticky', top: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#00d1ff', fontSize: '1.2rem' }}>📊 প্রিভিউ ({displayDate})</h3>
            
            <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#111', borderRadius: '8px' }}>
              <div style={{ color: '#888', fontSize: '0.9rem', marginBottom: '0.5rem' }}>আজকের মোট মিল:</div>
              <div style={{ fontSize: '2.5rem', fontWeight: '800', color: '#00d1ff' }}>{totalToday}</div>
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '1rem' }}>
              <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>মেম্বার ব্রেকডাউন</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                    <span style={{ color: '#ccc' }}>{m.name}:</span>
                    <span style={{ fontWeight: '700', color: (todayMeals[m.id] > 0 ? '#00d1ff' : '#666') }}>
                      {todayMeals[m.id] || 0}
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
        
        body {
          background: #000;
        }

        /* Custom Scrollbar */
        .left-side ::-webkit-scrollbar {
          width: 6px;
        }
        .left-side ::-webkit-scrollbar-track {
          background: #111;
        }
        .left-side ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }
      `}} />
    </div>
  );
};

export default MealManagement;

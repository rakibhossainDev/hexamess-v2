import { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, setDoc, query, where, getDocs, updateDoc, increment } from '../utils/firebase';
import { getTodayDateString } from '../utils/monthUtils';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({}); // Current user inputs
  const [savedMeals, setSavedMeals] = useState({}); // Verified DB data for totals
  const [monthTotal, setMonthTotal] = useState(0);   // Verified DB monthly total
  const [selectedDate, setSelectedDate] = useState(getTodayDateString()); // YYYY-MM-DD
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const MEAL_OPTIONS = [0, 1, 2, 3, 4, 5];

  // Helper: Format to DD/MM/YYYY
  const displayDate = useMemo(() => {
    const [y, m, d] = selectedDate.split('-');
    return `${d}/${m}/${y}`;
  }, [selectedDate]);

  // 1. Initial Load: Members & Config
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

  // 4. Data Persistence: Fetch saved data when date changes
  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;

    const fetchPersistedData = async () => {
      // a. Today's Data
      const qDaily = query(collection(db, 'daily_meals'), where('date', '==', displayDate));
      const snapDaily = await getDocs(qDaily);
      const mealsMap = {};
      snapDaily.docs.forEach(d => {
        const data = d.data();
        mealsMap[data.memberId] = data.count || 0;
      });
      setTodayMeals(mealsMap);
      setSavedMeals(mealsMap);

      // b. Month Total
      const qMonth = query(collection(db, 'daily_meals'), where('month_id', '==', mid));
      const snapMonth = await getDocs(qMonth);
      let mTotal = 0;
      snapMonth.docs.forEach(d => mTotal += (Number(d.data().count) || 0));
      setMonthTotal(mTotal);
    };

    fetchPersistedData();
  }, [config, displayDate]);

  const handleDropdownChange = (memberId, value) => {
    const num = parseInt(value) || 0;
    setTodayMeals(prev => ({ ...prev, [memberId]: num }));
  };

  // 2. Database Connection & Confirmation Logic
  const handleSaveAll = async () => {
    if (!db || !config || saving) return;
    setSaving(true);

    try {
      const dateIdSuffix = displayDate.replace(/\//g, '_');
      
      const savePromises = members.map(async (member) => {
        const count = Number(todayMeals[member.id] || 0);
        const prevCount = Number(savedMeals[member.id] || 0);
        const delta = count - prevCount;
        
        const docId = `${member.id}_${dateIdSuffix}`;
        const mealRef = doc(db, 'daily_meals', docId);

        // Save daily record
        await setDoc(mealRef, {
          memberId: member.id,
          date: displayDate,
          count: count,
          month_id: config.current_month_id,
          updatedAt: new Date()
        }, { merge: true });

        // Sync aggregate
        if (delta !== 0) {
          await updateDoc(doc(db, 'users', member.id), {
            total_meals: increment(delta)
          });
        }
      });

      await Promise.all(savePromises);

      // Success Confirmation
      window.alert("তথ্য সেভ হয়েছে, বস!");

      // Sync Totals ONLY after success
      setSavedMeals({ ...todayMeals });
      
      // Refresh Month Total for the display
      const mid = config.current_month_id;
      const qMonth = query(collection(db, 'daily_meals'), where('month_id', '==', mid));
      const snapMonth = await getDocs(qMonth);
      let mTotal = 0;
      snapMonth.docs.forEach(d => mTotal += (Number(d.data().count) || 0));
      setMonthTotal(mTotal);

    } catch (err) {
      console.error(err);
      window.alert("বস, তথ্য সেভ হয়নি!");
    } finally {
      setSaving(false);
    }
  };

  const todayTotalSaved = Object.values(savedMeals).reduce((s, c) => s + (Number(c) || 0), 0);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>লোড হচ্ছে...</div>;

  return (
    <div className="meal-management-interactive" style={{ fontFamily: "'Hind Siliguri', sans-serif", color: '#fff', padding: '1rem' }}>
      
      {/* Header */}
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
        
        {/* Member List Section */}
        <div className="left-column" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div className="card" style={{ width: '100%', background: '#0a0a0a', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden' }}>
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
          </div>

          {/* 1. Button Animation & UI */}
          <button 
            onClick={handleSaveAll}
            disabled={saving}
            className="interactive-save-btn"
            style={{ 
              width: '300px',
              marginTop: '1.5rem',
              padding: '1.1rem',
              borderRadius: '12px',
              border: 'none',
              background: '#2563eb',
              color: '#fff',
              fontWeight: '800',
              fontSize: '1rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              zIndex: 10,
              boxShadow: '0 8px 30px rgba(37, 99, 235, 0.4)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem'
            }}
          >
            {saving ? (
              <>
                <div className="spinner-icon"></div>
                <span>সেভ হচ্ছে...</span>
              </>
            ) : '💾 আজকের সব মিল সেভ করুন'}
          </button>
        </div>

        {/* Preview Section */}
        <div className="right-column">
          <div className="card" style={{ background: '#111', padding: '1.5rem', borderRadius: '16px', border: '1px solid #222', position: 'sticky', top: '1rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#00d1ff', fontSize: '1.2rem', fontWeight: '700' }}>📊 আজকের প্রিভিউ (সংরক্ষিত)</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div className="stat-box blue">
                <div className="label">আজকের মোট মিল:</div>
                <div className="value">{todayTotalSaved} টি</div>
              </div>
              <div className="stat-box orange">
                <div className="label">এই মাসের মোট মিল:</div>
                <div className="value">{monthTotal} টি</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #222', paddingTop: '1.5rem' }}>
              <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '1px' }}>ব্যক্তিগত সংরক্ষিত মিল</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {members.map(m => (
                  <div key={m.id} className="breakdown-item">
                    <span className="m-name">{m.name}</span>
                    <span className={`m-count ${savedMeals[m.id] > 0 ? 'active' : ''}`}>
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
        
        .interactive-save-btn:active {
          transform: scale(0.95);
        }

        .interactive-save-btn:hover:not(:disabled) {
          background: #1d4ed8;
          transform: translateY(-2px);
          box-shadow: 0 12px 40px rgba(37, 99, 235, 0.5);
        }

        .stat-box {
          padding: 1.25rem;
          background: #000;
          border-radius: 12px;
        }
        
        .stat-box.blue { border-left: 5px solid #2563eb; }
        .stat-box.orange { border-left: 5px solid #ff9500; }

        .stat-box .label { color: #888; fontSize: 0.85rem; textTransform: uppercase; letterSpacing: 1px; }
        .stat-box .value { font-size: 2rem; font-weight: 900; margin-top: 0.25rem; }
        .stat-box.blue .value { color: #2563eb; }
        .stat-box.orange .value { color: #ff9500; }

        .breakdown-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: rgba(255,255,255,0.02);
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.03);
        }

        .m-name { font-weight: 600; font-size: 0.95rem; }
        .m-count { font-weight: 800; color: #444; }
        .m-count.active { color: #2563eb; }

        .spinner-icon {
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

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default MealManagement;

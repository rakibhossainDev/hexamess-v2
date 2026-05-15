import { useState, useEffect, useMemo } from 'react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, increment, query, where, writeBatch } from '../utils/firebase';
import { getTodayDateString } from '../utils/monthUtils';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [dbMeals, setDbMeals] = useState({});
  const [monthMeals, setMonthMeals] = useState({});
  const [loading, setLoading] = useState(true);
  const [mealsLoading, setMealsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [config, setConfig] = useState(null);

  // Strict Whole Numbers (0-5)
  const MEAL_OPTIONS = [0, 1, 2, 3, 4, 5];

  const formatToSlash = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  const displayDate = useMemo(() => formatToSlash(selectedDate), [selectedDate]);

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
      setTodayMeals(mealsMap);
      setDbMeals(mealsMap);
      setMealsLoading(false);
    });

    const unsubMonth = onSnapshot(query(
      collection(db, 'daily_meals'),
      where('month_id', '==', mid)
    ), snap => {
      const totalsMap = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const [dD, dM, dY] = data.date.split('/').map(Number);
        const [sY, sM, sD] = selectedDate.split('-').map(Number);
        const docDate = new Date(dY, dM - 1, dD);
        const selDate = new Date(sY, sM - 1, sD);
        if (docDate <= selDate) {
          totalsMap[data.memberId] = (totalsMap[data.memberId] || 0) + (Number(data.count) || 0);
        }
      });
      setMonthMeals(totalsMap);
    });

    return () => { unsubDaily(); unsubMonth(); };
  }, [config, displayDate, selectedDate]);

  const handleDropdownChange = (memberId, value) => {
    const numVal = parseInt(value) || 0;
    setTodayMeals(prev => ({ ...prev, [memberId]: numVal }));
  };

  const handleSaveAll = async (e) => {
    if (e) e.preventDefault();
    if (!db || !config || saving) return;
    
    setSaving(true);
    const batch = writeBatch(db);
    const dateKey = displayDate.replace(/\//g, '_');

    try {
      members.forEach(member => {
        const count = Number(todayMeals[member.id] || 0);
        const prevCount = Number(dbMeals[member.id] || 0);
        const delta = count - prevCount;

        const mealDocId = `meal_${dateKey}_${member.id}`;
        const mealRef = doc(db, 'daily_meals', mealDocId);
        
        batch.set(mealRef, {
          memberId: member.id,
          date: displayDate,
          count: count,
          month_id: config.current_month_id,
          updatedAt: new Date()
        }, { merge: true });

        if (delta !== 0) {
          const userRef = doc(db, 'users', member.id);
          batch.update(userRef, {
            total_meals: increment(delta)
          });
        }
      });

      await batch.commit();
      window.alert("সফলভাবে সেভ হয়েছে!");
    } catch (err) {
      console.error("Save error:", err);
      window.alert("ব্যর্থ! ডাটা সেভ করা যায়নি।");
    } finally {
      setSaving(false);
    }
  };

  const totalToday = Object.values(todayMeals).reduce((s, c) => s + (Number(c) || 0), 0);
  const totalMonth = Object.values(monthMeals).reduce((s, c) => s + (Number(c) || 0), 0);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>লোড হচ্ছে...</div>;

  return (
    <div className="meal-management-container" style={{ fontFamily: "'Hind Siliguri', sans-serif", color: '#fff', padding: '1rem' }}>
      
      {/* Header */}
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
          <div className="card" style={{ background: '#111', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #222', background: '#1a1a1a', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
              <span>মেম্বার তালিকা</span>
              <span style={{ color: '#888', fontSize: '0.8rem' }}>মিল সংখ্যা (১-৫)</span>
            </div>
            
            {mealsLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>লোড হচ্ছে...</div>
            ) : (
              <>
                <div className="list-content" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
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

                {/* Fixed Save Button Inside the Card */}
                <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'center', borderTop: '1px solid #222', background: '#111' }}>
                  <button 
                    id="save-all-btn"
                    onClick={(e) => handleSaveAll(e)}
                    disabled={saving || mealsLoading}
                    style={{ 
                      width: '250px',
                      padding: '0.9rem',
                      borderRadius: '10px',
                      border: 'none',
                      background: '#2563eb', // Blue-600
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
                    {saving ? <div className="spinner-sm"></div> : 'আজকের সব মিল সেভ করুন'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Side: Preview */}
        <div className="right-side">
          <div style={{ background: '#1a1a1a', padding: '1.5rem', borderRadius: '12px', border: '1px solid #333', position: 'sticky', top: '1rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#00d1ff', fontSize: '1.2rem' }}>📊 প্রিভিউ ({displayDate})</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '1rem', background: '#111', borderRadius: '8px', borderLeft: '4px solid #00d1ff' }}>
                <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>আজকের মোট মিল:</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#00d1ff' }}>{totalToday} টি</div>
              </div>
              <div style={{ padding: '1rem', background: '#111', borderRadius: '8px', borderLeft: '4px solid #ff9500' }}>
                <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase' }}>এই মাসের মোট মিল:</div>
                <div style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ff9500' }}>{totalMonth} টি</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '1rem' }}>
              <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1rem' }}>মেম্বার ব্রেকডাউন (মাসিক)</div>
              <div className="breakdown-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                    <span style={{ color: '#ccc', fontWeight: '500' }}>{m.name}</span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '700', color: '#00d1ff' }}>আজ: {todayMeals[m.id] || 0}</div>
                      <div style={{ fontSize: '0.75rem', color: '#ff9500' }}>মোট: {monthMeals[m.id] || 0}</div>
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
        /* Custom Scrollbar */
        .list-content::-webkit-scrollbar { width: 6px; }
        .list-content::-webkit-scrollbar-track { background: #111; }
        .list-content::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default MealManagement;

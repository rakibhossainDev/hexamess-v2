import { useState, useEffect, useMemo } from 'react';
import {
  db,
  collection,
  doc,
  onSnapshot,
  query,
  where,
  getDocs,
} from '../firebase';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [savedMeals, setSavedMeals] = useState({});
  const [monthTotal, setMonthTotal] = useState(0);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPopup, setShowPopup] = useState(true);

  const displayDate = useMemo(() => formatDisplayDate(selectedDate), [selectedDate]);

  useEffect(() => {
    if (!db) return;
    const unsub1 = onSnapshot(collection(db, 'users'), (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const unsub2 = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) setConfig(snap.data());
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  useEffect(() => {
    if (!db || !config) return;
    const mid = config.current_month_id;

    const fetchData = async () => {
      try {
        const qDaily = query(
          collection(db, 'daily_meals'),
          where('date', '==', selectedDate)
        );
        const snapDaily = await getDocs(qDaily);
        const mealsMap = {};
        snapDaily.docs.forEach((d) => {
          const data = d.data();
          if (data.memberId) mealsMap[data.memberId] = data.count || 0;
        });
        setTodayMeals(mealsMap);
        setSavedMeals(mealsMap);

        const qMonth = query(
          collection(db, 'daily_meals'),
          where('month_id', '==', mid)
        );
        const snapMonth = await getDocs(qMonth);
        let mTotal = 0;
        snapMonth.docs.forEach((d) => {
          mTotal += (Number(d.data().count) || 0);
        });
        setMonthTotal(mTotal);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [config, selectedDate]);

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>লোড হচ্ছে...</div>;

  return (
    <div className="meal-management-container" style={{ fontFamily: "'Hind Siliguri', sans-serif", color: '#fff', padding: '1rem' }}>
      
      {/* Maintenance Popup */}
      {showPopup && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div className="card glass-card" style={{ maxWidth: '450px', textAlign: 'center', padding: '2rem', border: '1px solid var(--accent-blue)', boxShadow: '0 0 30px rgba(0, 209, 255, 0.2)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚙️</div>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-blue)' }}>সিস্টেম আপডেট চলছে</h3>
            <p style={{ color: '#ccc', lineHeight: '1.6', marginBottom: '2rem' }}>
              পরবর্তী আপডেটের জন্য অপেক্ষা করুন। বর্তমানে সিস্টেমটি ডেটাবেজের সাথে সিঙ্ক করা হচ্ছে।
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowPopup(false)}>বুঝেছি</button>
          </div>
        </div>
      )}

      {/* Date Picker Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: '#111', padding: '1.5rem', borderRadius: '12px', border: '1px solid #222' }}>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}>🍽️ মিল ম্যানেজমেন্ট ({displayDate})</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#888' }}>তারিখ নির্বাচন:</span>
          <input 
            type="date" 
            style={{ padding: '0.6rem', borderRadius: '10px', border: '1px solid #333', background: '#000', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
        
        <div className="left-column">
          <div className="card" style={{ background: '#0a0a0a', borderRadius: '16px', border: '1px solid #222', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid #222', background: '#111', fontWeight: '700' }}>মেম্বার তালিকা</div>
            
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {members.map(m => (
                <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid #111' }}>
                  <div>
                    <div style={{ fontWeight: '700' }}>{m.name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>@{m.username}</div>
                  </div>
                  
                  <select 
                    style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #333', background: '#000', color: '#fff', fontWeight: '700', width: '90px', cursor: 'not-allowed', opacity: 0.6 }}
                    value={todayMeals[m.id] || 0}
                    disabled
                  >
                    {[0,1,2,3,4,5].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Disabled Save Button */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#0a0a0a', borderTop: '1px solid #222' }}>
              <button 
                disabled
                style={{ 
                  width: '100%',
                  maxWidth: '300px',
                  padding: '1rem',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#333',
                  color: '#666',
                  fontWeight: '800',
                  fontSize: '1rem',
                  cursor: 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1rem'
                }}
              >
                💾 আজকের সব মিল সেভ করুন
              </button>
              <p style={{ marginTop: '1rem', color: 'var(--accent-orange)', fontSize: '0.85rem', fontWeight: '600' }}>
                ⚠️ এই ফিচারটি পরবর্তী আপডেটে লাইভ হবে।
              </p>
            </div>
          </div>
        </div>

        <div className="right-column">
          <div className="card" style={{ background: '#111', padding: '1.5rem', borderRadius: '16px', border: '1px solid #222', position: 'sticky', top: '1rem' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--accent-blue)', fontSize: '1.2rem', fontWeight: '700' }}>📊 আজকের প্রিভিউ (সংরক্ষিত)</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
              <div style={{ padding: '1.25rem', background: '#000', borderRadius: '12px', borderLeft: '5px solid var(--accent-blue)' }}>
                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>আজকের মোট মিল:</div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--accent-blue)', marginTop: '0.25rem' }}>
                  {Object.values(savedMeals).reduce((s, c) => s + (Number(c) || 0), 0)} টি
                </div>
              </div>
              <div style={{ padding: '1.25rem', background: '#000', borderRadius: '12px', borderLeft: '5px solid var(--accent-orange)' }}>
                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}>এই মাসের মোট মিল:</div>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--accent-orange)', marginTop: '0.25rem' }}>{monthTotal} টি</div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #222', paddingTop: '1.5rem' }}>
              <div style={{ color: '#888', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '1.25rem', letterSpacing: '1px' }}>ব্যক্তিগত সংরক্ষিত মিল</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {members.map(m => (
                  <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                    <span style={{ fontWeight: '600' }}>{m.name}</span>
                    <span style={{ fontWeight: '800', color: (savedMeals[m.id] > 0 ? 'var(--accent-blue)' : '#444') }}>
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
        body { background: #000; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}} />
    </div>
  );
};

export default MealManagement;

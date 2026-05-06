import { useState, useEffect } from 'react';
import { db, collection, doc, onSnapshot, setDoc, updateDoc, increment, query, where } from '../firebase';
import { getTodayDateString } from '../utils/monthUtils';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [monthTotalMeals, setMonthTotalMeals] = useState(0);
  const { toasts, showToast, removeToast } = useToast();

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
    
    const unsubDaily = onSnapshot(query(collection(db, 'daily_meals'), where('month_id', '==', mid), where('date', '==', selectedDate)), snap => {
      const mealsMap = {};
      snap.docs.forEach(d => { const data = d.data(); mealsMap[data.user_id] = { docId: d.id, ...data }; });
      setTodayMeals(mealsMap);
    });

    const unsubMonth = onSnapshot(query(collection(db, 'daily_meals'), where('month_id', '==', mid)), snap => {
      const total = snap.docs.reduce((s, d) => s + (Number(d.data().total) || 0), 0);
      setMonthTotalMeals(total);
    });

    return () => { unsubDaily(); unsubMonth(); };
  }, [config, selectedDate]);

  const handleSaveMeal = async (userId) => {
    if (!config) return;
    const m = todayMeals[userId] || { breakfast: 0, lunch: 0, dinner: 0 };
    const b = Number(m.breakfast) || 0;
    const l = Number(m.lunch) || 0;
    const d = Number(m.dinner) || 0;
    const newDayTotal = b + l + d;

    const existing = todayMeals[userId];
    const prevTotal = existing ? (Number(existing.total) || 0) : 0;
    const delta = newDayTotal - prevTotal;

    try {
      const mealDocId = `${config.current_month_id}_${selectedDate}_${userId}`;
      await setDoc(doc(db, 'daily_meals', mealDocId), {
        month_id: config.current_month_id,
        date: selectedDate,
        user_id: userId,
        breakfast: b,
        lunch: l,
        dinner: d,
        total: newDayTotal
      }, { merge: true });
      
      await updateDoc(doc(db, 'users', userId), { total_meals: increment(delta) });
      showToast('মিল সেভ হয়েছে!', 'success');
    } catch (err) {
      console.error('Meal save error:', err);
      showToast('সেভ ব্যর্থ।', 'error');
    }
  };

  const handleInputChange = (userId, type, val) => {
    setTodayMeals(prev => ({
      ...prev,
      [userId]: {
        ...(prev[userId] || { breakfast: 0, lunch: 0, dinner: 0 }),
        [type]: val
      }
    }));
  };

  const grandTotalToday = Object.values(todayMeals).reduce((s, m) => s + (Number(m.total) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* Summaries */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ textAlign: 'center', background: 'rgba(0, 209, 255, 0.05)', borderBottom: '3px solid var(--accent-blue)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>আজকের মোট মিল</p>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent-blue)' }}>{grandTotalToday}</p>
        </div>
        <div className="card" style={{ textAlign: 'center', background: 'rgba(255, 150, 0, 0.05)', borderBottom: '3px solid var(--accent-orange)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>চলতি মাসের মোট মিল</p>
          <p style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--accent-orange)' }}>{monthTotalMeals}</p>
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'1rem' }}>
          <h2 style={{ fontSize:'1.25rem', fontWeight:'600' }}>🍽️ মিল ম্যানেজমেন্ট</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.9rem' }}>তারিখ:</label>
            <input type="date" className="form-control" style={{ width: 'auto' }} value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>
        </div>

        {loading ? <p style={{ textAlign: 'center', padding: '2rem' }}>লোড হচ্ছে...</p> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>মেম্বার</th>
                  <th style={{ textAlign:'center' }}>সকাল (০.৫)</th>
                  <th style={{ textAlign:'center' }}>দুপুর (১.০)</th>
                  <th style={{ textAlign:'center' }}>রাত (১.০)</th>
                  <th style={{ textAlign:'center' }}>মোট</th>
                  <th style={{ textAlign:'right' }}>অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const meal = todayMeals[m.id] || { breakfast: 0, lunch: 0, dinner: 0 };
                  return (
                    <tr key={m.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{m.username}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" step="0.5" className="form-control" style={{ width: '70px', textAlign: 'center', margin: '0 auto' }} value={meal.breakfast} onChange={(e) => handleInputChange(m.id, 'breakfast', e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" step="0.5" className="form-control" style={{ width: '70px', textAlign: 'center', margin: '0 auto' }} value={meal.lunch} onChange={(e) => handleInputChange(m.id, 'lunch', e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="number" step="0.5" className="form-control" style={{ width: '70px', textAlign: 'center', margin: '0 auto' }} value={meal.dinner} onChange={(e) => handleInputChange(m.id, 'dinner', e.target.value)} />
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--accent-blue)' }}>
                        {(Number(meal.breakfast)||0) + (Number(meal.lunch)||0) + (Number(meal.dinner)||0)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }} onClick={() => handleSaveMeal(m.id)}>সেভ</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MealManagement;

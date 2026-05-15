import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  db,
  collection,
  doc,
  onSnapshot,
  setDoc,
  query,
  where,
  getDocs,
  updateDoc,
  increment,
  deleteDoc,
} from '../firebase';
import { getTodayDateString, formatDisplayDate } from '../utils/monthUtils';

const MEAL_OPTIONS = [0, 1, 2, 3, 4, 5];

/** Strict integer meal count 0–5 (no floats). */
function normalizeMealCount(value) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
}

/** Legacy Firestore `date` + doc id used DD/MM/YYYY before ISO migration. */
function legacyDateKeyFromIso(iso) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return null;
  return `${d}/${m}/${y}`;
}

function legacyMealDocId(memberId, iso) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return null;
  return `${memberId}_${d}_${m}_${y}`;
}

const MealManagement = () => {
  const [members, setMembers] = useState([]);
  const [todayMeals, setTodayMeals] = useState({});
  const [savedMeals, setSavedMeals] = useState({});
  const [monthTotal, setMonthTotal] = useState(0);
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  const loadPersistedForDate = useCallback(async () => {
    if (!db || !config) return;

    const mid = config.current_month_id;

    try {
      const legacyKey = legacyDateKeyFromIso(selectedDate);
      const qIso = query(
        collection(db, 'daily_meals'),
        where('date', '==', selectedDate)
      );
      const snapIso = await getDocs(qIso);
      const mealsMap = {};
      snapIso.docs.forEach((d) => {
        const data = d.data();
        if (data.memberId != null) {
          mealsMap[data.memberId] = normalizeMealCount(data.count);
        }
      });
      if (legacyKey) {
        const qLegacy = query(
          collection(db, 'daily_meals'),
          where('date', '==', legacyKey)
        );
        const snapLegacy = await getDocs(qLegacy);
        snapLegacy.docs.forEach((d) => {
          const data = d.data();
          if (data.memberId == null) return;
          if (mealsMap[data.memberId] === undefined) {
            mealsMap[data.memberId] = normalizeMealCount(data.count);
          }
        });
      }
      setTodayMeals(mealsMap);
      setSavedMeals(mealsMap);

      const qMonth = query(
        collection(db, 'daily_meals'),
        where('month_id', '==', mid)
      );
      const snapMonth = await getDocs(qMonth);
      let mTotal = 0;
      snapMonth.docs.forEach((d) => {
        const data = d.data();
        if (data.memberId != null && data.count != null) {
          mTotal += normalizeMealCount(data.count);
        }
      });
      setMonthTotal(mTotal);
    } catch (e) {
      console.error(e);
    }
  }, [config, selectedDate]);

  useEffect(() => {
    loadPersistedForDate();
  }, [loadPersistedForDate]);

  const handleDropdownChange = (memberId, value) => {
    setTodayMeals((prev) => ({
      ...prev,
      [memberId]: normalizeMealCount(value),
    }));
  };

  const handleSaveAll = async () => {
    if (!db || !config || saving) return;

    setSaving(true);

    try {
      const savePromises = members.map(async (member) => {
        const count = normalizeMealCount(todayMeals[member.id]);
        const prevCount = normalizeMealCount(savedMeals[member.id]);
        const delta = count - prevCount;

        const docId = `${member.id}_${selectedDate}`;
        const mealRef = doc(db, 'daily_meals', docId);

        await setDoc(
          mealRef,
          {
            memberId: member.id,
            date: selectedDate,
            count,
            month_id: config.current_month_id,
            updatedAt: new Date(),
          },
          { merge: true }
        );

        if (delta !== 0) {
          await updateDoc(doc(db, 'users', member.id), {
            total_meals: increment(delta),
          });
        }

        const legacyId = legacyMealDocId(member.id, selectedDate);
        if (legacyId && legacyId !== docId) {
          try {
            await deleteDoc(doc(db, 'daily_meals', legacyId));
          } catch {
            /* legacy doc may not exist */
          }
        }
      });

      await Promise.all(savePromises);

      const nextSaved = {};
      members.forEach((m) => {
        nextSaved[m.id] = normalizeMealCount(todayMeals[m.id]);
      });

      const mid = config.current_month_id;
      const qMonth = query(
        collection(db, 'daily_meals'),
        where('month_id', '==', mid)
      );
      const snapMonth = await getDocs(qMonth);
      let nextMonthTotal = 0;
      snapMonth.docs.forEach((d) => {
        const data = d.data();
        if (data.memberId != null && data.count != null) {
          nextMonthTotal += normalizeMealCount(data.count);
        }
      });

      window.alert('তথ্য সেভ হয়েছে, বস!');

      setSavedMeals(nextSaved);
      setMonthTotal(nextMonthTotal);
    } catch (err) {
      console.error(err);
      window.alert('বস, তথ্য সেভ হয়নি!');
    } finally {
      setSaving(false);
    }
  };

  const todayTotalSaved = useMemo(
    () =>
      Object.values(savedMeals).reduce(
        (s, c) => s + normalizeMealCount(c),
        0
      ),
    [savedMeals]
  );

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#fff' }}>
        লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div
      className="meal-management-interactive"
      style={{
        fontFamily: "'Hind Siliguri', sans-serif",
        color: '#fff',
        padding: '1rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
          background: '#111',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid #222',
        }}
      >
        <h2
          style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700' }}
        >
          🍽️ মিল ম্যানেজমেন্ট ({displayDate})
        </h2>
        <input
          type="date"
          style={{
            padding: '0.6rem',
            borderRadius: '10px',
            border: '1px solid #333',
            background: '#000',
            color: '#fff',
            fontWeight: '700',
            cursor: 'pointer',
          }}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: '2rem',
        }}
      >
        <div
          className="left-column"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              background: '#0a0a0a',
              borderRadius: '16px',
              border: '1px solid #222',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '1.25rem',
                borderBottom: '1px solid #222',
                background: '#111',
                fontWeight: '700',
              }}
            >
              মেম্বার তালিকা
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {members.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    borderBottom: '1px solid #111',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>
                      {m.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                      @{m.username}
                    </div>
                  </div>

                  <select
                    style={{
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: '1px solid #333',
                      background: '#000',
                      color: '#fff',
                      fontWeight: '700',
                      width: '90px',
                      cursor: 'pointer',
                    }}
                    value={normalizeMealCount(todayMeals[m.id])}
                    onChange={(e) => handleDropdownChange(m.id, e.target.value)}
                  >
                    {MEAL_OPTIONS.map((opt) => (
                      <option key={opt} value={String(opt)}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
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
              zIndex: 10,
              boxShadow: '0 8px 30px rgba(37, 99, 235, 0.4)',
              transition:
                'transform 0.15s ease, background 0.2s ease, box-shadow 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {saving ? 'সেভ হচ্ছে...' : '💾 আজকের সব মিল সেভ করুন'}
          </button>
        </div>

        <div className="right-column">
          <div
            className="card"
            style={{
              background: '#111',
              padding: '1.5rem',
              borderRadius: '16px',
              border: '1px solid #222',
              position: 'sticky',
              top: '1rem',
            }}
          >
            <h3
              style={{
                margin: '0 0 1.5rem 0',
                color: '#00d1ff',
                fontSize: '1.2rem',
                fontWeight: '700',
              }}
            >
              📊 আজকের প্রিভিউ (সংরক্ষিত)
            </h3>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                marginBottom: '2rem',
              }}
            >
              <div className="stat-box blue">
                <div className="label">আজকের মোট মিল:</div>
                <div className="value">{todayTotalSaved} টি</div>
              </div>
              <div className="stat-box orange">
                <div className="label">এই মাসের মোট মিল:</div>
                <div className="value">{monthTotal} টি</div>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px solid #222',
                paddingTop: '1.5rem',
              }}
            >
              <div
                style={{
                  color: '#888',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  marginBottom: '1.25rem',
                  letterSpacing: '1px',
                }}
              >
                ব্যক্তিগত সংরক্ষিত মিল
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.8rem',
                }}
              >
                {members.map((m) => (
                  <div key={m.id} className="breakdown-item">
                    <span className="m-name">{m.name}</span>
                    <span
                      className={`m-count ${
                        normalizeMealCount(savedMeals[m.id]) > 0
                          ? 'active'
                          : ''
                      }`}
                    >
                      {normalizeMealCount(savedMeals[m.id])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap');

        .interactive-save-btn {
          cursor: pointer;
        }
        .interactive-save-btn:disabled {
          cursor: not-allowed;
          opacity: 0.85;
        }
        .interactive-save-btn:hover:not(:disabled) {
          background: #1d4ed8;
          box-shadow: 0 12px 40px rgba(37, 99, 235, 0.5);
        }
        .interactive-save-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .stat-box {
          padding: 1.25rem;
          background: #000;
          border-radius: 12px;
        }

        .stat-box.blue { border-left: 5px solid #2563eb; }
        .stat-box.orange { border-left: 5px solid #ff9500; }

        .stat-box .label { color: #888; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px; }
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

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: #000; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `,
        }}
      />
    </div>
  );
};

export default MealManagement;

import { useState } from 'react';
import { db, collection, getDocs, query, where } from '../utils/firebase';
import { MONTH_OPTIONS, getYearOptions, getMonthLabel, formatDisplayDate } from '../utils/monthUtils';

const HistoryScreen = () => {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [archive, setArchive] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [fixedCosts, setFixedCosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const yearOptions = getYearOptions();

  const handleSearch = async () => {
    if (!selectedMonth || !selectedYear) return;
    setLoading(true); setSearched(true);
    const monthId = `${selectedYear}-${selectedMonth}`;
    try {
      // Try archive first
      const archSnap = await getDocs(collection(db, 'archives'));
      const archDoc = archSnap.docs.find(d => d.id === monthId);
      if (archDoc) { setArchive({ id: archDoc.id, ...archDoc.data() }); }
      else { setArchive(null); }
      // Fetch expenses for month
      const eSnap = await getDocs(query(collection(db, 'expenses'), where('month_id', '==', monthId), where('status', '==', 'approved')));
      setExpenses(eSnap.docs.map(d => ({ id:d.id, ...d.data() })));
      // Fixed costs
      const fSnap = await getDocs(query(collection(db, 'fixed_costs'), where('month_id', '==', monthId)));
      setFixedCosts(fSnap.docs.map(d => ({ id:d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const monthId = selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth}` : '';
  const totalMarket = expenses.reduce((s, e) => s + (Number(e.cost) || 0), 0);
  const totalFixed = fixedCosts.reduce((s, f) => s + (Number(f.amount) || 0), 0);
  const totalDeposits = archive ? archive.total_deposits || 0 : 0;
  const totalMeals = archive ? archive.total_meals || 0 : 0;
  const mealRate = totalMeals > 0 ? (totalMarket / totalMeals).toFixed(2) : 0;

  return (
    <div className="flex flex-col gap-6 font-['Hind_Siliguri'] pb-10">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-800 m-0 flex items-center gap-2">
          <span>📅</span> History Archive
        </h2>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <select className="form-control bg-slate-50 border-slate-200 text-sm py-2 px-3 rounded-xl m-0 w-32" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              <option value="">মাস</option>
              {MONTH_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className="form-control bg-slate-50 border-slate-200 text-sm py-2 px-3 rounded-xl m-0 w-24" value={selectedYear} onChange={e => setSelectedYear(e.target.value)}>
              <option value="">বছর</option>
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          
          <button 
            className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 m-0 border-0 cursor-pointer"
            onClick={handleSearch} 
            disabled={!selectedMonth || !selectedYear}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            অনুসন্ধান
          </button>
          
          {searched && (
             <button 
               onClick={() => window.print()}
               className="bg-emerald-50 text-emerald-600 border border-emerald-200/60 px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-colors flex items-center gap-2 m-0 cursor-pointer"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
               Download PDF
             </button>
          )}
        </div>
      </div>

      {loading && <p className="text-slate-500 text-center p-8">লোড হচ্ছে...</p>}

      {searched && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <SummaryCard 
              label="মোট বাজার খরচ" 
              value={`৳${totalMarket.toLocaleString()}`} 
              icon="🛒"
              colorClass="bg-amber-100 text-amber-600" 
            />
            <SummaryCard 
              label="মোট ফিক্সড খরচ" 
              value={`৳${totalFixed.toLocaleString()}`} 
              icon="🏠"
              colorClass="bg-rose-100 text-rose-600" 
            />
            <SummaryCard 
              label="মোট ডিপোজিট" 
              value={`৳${totalDeposits.toLocaleString()}`} 
              icon="💰"
              colorClass="bg-emerald-100 text-emerald-600" 
            />
            <SummaryCard 
              label="মোট মিল" 
              value={totalMeals} 
              icon="🍽️"
              colorClass="bg-cyan-100 text-cyan-600" 
            />
            <SummaryCard 
              label="মিল রেট" 
              value={`৳${mealRate}`} 
              icon="📈"
              colorClass="bg-slate-200 text-slate-700" 
            />
          </div>

          {/* Member Breakdown */}
          {archive && archive.members && (
            <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
                <h3 className="text-lg font-bold text-white m-0">সদস্য সমাপনী ব্যালেন্স — {getMonthLabel(monthId)}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900">
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800">নাম</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-right">ডিপোজিট</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-center">মিল</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-right">মিল খরচ</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-right">ফিক্সড শেয়ার</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-center">স্ট্যাটাস</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-right">ব্যালেন্স</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {archive.members.map((m, i) => {
                      const mealCost = (Number(m.total_meals) || 0) * Number(mealRate);
                      const fixedShare = totalFixed / (archive.members.length || 1);
                      const bal = m.current_balance || 0;
                      const isNeg = bal < 0;
                      return (
                        <tr key={i} className="hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">
                            {m.name}
                            {m.role === 'manager' && <span className="ml-2 text-xs bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-md border border-amber-500/40">👑</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-emerald-400 whitespace-nowrap">৳{(m.total_deposit||0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-center text-cyan-300 font-semibold whitespace-nowrap">{m.total_meals||0}</td>
                          <td className="px-4 py-3 text-right text-amber-400 whitespace-nowrap">৳{mealCost.toFixed(0)}</td>
                          <td className="px-4 py-3 text-right text-amber-400 whitespace-nowrap">৳{fixedShare.toFixed(0)}</td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                             {!isNeg ? (
                               <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full px-3 py-1 text-xs font-bold">পাবে</span>
                             ) : (
                               <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded-full px-3 py-1 text-xs font-bold">দিবে</span>
                             )}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${!isNeg ? 'text-emerald-400' : 'text-rose-400'}`}>৳{Math.abs(bal).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!archive && expenses.length === 0 && fixedCosts.length === 0 && (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-100 text-center">
              <p className="text-4xl mb-4 m-0">📭</p>
              <p className="text-slate-500 font-medium m-0">এই মাসের কোনো ডাটা পাওয়া যায়নি।</p>
            </div>
          )}

          {/* Market Details Breakdown */}
          {expenses.length > 0 && (
            <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-800 bg-slate-900/50">
                <h3 className="text-lg font-bold text-white m-0">বাজার বিবরণী</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900">
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800">তারিখ</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800">সদস্য</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800">বাজারের আইটেমসমূহ</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-right">পরিমাণ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {expenses.sort((a,b) => new Date(a.date) - new Date(b.date)).map(e => (
                      <tr key={e.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-100 whitespace-nowrap">{formatDisplayDate(e.date)}</td>
                        <td className="px-4 py-3 font-medium text-slate-100 whitespace-nowrap">{e.buyer_name || e.buyer}</td>
                        <td className="px-4 py-3">
                          {e.items ? e.items.split(',').map((item, idx) => (
                            <span key={idx} className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-xs inline-block mr-1 mb-1">
                              {item.trim()}
                            </span>
                          )) : <span className="text-slate-400 text-sm">—</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-400 whitespace-nowrap">৳{Number(e.cost).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Fixed Costs Breakdown */}
          {fixedCosts.length > 0 && (
            <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
              <div className="p-5 border-b border-slate-800 bg-slate-900/50">
                <h3 className="text-lg font-bold text-white m-0">ফিক্সড খরচ বিবরণী</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900">
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800">ক্যাটাগরি</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-right">পরিমাণ</th>
                      <th className="px-4 py-3 text-white font-bold text-xs uppercase tracking-wide border-b border-slate-800 text-right">জনপ্রতি</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {fixedCosts.map(f => (
                      <tr key={f.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-100">
                           <span className="bg-slate-800 text-slate-200 px-2 py-0.5 rounded text-xs inline-block">{f.category || f.type}</span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-400 whitespace-nowrap">৳{(f.amount||0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-amber-400 whitespace-nowrap">৳{((f.amount||0)/ (archive?.members?.length || 6)).toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const SummaryCard = ({ label, value, icon, colorClass }) => (
  <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <p className="text-slate-500 text-xs font-semibold m-0">{label}</p>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-lg shadow-sm ${colorClass}`}>
        {icon}
      </div>
    </div>
    <p className="text-2xl font-bold text-slate-800 m-0">{value}</p>
  </div>
);

export default HistoryScreen;

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, collection, onSnapshot, doc, updateDoc, deleteDoc } from '../firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';

const MemberList = () => {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { toasts, showToast, removeToast } = useToast();

  useEffect(() => {
    if (!db) {
      setTimeout(() => setLoading(false), 0);
      return;
    }
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      setMembers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsubscribe();
  }, []);

  const handleDeactivate = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'users', id), { status: currentStatus === 'active' ? 'inactive' : 'active' });
      showToast('সদস্যের স্ট্যাটাস আপডেট হয়েছে।', 'success');
    } catch (err) { console.error(err); showToast('আপডেট ব্যর্থ।', 'error'); }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`${name} কে কি চিরতরে ডিলিট করতে চান?`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        showToast('সদস্য ডিলিট হয়েছে।', 'success');
      } catch (err) { console.error(err); showToast('ডিলিট ব্যর্থ।', 'error'); }
    }
  };

  const negativeCount = members.filter(m => (m.current_balance || 0) < 0).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {negativeCount > 0 && (
        <div className="alert-danger">
          <div style={{ background: 'var(--accent-red)', color: '#fff', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>!</div>
          <div>
            <p style={{ fontWeight: '600' }}>ব্যালেন্স সতর্কতা</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{negativeCount} জন মেম্বারের ব্যালেন্স নেগেটিভ।</p>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>👥 মেম্বার লিস্ট ও ম্যানেজমেন্ট</h2>
          <span className="badge badge-manager">মোট: {members.length}</span>
        </div>

        {loading ? <p style={{ textAlign: 'center', padding: '2rem' }}>লোড হচ্ছে...</p> : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>নাম ও ইউজারনেম</th>
                  <th style={{ textAlign: 'center' }}>রক্ত</th>
                  <th style={{ textAlign: 'center' }}>মোবাইল</th>
                  <th style={{ textAlign: 'right' }}>ডিপোজিট</th>
                  <th style={{ textAlign: 'right' }}>ব্যালেন্স</th>
                  <th style={{ textAlign: 'center' }}>মিল</th>
                  <th style={{ textAlign: 'center' }}>স্ট্যাটাস</th>
                  <th style={{ textAlign: 'right' }}>অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => {
                  const isNeg = (m.current_balance || 0) < 0;
                  return (
                    <tr key={m.id} className={m.status === 'inactive' ? 'row-inactive' : isNeg ? 'row-danger' : ''}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{m.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{m.username}</div>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--accent-red)', fontWeight: '700' }}>{m.bloodGroup || '—'}</td>
                      <td style={{ textAlign: 'center', fontSize: '0.8125rem' }}>{m.mobileNumber || '—'}</td>
                      <td style={{ textAlign: 'right' }}>৳{(m.total_deposit || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: '700', color: isNeg ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{(m.current_balance || 0).toLocaleString()}</td>
                      <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--accent-blue)' }}>{m.total_meals || 0}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${m.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                          {m.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <select 
                          className="form-control" 
                          style={{ width: 'auto', display: 'inline-block', fontSize: '0.8rem', padding: '0.25rem' }}
                          onChange={(e) => {
                            if (e.target.value === 'view') navigate(`/admin/members/${m.id}`);
                            if (e.target.value === 'deactivate') handleDeactivate(m.id, m.status);
                            if (e.target.value === 'delete') handleDelete(m.id, m.name);
                            e.target.value = '';
                          }}
                          value=""
                        >
                          <option value="" disabled>অ্যাকশন</option>
                          <option value="view">প্রোফাইল দেখুন</option>
                          <option value="deactivate">{m.status === 'active' ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন'}</option>
                          <option value="delete" style={{ color: 'var(--accent-red)' }}>ডিলিট করুন</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .row-inactive { opacity: 0.6; filter: grayscale(0.5); }
      `}} />
    </div>
  );
};

export default MemberList;

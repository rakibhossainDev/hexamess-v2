import { useState, useEffect } from 'react';
import { db, doc, onSnapshot, updateDoc, collection, query, where, addDoc } from '../utils/firebase';
import { ToastContainer } from './Toast';
import { useToast } from '../hooks/useToast';
import { useParams, useNavigate } from 'react-router-dom';

const Profile = ({ isAdminView = false }) => {
  const { id: paramId } = useParams();
  const navigate = useNavigate();
  const loggedInUserId = localStorage.getItem('hexamess-user-id');
  const currentUser = JSON.parse(localStorage.getItem('hexa_user') || '{}');
  const isManager = currentUser?.username === 'manager';
  
  // Use paramId if in admin view, otherwise use loggedInUserId
  const userId = isAdminView ? paramId : loggedInUserId;
  
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    photoURL: '',
    bloodGroup: '',
    mobileNumber: '',
    name: '',
    username: '',
    address: '',
    occupation: ''
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newMemberData, setNewMemberData] = useState({ name: '', username: '', password: '' });
  const [addingMember, setAddingMember] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  // Dynamic calculations states
  const [personalDeposits, setPersonalDeposits] = useState(0);
  const [personalMeals, setPersonalMeals] = useState(0);
  const [liveMealRate, setLiveMealRate] = useState(0);

  useEffect(() => {
    if (!db || !userId) {
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const unsubUser = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUser({ id: snap.id, ...data });
        setFormData({
          photoURL: data.photoURL || '',
          bloodGroup: data.bloodGroup || '',
          mobileNumber: data.mobileNumber || '',
          name: data.name || '',
          username: data.username || '',
          address: data.address || '',
          occupation: data.occupation || ''
        });
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const currentMonth = `${new Date().getMonth() + 1}`.padStart(2, '0') + '-' + new Date().getFullYear();

    // Query strictly where memberId == userId
    const unsubDeposits = onSnapshot(query(collection(db, 'deposits'), where('memberId', '==', userId)), snap => {
      const total = snap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
      setPersonalDeposits(total);
    });

    const unsubMeals = onSnapshot(query(collection(db, 'daily_meals'), where('memberId', '==', userId)), snap => {
      const total = snap.docs.reduce((sum, d) => sum + Number(d.data().count || 0), 0);
      setPersonalMeals(total);
    });

    // Global queries for meal rate
    const unsubGlobalMeals = onSnapshot(query(collection(db, 'daily_meals')), snap => {
      const totalM = snap.docs.reduce((sum, d) => sum + Number(d.data().count || 0), 0);
      
      const unsubBazar = onSnapshot(query(collection(db, 'bazar_records')), bazarSnap => {
        const totalB = bazarSnap.docs.reduce((sum, d) => sum + Number(d.data().amount || 0), 0);
        setLiveMealRate(totalM > 0 ? (totalB / totalM) : 0);
      });
      return unsubBazar;
    });

    return () => { unsubUser(); unsubDeposits(); unsubMeals(); unsubGlobalMeals(); };
  }, [userId]);

  const personalCurrentCost = personalMeals * liveMealRate;
  const personalNetBalance = personalDeposits - personalCurrentCost;


  const handleUpdate = async (e) => {
    e.preventDefault();
    if (isAdminView && !isManager) return;
    
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        photoURL: formData.photoURL,
        bloodGroup: formData.bloodGroup,
        mobileNumber: formData.mobileNumber,
        address: formData.address,
        occupation: formData.occupation
      });
      showToast('প্রোফাইল আপডেট হয়েছে!', 'success');
    } catch (err) {
      console.error(err);
      showToast('আপডেট ব্যর্থ হয়েছে।', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setAddingMember(true);
    try {
      await addDoc(collection(db, 'users'), {
        name: newMemberData.name,
        username: newMemberData.username,
        password: newMemberData.password,
        currentMeals: 0,
        currentDeposit: 0,
        lifetimeMeals: 0,
        status: "active",
        createdAt: new Date()
      });
      showToast('নতুন মেম্বার যুক্ত করা হয়েছে!', 'success');
      setNewMemberData({ name: '', username: '', password: '' });
    } catch (err) {
      console.error(err);
      showToast('মেম্বার যুক্ত করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setAddingMember(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "YOUR_UPLOAD_PRESET");
    data.append("cloud_name", "YOUR_CLOUD_NAME");
    
    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload", {
        method: "POST",
        body: data
      });
      const json = await res.json();
      if (json.secure_url) {
        setFormData({ ...formData, photoURL: json.secure_url });
        showToast('ছবি সফলভাবে আপলোড হয়েছে!', 'success');
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      console.error(err);
      showToast('ছবি আপলোড করতে সমস্যা হয়েছে।', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) return <div className="loading">লোড হচ্ছে...</div>;

  if (isManager && !isAdminView) {
    return (
      <div className="w-full p-4 md:p-8">
        <ToastContainer toasts={toasts} removeToast={removeToast} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">অ্যাডমিন প্রোফাইল</h2>
        </div>
        <div className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-[#334155] rounded-xl p-6 md:p-8 shadow-lg max-w-2xl mx-auto">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-6">নতুন মেম্বার যুক্ত করুন</h3>
          <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">নাম (Name)</label>
              <input 
                className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-300 dark:border-[#334155] text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="যেমন: রহিম মিয়া"
                value={newMemberData.name}
                onChange={(e) => setNewMemberData({ ...newMemberData, name: e.target.value })}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">ইউজারনেম (Username)</label>
              <input 
                className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-300 dark:border-[#334155] text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="যেমন: @rahim"
                value={newMemberData.username}
                onChange={(e) => setNewMemberData({ ...newMemberData, username: e.target.value })}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">পাসওয়ার্ড (Password)</label>
              <input 
                type="text"
                className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-300 dark:border-[#334155] text-gray-900 dark:text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="পাসওয়ার্ড দিন"
                value={newMemberData.password}
                onChange={(e) => setNewMemberData({ ...newMemberData, password: e.target.value })}
                required
              />
            </div>
            <button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg transition duration-200 mt-2" disabled={addingMember}>
              {addingMember ? 'লোড হচ্ছে...' : 'মেম্বার অ্যাড করুন'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!user) return <div className="error">ব্যবহারকারী পাওয়া যায়নি।</div>;

  const content = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>{isAdminView ? 'সদস্য প্রোফাইল' : 'আমার প্রোফাইল'}</h2>
        {isAdminView && (
          <button className="btn" onClick={() => navigate(-1)}>← ফিরে যান</button>
        )}
      </div>

      <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {/* Profile Card */}
        <div className="card glass-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: '50%', 
            overflow: 'hidden', 
            border: '4px solid var(--accent-blue)',
            background: 'var(--surface-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {formData.photoURL ? (
              <img src={formData.photoURL} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '3rem' }}>👤</span>
            )}
          </div>
          <div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{formData.name}</h3>
            <p style={{ color: 'var(--text-secondary)' }}>@{formData.username}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <span className={`badge ${user.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
              {user.status === 'active' ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
            </span>
            <span className="badge badge-manager">
              {user.username === 'manager' ? 'ম্যানেজার' : 'সদস্য'}
            </span>
          </div>
        </div>

        {/* Update Form (Hidden for non-managers unless in admin view) */}
        {(isManager || isAdminView) && (
          <div className="card">
            <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent-blue)' }}>তথ্য আপডেট করুন</h3>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {!isAdminView && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">প্রোফাইল ফটো</label>
                <input 
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-gray-900 dark:text-white file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 dark:file:bg-[#334155] dark:file:text-cyan-400"
                />
                {formData.photoURL && (
                  <img src={formData.photoURL} alt="Profile" className="w-16 h-16 rounded-full object-cover mt-3 border-2 border-cyan-500" />
                )}
              </div>
            )}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>রক্তের গ্রুপ</label>
                <select 
                  className="form-control"
                  value={formData.bloodGroup}
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  disabled={isAdminView && !isManager}
                >
                  <option value="">নির্বাচন করুন</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>মোবাইল নম্বর</label>
                <input 
                  className="form-control"
                  placeholder="017XXXXXXXX"
                  value={formData.mobileNumber}
                  onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                  disabled={isAdminView && !isManager}
                />
              </div>
            </div>

            <div className="form-group">
              <label>পেশা</label>
              <input 
                className="form-control"
                placeholder="যেমন: ছাত্র, চাকরিজীবী"
                value={formData.occupation}
                onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                disabled={isAdminView && !isManager}
              />
            </div>

            <div className="form-group">
              <label>বর্তমান ঠিকানা</label>
              <textarea 
                className="form-control"
                placeholder="আপনার বর্তমান ঠিকানা দিন..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                disabled={isAdminView && !isManager}
                style={{ minHeight: '80px', resize: 'vertical' }}
              />
            </div>

            {!isAdminView && (
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={updating || isUploading}>
                {updating ? 'আপডেট হচ্ছে...' : (isUploading ? 'ছবি আপলোড হচ্ছে... (Uploading...)' : 'প্রোফাইল আপডেট করুন')}
              </button>
            )}
          </form>
          </div>
        )}
      </div>

      {/* Stats Summary */}
      <div className="card">
        <h3 style={{ marginBottom: '1.5rem' }}>📊 সংক্ষিপ্ত পরিসংখ্যান</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>মোট জমা</p>
            <p style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-green)' }}>৳{personalDeposits.toFixed(0)}</p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>মোট মিল</p>
            <p style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-blue)' }}>{personalMeals}</p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>চলতি খরচ</p>
            <p style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-purple)' }}>৳{personalCurrentCost.toFixed(0)}</p>
          </div>
          <div style={{ padding: '1rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>বর্তমান ব্যালেন্স</p>
            <p style={{ fontSize: '1.25rem', fontWeight: '700', color: personalNetBalance < 0 ? 'var(--accent-red)' : 'var(--accent-green)' }}>৳{personalNetBalance.toFixed(0)}</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (isAdminView) return content;

  return (
    <div className="w-full p-4 md:p-6 text-white">
      {content}
    </div>
  );
};

export default Profile;

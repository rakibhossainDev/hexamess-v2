import React, { useState, useEffect } from 'react';
import { db, collection, getDocs, addDoc, doc, updateDoc } from '../utils/firebase';

const Profile = () => {
  const [membersList, setMembersList] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [totalMeals, setTotalMeals] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // Using 'users' collection based on typical database structure
        const querySnapshot = await getDocs(collection(db, 'users'));
        const membersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setMembersList(membersData);
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };
    fetchMembers();
  }, []);

  const handleMemberSelect = (e) => {
    const selectedId = e.target.value;
    setSelectedMemberId(selectedId);

    if (selectedId) {
      const selectedMember = membersList.find(m => m.id === selectedId);
      if (selectedMember) {
        setName(selectedMember.name || '');
        setUsername(selectedMember.username || '');
        setPassword(selectedMember.password || '');
        setPhotoURL(selectedMember.photoURL || '');
        setTotalMeals(selectedMember.lifetimeMeals || selectedMember.currentMeals || selectedMember.totalMeals || 0);
      }
    } else {
      // Clear forms
      setName('');
      setUsername('');
      setPassword('');
      setPhotoURL('');
      setTotalMeals(0);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "hexamess");
    data.append("cloud_name", "duu1c3nfd");

    try {
      const response = await fetch("https://api.cloudinary.com/v1_1/duu1c3nfd/image/upload", {
        method: "POST",
        body: data,
      });
      const uploadedImageData = await response.json();
      
      if (uploadedImageData.secure_url) {
        setPhotoURL(uploadedImageData.secure_url);
      }
    } catch (error) {
      console.error("Error uploading image:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    try {
      if (selectedMemberId) {
        // Update existing member
        const memberRef = doc(db, 'users', selectedMemberId);
        await updateDoc(memberRef, {
          name,
          username,
          password,
          photoURL,
          lifetimeMeals: totalMeals
        });
        alert('Member updated successfully!');
      } else {
        // Add new member
        await addDoc(collection(db, 'users'), {
          name,
          username,
          password,
          photoURL,
          lifetimeMeals: totalMeals,
          currentMeals: 0,
          currentDeposit: 0,
          status: "এক্টিভ"
        });
        alert('New member added successfully!');
      }
      
      // Refresh list
      const querySnapshot = await getDocs(collection(db, 'users'));
      const membersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMembersList(membersData);
      
      // Clear form if it was an add operation
      if (!selectedMemberId) {
        setName('');
        setUsername('');
        setPassword('');
        setPhotoURL('');
        setTotalMeals(0);
      }
    } catch (error) {
      console.error("Error saving member:", error);
      alert('An error occurred while saving.');
    }
  };

  const currentUser = JSON.parse(localStorage.getItem('hexa_user') || '{}');
  const isManager = currentUser?.username === 'manager';

  if (!isManager) {
    const myData = membersList.find(m => m.id === currentUser.id) || currentUser;
    return (
      <div className="w-full p-4 md:p-8">
        <div className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-[#334155] p-6 md:p-8 rounded-xl shadow-lg max-w-2xl mx-auto text-center text-gray-900 dark:text-white">
          <div className="flex flex-col items-center gap-4 mb-8">
            {myData.photoURL ? (
              <img src={myData.photoURL} alt={myData.name} className="w-32 h-32 rounded-full object-cover border-4 border-cyan-500 shadow-lg" />
            ) : (
              <div className="w-32 h-32 rounded-full bg-cyan-100 dark:bg-cyan-900 text-cyan-600 dark:text-cyan-300 flex items-center justify-center font-bold text-5xl border-4 border-cyan-500 shadow-lg">
                {myData.name?.charAt(0) || 'U'}
              </div>
            )}
            <div>
              <h2 className="text-3xl font-bold">{myData.name}</h2>
              <p className="text-gray-500 dark:text-gray-400">@{myData.username}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-[#334155] p-4 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Meals</p>
              <p className="text-xl font-bold text-cyan-500">{myData.lifetimeMeals || myData.currentMeals || myData.totalMeals || 0}</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-[#334155] p-4 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Deposit</p>
              <p className="text-xl font-bold text-green-500">৳{myData.currentDeposit || 0}</p>
            </div>
            <div className="bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-[#334155] p-4 rounded-xl">
              <p className="text-sm text-gray-500 dark:text-gray-400">Current Balance</p>
              <p className="text-xl font-bold text-orange-500">৳{myData.currentDeposit || 0}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-[#334155] p-6 md:p-8 rounded-xl shadow-lg max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 text-center">
          {selectedMemberId ? 'মেম্বার আপডেট করুন' : 'নতুন মেম্বার যুক্ত করুন'}
        </h2>
        
        <form onSubmit={handleAddOrUpdate} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">মেম্বার নির্বাচন করুন</label>
            <select 
              value={selectedMemberId} 
              onChange={handleMemberSelect}
              className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-300 dark:border-[#334155] text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500"
            >
              <option value="">➕ নতুন মেম্বার যুক্ত করুন (Add New Member)</option>
              {membersList.map(member => (
                <option key={member.id} value={member.id}>{member.name} ({member.username})</option>
              ))}
            </select>
            {selectedMemberId && (
              <button 
                type="button" 
                onClick={() => { setSelectedMemberId(''); setName(''); setUsername(''); setPassword(''); setPhotoURL(''); setTotalMeals(0); }}
                className="mt-2 text-sm text-red-500 hover:text-red-600 font-semibold underline self-start"
              >
                ✖ ক্যানসেল আপডেট / নতুন মেম্বার অ্যাড করুন
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">নাম</label>
            <input 
              required
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-300 dark:border-[#334155] text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500"
              placeholder="নাম"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">ইউজারনেম</label>
            <input 
              required
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-300 dark:border-[#334155] text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500"
              placeholder="ইউজারনেম"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">পাসওয়ার্ড</label>
            <input 
              required
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-300 dark:border-[#334155] text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500"
              placeholder="পাসওয়ার্ড"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">মোট মিল (Total Meals)</label>
            <input 
              type="number"
              value={totalMeals}
              onChange={(e) => setTotalMeals(Number(e.target.value))}
              className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-300 dark:border-[#334155] text-gray-900 dark:text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-cyan-500"
              placeholder="মোট মিল"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-900 dark:text-white">প্রোফাইল ছবি</label>
            <input 
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 dark:file:bg-[#334155] dark:file:text-cyan-400"
            />
            {isUploading && <p className="text-sm text-cyan-500 mt-1">আপলোড হচ্ছে...</p>}
            {photoURL && !isUploading && (
              <img src={photoURL} alt="Profile Preview" className="w-20 h-20 object-cover rounded-full mt-2 border-2 border-cyan-500" />
            )}
          </div>

          <button 
            type="submit" 
            disabled={isUploading}
            className={`w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-3 px-4 rounded-lg transition duration-200 mt-4 ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {selectedMemberId ? 'আপডেট করুন' : 'নতুন মেম্বার অ্যাড করুন'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;

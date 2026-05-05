/**
 * Firestore Seed Script — HexaMess v2
 *
 * Populates: users (with roles), config/settings, and initial deposits.
 * Run once via the seed banner on the Admin Dashboard.
 */

import { db, collection, addDoc, getDocs, setDoc, doc } from './firebase.js';
import { getCurrentMonthId } from './utils/monthUtils.js';

const MEMBERS = [
  { name: 'রাকিব হোসেন',       username: 'admin',  password: '112233', role: 'manager', status: 'active', total_deposit: 5000, current_balance: 1200, total_meals: 42 },
  { name: 'মেহেদী হাসান',       username: 'mehedi', password: 'password', role: 'member',  status: 'active', total_deposit: 4000, current_balance: 800,  total_meals: 38 },
  { name: 'সাকিব আল হাসান',    username: 'sakib',  password: 'password', role: 'member',  status: 'active', total_deposit: 3500, current_balance: -500, total_meals: 35 },
  { name: 'মুশফিকুর রহিম',      username: 'mushfiq',password: 'password', role: 'member',  status: 'active', total_deposit: 4500, current_balance: 600,  total_meals: 40 },
  { name: 'তামিম ইকবাল',       username: 'tamim',  password: 'password', role: 'member',  status: 'active', total_deposit: 3000, current_balance: -200, total_meals: 30 },
  { name: 'মাহমুদউল্লাহ',        username: 'riyad',  password: 'password', role: 'member',  status: 'active', total_deposit: 4000, current_balance: 1000, total_meals: 36 },
];

export async function seedUsers() {
  if (!db) {
    console.error('Firebase not initialized!');
    return;
  }

  // Check if already seeded
  const existing = await getDocs(collection(db, 'users'));
  if (existing.size > 0) {
    console.warn(`'users' collection already has ${existing.size} docs. Skipping seed.`);
    return;
  }

  const monthId = getCurrentMonthId();
  let managerId = null;
  let managerName = '';

  for (const member of MEMBERS) {
    const docRef = await addDoc(collection(db, 'users'), member);
    console.log(`✓ Added: ${member.name} (${member.role})`);

    // Track the manager
    if (member.role === 'manager') {
      managerId = docRef.id;
      managerName = member.name;
    }

    // Create an initial deposit record
    await addDoc(collection(db, 'deposits'), {
      month_id: monthId,
      user_id: docRef.id,
      user_name: member.name,
      amount: member.total_deposit,
      date: new Date().toISOString(),
    });
  }

  // Create config/settings doc
  await setDoc(doc(db, 'config', 'settings'), {
    current_month_id: monthId,
    manager_id: managerId,
    manager_name: managerName,
  });

  console.log('🎉 Seeding complete! 6 members + config + deposits added.');
}

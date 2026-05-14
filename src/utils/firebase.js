import { db, doc, setDoc, updateDoc, increment } from '../firebase';

/**
 * Saves or updates a daily meal entry for a user.
 * Ensures that both the daily_meals record and the user's aggregate total_meals are updated.
 */
export const saveMealEntry = async (config, selectedDate, userId, breakfast, lunch, dinner, prevTotal) => {
  if (!config) throw new Error("Config not found");

  const b = Number(breakfast) || 0;
  const l = Number(lunch) || 0;
  const d = Number(dinner) || 0;
  const newDayTotal = b + l + d;
  const delta = newDayTotal - prevTotal;

  const mealDocId = `${config.current_month_id}_${selectedDate}_${userId}`;
  
  // 1. Update/Set the daily meal record
  await setDoc(doc(db, 'daily_meals', mealDocId), {
    month_id: config.current_month_id,
    date: selectedDate,
    user_id: userId,
    breakfast: b,
    lunch: l,
    dinner: d,
    total: newDayTotal
  }, { merge: true });

  // 2. Update the user's aggregate total meals for the month
  await updateDoc(doc(db, 'users', userId), {
    total_meals: increment(delta)
  });

  return { newDayTotal, delta };
};

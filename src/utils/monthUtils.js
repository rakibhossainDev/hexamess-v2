/**
 * Month & Date Utilities for HexaMess
 * Central source of truth for month IDs, labels, and expense categories.
 */

/** Get current month ID in YYYY-MM format */
export function getCurrentMonthId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/** Get next month ID */
export function getNextMonthId(monthId) {
  const [y, m] = monthId.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

/** Convert month ID to Bengali label, e.g. "2026-05" → "মে ২০২৬" */
const BN_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
];

export function getMonthLabel(monthId) {
  const [y, m] = monthId.split('-').map(Number);
  return `${BN_MONTHS[m - 1]} ${y}`;
}

/** Today as YYYY-MM-DD */
export function getTodayDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Today formatted for display in English */
export function getTodayDisplay() {
  return new Date().toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Format YYYY-MM-DD to DD/MM/YYYY */
export function formatDisplayDate(isoString) {
  if (!isoString) return '—';
  const [y, m, d] = isoString.split('-');
  return `${d}/${m}/${y}`;
}

/** Get Today as ISO YYYY-MM-DD */
export function getTodayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Fixed expense categories */
export const EXPENSE_CATEGORIES = [
  'বাড়ি ভাড়া',
  'ওয়াইফাই',
  'বিদ্যুৎ',
  'আসবাবপত্র',
  'নাস্তা/পার্টি',
];

/** Bengali month names for selectors */
export const MONTH_OPTIONS = BN_MONTHS.map((name, i) => ({
  value: String(i + 1).padStart(2, '0'),
  label: name,
}));

/** Year range for history selector */
export function getYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 3; y--) {
    years.push(y);
  }
  return years;
}

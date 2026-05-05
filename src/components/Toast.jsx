import { useEffect, useState } from 'react';

const Toast = ({ message, type = 'success', onClose, duration = 3000 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icon = type === 'success' ? '✓' : '✕';
  const label = type === 'success' ? 'সফল!' : 'ত্রুটি!';

  return (
    <div className={`toast toast-${type} ${isVisible ? 'toast-visible' : ''}`}>
      <div className="toast-icon" style={{
        background: type === 'success' ? 'var(--accent-green)' : 'var(--accent-red)',
        color: '#fff',
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 'bold',
        fontSize: '0.875rem',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: '600', fontSize: '0.875rem', marginBottom: '0.125rem' }}>{label}</p>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{message}</p>
      </div>
      <button
        onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '1.25rem',
          padding: '0 0.25rem',
          lineHeight: 1
        }}
        aria-label="বন্ধ করুন"
      >
        ×
      </button>
    </div>
  );
};

export const ToastContainer = ({ toasts, removeToast }) => (
  <div className="toast-container">
    {toasts.map(t => (
      <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
    ))}
  </div>
);

export default Toast;

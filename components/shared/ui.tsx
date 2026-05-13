'use client';
import { useState, useEffect, useCallback } from 'react';

// ── Toast ──────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info';
let toastFn: ((msg: string, type?: ToastType) => void) | null = null;

export function setToastFn(fn: typeof toastFn) { toastFn = fn; }
export function toast(msg: string, type: ToastType = 'info') {
  toastFn?.(msg, type);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: ToastType }[]>([]);

  useEffect(() => {
    setToastFn((msg, type = 'info') => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
    });
  }, []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(t => (
        <div key={t.id} className={`
          px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2
          ${t.type === 'success' ? 'bg-green-600 text-white' :
            t.type === 'error'   ? 'bg-red-500 text-white' :
                                   'bg-gray-800 text-white'}
          animate-in slide-in-from-right-4 fade-in duration-300
        `}>
          {t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : 'ℹ️'}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Spinner ────────────────────────────────────────────────────
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-10 h-10' : 'w-6 h-6';
  return (
    <div className={`${s} border-2 border-primary/30 border-t-primary rounded-full animate-spin`} />
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  );
}

// ── Status Badge ───────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    booked:      'bg-orange-100 text-orange-700',
    checked_in:  'bg-green-100 text-green-700',
    checked_out: 'bg-blue-100 text-blue-700',
    cancelled:   'bg-red-100 text-red-700',
    pending:     'bg-orange-100 text-orange-700',
    active:      'bg-green-100 text-green-700',
    rejected:    'bg-red-100 text-red-700',
    open:        'bg-red-100 text-red-700',
    in_progress: 'bg-orange-100 text-orange-700',
    resolved:    'bg-green-100 text-green-700',
    closed:      'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold uppercase ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────────
export function ConfirmDialog({
  title, message, onConfirm, onCancel,
  confirmText = 'Confirm', confirmClass = 'btn-danger',
}: {
  title: string; message: string;
  onConfirm: () => void; onCancel: () => void;
  confirmText?: string; confirmClass?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 border border-gray-200 rounded-xl py-2.5 font-semibold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-bold ${confirmClass}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────
export function EmptyState({ icon = '📭', title, desc }: { icon?: string; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-gray-700 font-semibold text-lg">{title}</h3>
      {desc && <p className="text-gray-400 text-sm mt-1">{desc}</p>}
    </div>
  );
}

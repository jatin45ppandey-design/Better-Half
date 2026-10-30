import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const icons = {
          success: <CheckCircle2 className="w-5 h-5 text-[#248A62] shrink-0" />,
          error: <AlertCircle className="w-5 h-5 text-[#D94C65] shrink-0" />,
          info: <Info className="w-5 h-5 text-[#9670E8] shrink-0" />,
        }[toast.type];

        const borderStyles = {
          success: 'border-[#C6ECD9] bg-[#FFFFFF]',
          error: 'border-[#F8D2D9] bg-[#FFFFFF]',
          info: 'border-[#EAE3F3] bg-[#FFFFFF]',
        }[toast.type];

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg shadow-[#211A2D]/5 transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${borderStyles}`}
          >
            {icons}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#211A2D] leading-snug">
                {toast.title}
              </p>
              {toast.message && (
                <p className="text-xs text-[#756D82] mt-0.5 leading-relaxed">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="text-[#9D96A8] hover:text-[#211A2D] p-1 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

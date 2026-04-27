import React, { useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle, AlertTriangle, Info, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

interface FeedbackContextType {
  toast: (message: string, type?: ToastType) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = React.createContext<FeedbackContextType | undefined>(undefined);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmDialog({ options, resolve });
    });
  }, []);

  const handleConfirm = (value: boolean) => {
    if (confirmDialog) {
      confirmDialog.resolve(value);
      setConfirmDialog(null);
    }
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto"
            >
              <div className={`px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 min-w-[300px] border border-white/10 ${
                t.type === 'success' ? 'bg-green-600' :
                t.type === 'error' ? 'bg-red-600' :
                t.type === 'warning' ? 'bg-amber-600' : 'bg-blue-600'
              } text-white`}>
                {t.type === 'success' && <CheckCircle size={20} />}
                {t.type === 'error' && <AlertCircle size={20} />}
                {t.type === 'warning' && <AlertTriangle size={20} />}
                {t.type === 'info' && <Info size={20} />}
                <p className="text-sm font-medium flex-1">{t.message}</p>
                <button onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))} className="opacity-70 hover:opacity-100 transition-opacity">
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm Dialog Portal */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-[#161616] border border-[#333333] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden overflow-y-auto max-h-[90vh]"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        confirmDialog.options.variant === 'danger' ? 'bg-red-100/10 text-red-500' : 'bg-blue-100/10 text-blue-500'
                    }`}>
                        {confirmDialog.options.variant === 'danger' ? <AlertTriangle size={20} /> : <Info size={20} />}
                    </div>
                    <h3 className="text-xl font-bold text-white">{confirmDialog.options.title}</h3>
                </div>
                <p className="text-[#A0A0A0] text-sm leading-relaxed mb-8">
                  {confirmDialog.options.message}
                </p>
                <div className="flex items-center justify-end gap-3">
                  <Button 
                    variant="ghost" 
                    onClick={() => handleConfirm(false)}
                    className="text-white hover:bg-white/5"
                  >
                    {confirmDialog.options.cancelText || 'Cancelar'}
                  </Button>
                  <Button 
                    onClick={() => handleConfirm(true)}
                    className={confirmDialog.options.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:opacity-90'}
                  >
                    {confirmDialog.options.confirmText || 'Confirmar'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider');
  return context;
}

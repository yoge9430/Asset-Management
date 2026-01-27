
import React, { useState, useRef, useEffect, createContext, useContext } from 'react';

// --- THEME CONTEXT ---
interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({ isDark: false, toggleTheme: () => {} });

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme: () => setIsDark(!isDark) }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const ThemeToggle: React.FC = () => {
  const { isDark, toggleTheme } = useContext(ThemeContext);
  return (
    <button 
      onClick={toggleTheme} 
      className="p-2 rounded-full bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-yellow-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
      title="Toggle Dark Mode"
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
      ) : (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
      )}
    </button>
  );
};

// --- TOAST CONTEXT ---
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContextType {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} });

export const useToast = () => useContext(ToastContext);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`px-4 py-3 rounded-xl shadow-lg text-white font-medium text-sm flex items-center gap-2 animate-slide-in
              ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}
            `}
          >
            <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '⚠️' : 'ℹ️'}</span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// --- BUTTON ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', size = 'md', isLoading, icon, className = '', disabled, ...props 
}) => {
  const baseStyle = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.98]";
  
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-none focus:ring-indigo-500 border border-transparent",
    secondary: "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm focus:ring-slate-200",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-md shadow-rose-200 dark:shadow-none focus:ring-rose-500 border border-transparent",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200 dark:shadow-none focus:ring-emerald-500 border border-transparent",
    outline: "bg-transparent border border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 focus:ring-indigo-500",
    ghost: "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-200"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm", 
    lg: "px-6 py-3.5 text-base"
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!isLoading && icon && <span className="mr-2">{icon}</span>}
      {children}
    </button>
  );
};

// --- CARD ---
export const Card: React.FC<{ children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }> = ({ children, className = '', title, action }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200/60 dark:border-slate-700 overflow-hidden transition-all hover:shadow-md ${className}`}>
    {(title || action) && (
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
        {title && <h3 className="font-bold text-slate-800 dark:text-white text-lg tracking-tight">{title}</h3>}
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6 text-slate-900 dark:text-slate-200">{children}</div>
  </div>
);

// --- INPUT ---
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => (
  <div className="mb-4 w-full">
    {label && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
    <input
      className={`block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 border transition-colors placeholder-slate-400 dark:placeholder-slate-500 ${error ? 'border-rose-300 dark:border-rose-700 focus:border-rose-500 focus:ring-rose-500' : ''} ${className}`}
      {...props}
    />
    {error && <p className="mt-1.5 text-sm text-rose-600 dark:text-rose-400 flex items-center">
      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      {error}
    </p>}
  </div>
);

// --- MULTI SELECT (Searchable) ---
interface MultiSelectProps {
  label?: string;
  options: { value: string; label: string; subLabel?: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({ label, options, selectedValues, onChange, placeholder = 'Select items...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const removeValue = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter(v => v !== value));
  };

  return (
    <div className="mb-4 w-full relative" ref={wrapperRef}>
      {label && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <div 
        className="min-h-[46px] w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-sm cursor-text sm:text-sm py-1.5 px-3 flex flex-wrap gap-2 items-center hover:border-indigo-400 transition-colors focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500"
        onClick={() => setIsOpen(true)}
      >
        {selectedValues.length === 0 && !searchTerm && (
          <span className="text-slate-400 select-none ml-1">{placeholder}</span>
        )}
        
        {selectedValues.map(val => {
          const opt = options.find(o => o.value === val);
          return (
            <span key={val} className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
              {opt?.label}
              <button 
                type="button"
                onClick={(e) => removeValue(val, e)} 
                className="ml-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 hover:text-indigo-600 focus:outline-none"
              >
                <span className="sr-only">Remove</span>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </span>
          );
        })}

        <input 
          type="text" 
          className="flex-1 bg-transparent border-none focus:ring-0 p-1 min-w-[60px] text-sm text-slate-900 dark:text-white placeholder-slate-400"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onFocus={() => setIsOpen(true)}
        />
        
        <div className="pointer-events-none text-slate-400 pr-1">
             <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 max-h-60 overflow-auto focus:outline-none py-1">
           {filteredOptions.length === 0 ? (
             <div className="py-2 px-3 text-sm text-slate-500 dark:text-slate-400">No assets found.</div>
           ) : (
             filteredOptions.map(opt => {
               const isSelected = selectedValues.includes(opt.value);
               return (
                 <div 
                    key={opt.value} 
                    className={`cursor-pointer select-none relative py-2.5 pl-3 pr-9 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/30' : ''}`}
                    onClick={() => toggleOption(opt.value)}
                 >
                    <div className="flex flex-col">
                        <span className={`block truncate text-sm ${isSelected ? 'font-semibold text-indigo-900 dark:text-indigo-300' : 'font-normal text-slate-900 dark:text-slate-200'}`}>
                            {opt.label}
                        </span>
                        {opt.subLabel && <span className="text-xs text-slate-500 dark:text-slate-400">{opt.subLabel}</span>}
                    </div>
                    {isSelected && (
                      <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600 dark:text-indigo-400">
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      </span>
                    )}
                 </div>
               );
             })
           )}
        </div>
      )}
    </div>
  );
};

// --- SELECT ---
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({ label, options, className = '', ...props }) => (
  <div className="mb-4 w-full">
    {label && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
    <div className="relative">
      <select
        className={`block w-full appearance-none rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 pr-8 border transition-colors ${className}`}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </div>
    </div>
  </div>
);

// --- QUANTITY STEPPER ---
interface QuantityStepperProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
}

export const QuantityStepper: React.FC<QuantityStepperProps> = ({ label, value, onChange, min = 1, max = 100 }) => {
  return (
    <div className="mb-4">
      {label && <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <div className="flex items-center">
        <button 
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-10 h-10 rounded-l-xl border border-r-0 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
          disabled={value <= min}
        >
          -
        </button>
        <input 
          type="number"
          className="h-10 w-20 text-center border-y border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-0 focus:border-indigo-500 z-10"
          value={value}
          onChange={(e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val)) onChange(val);
          }}
        />
        <button 
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="w-10 h-10 rounded-r-xl border border-l-0 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center transition-colors"
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
};

// --- BADGE ---
export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    APPROVED: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    REJECTED: 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
    CHECKED_OUT: 'bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800',
    RETURNED: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    GATE_VERIFIED: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
  };

  const icon = {
    PENDING: '⏳',
    APPROVED: '✅',
    REJECTED: '❌',
    CHECKED_OUT: '📤',
    RETURNED: '📥',
    GATE_VERIFIED: '🛂'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${styles[status] || 'bg-slate-100 text-slate-800 border-slate-200'}`}>
      <span className="mr-1.5 opacity-80">{icon[status as keyof typeof icon]}</span>
      {status.replace('_', ' ')}
    </span>
  );
};

// --- SKELETON ---
export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded-lg ${className}`}></div>
);

// --- MODAL ---
export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} aria-hidden="true"></div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        <div className="relative inline-block align-bottom bg-white dark:bg-slate-800 rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full border border-slate-200 dark:border-slate-700">
          <div className="bg-white dark:bg-slate-800 px-6 pt-6 pb-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white" id="modal-title">{title}</h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-slate-700 dark:text-slate-300">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

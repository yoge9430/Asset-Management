import React, { useState, useEffect, useContext, createContext, useRef, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME } from './constants';
import { User, UserRole, Request, RequestStatus, Notification, Asset, Deployment } from './types';
import * as api from './services/mockBackend';
import { Button, Card, Input, StatusBadge, Modal, Skeleton, Select, QuantityStepper, MultiSelect, ThemeProvider, ThemeToggle, ToastProvider, useToast, CreatableSelect } from './components/UI';
import jsQR from 'jsqr';
import { QRCodeCanvas } from 'qrcode.react';

// --- AUTH CONTEXT ---
interface AuthContextType {
  user: User | null;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  updateUserSession: (updatedUser: User) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = api.getSession();
    if (session) setUser(session);
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string) => {
    const loggedUser = await api.login(email, password);
    setUser(loggedUser);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  const updateUserSession = (updatedUser: User) => {
      setUser(updatedUser);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUserSession, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

// --- GLOBAL LOADING BAR ---
const GlobalLoadingBar: React.FC = () => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return api.subscribeToLoading((isLoading) => setLoading(isLoading));
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-indigo-100/20 pointer-events-none">
        <div className="h-full bg-indigo-600 shadow-[0_0_10px_rgba(79,70,229,0.7)]" 
             style={{ width: '100%', animation: 'global-indeterminate 1.5s infinite ease-in-out' }} 
        />
        <style>{`
            @keyframes global-indeterminate {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
        `}</style>
    </div>
  );
};

// --- NAVBAR ---
const Navbar: React.FC = () => {
  const { user, logout } = useContext(AuthContext);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [pendingCount, setPendingCount] = useState(0); 
  const [returnsCount, setReturnsCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); 

  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
          const userNotifs = await api.getNotifications(user.id);
          setNotifs(userNotifs);
          if (user.role === UserRole.ADMIN) {
              const reqs = await api.getRequests();
              const pending = reqs.filter(r => r.status === RequestStatus.PENDING).length;
              const returned = reqs.filter(r => r.status === RequestStatus.RETURNED).length;
              setPendingCount(pending);
              setReturnsCount(returned);
          }
      };
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
              setShowNotifs(false);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
      setIsMobileMenuOpen(false);
  }, [location]);

  const handleMarkRead = async (id: string) => {
      await api.markNotificationRead(id);
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  const isActive = (path: string) => location.pathname === path 
    ? "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 font-semibold" 
    : "text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium";

  const navLinkClass = (path: string) => `px-4 py-2 rounded-lg text-sm transition-all w-full text-left md:w-auto ${isActive(path)}`;

  return (
    <nav className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4 md:gap-8">
            <div className="flex md:hidden">
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 focus:outline-none">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                    </svg>
                </button>
            </div>
            <div className="flex-shrink-0 cursor-pointer flex items-center gap-2" onClick={() => navigate('/')}>
              <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="text-slate-900 dark:text-white font-bold text-xl tracking-tight hidden sm:block">{APP_NAME}</span>
            </div>
            <div className="hidden md:flex items-baseline space-x-1">
              {user?.role === UserRole.ADMIN && (
                <>
                  <button onClick={() => navigate('/admin')} className={navLinkClass('/admin')}>Dashboard</button>
                  <button onClick={() => navigate('/admin/approvals')} className={`${navLinkClass('/admin/approvals')} relative flex items-center`}>
                      Approvals
                      {pendingCount > 0 && (
                          <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white font-bold shadow-sm animate-pulse">
                              {pendingCount > 9 ? '9+' : pendingCount}
                          </span>
                      )}
                  </button>
                  <button onClick={() => navigate('/admin/returns')} className={`${navLinkClass('/admin/returns')} relative flex items-center`}>
                      Returns
                      {returnsCount > 0 && (
                          <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white font-bold shadow-sm">
                              {returnsCount > 9 ? '9+' : returnsCount}
                          </span>
                      )}
                  </button>
                  <button onClick={() => navigate('/admin/inventory')} className={navLinkClass('/admin/inventory')}>Inventory</button>
                  <button onClick={() => navigate('/admin/deployments')} className={navLinkClass('/admin/deployments')}>Deployed HW</button>
                  <button onClick={() => navigate('/admin/users')} className={navLinkClass('/admin/users')}>Users</button>
                </>
              )}
              {user?.role === UserRole.USER && (
                 <button onClick={() => navigate('/user')} className={navLinkClass('/user')}>My Dashboard</button>
              )}
              {user?.role === UserRole.GUARD && (
                 <button onClick={() => navigate('/guard')} className={navLinkClass('/guard')}>Gate Verification</button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 md:gap-5">
             <ThemeToggle />
             <div className="relative" ref={notifRef}>
                 <div onClick={() => setShowNotifs(!showNotifs)} className="relative group cursor-pointer p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    <svg className={`h-6 w-6 ${unreadCount > 0 ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unreadCount > 0 && <span className="absolute top-1 right-2 block h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 bg-rose-500" />}
                 </div>
                 {showNotifs && (
                     <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                         <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
                             <h3 className="text-sm font-bold text-slate-800 dark:text-white">Notifications</h3>
                             {unreadCount > 0 && <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-bold">{unreadCount} new</span>}
                         </div>
                         <div className="max-h-80 overflow-y-auto">
                             {notifs.length === 0 ? (
                                 <div className="p-6 text-center text-slate-500 text-sm">No notifications</div>
                             ) : (
                                 notifs.map(n => (
                                     <div key={n.id} className={`p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${!n.read ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`} onClick={() => handleMarkRead(n.id)}>
                                         <p className={`text-sm mb-1 ${!n.read ? 'font-semibold text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{n.message}</p>
                                         <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                                     </div>
                                 ))
                             )}
                         </div>
                     </div>
                 )}
             </div>
            <div className="flex items-center pl-4 border-l border-slate-200 dark:border-slate-700">
              <div className="hidden md:flex flex-col items-end mr-3">
                 <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-none">{user?.name}</span>
                 <button onClick={() => navigate('/profile')} className="text-xs text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 mt-1 font-medium hover:underline">My Profile</button>
              </div>
              <button onClick={logout} className="p-2 rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all focus:outline-none" title="Sign out">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-2 pb-4 space-y-1 shadow-lg">
             <div className="py-3 border-b border-slate-100 dark:border-slate-800 mb-2 flex items-center justify-between">
                 <span className="text-sm font-semibold text-slate-900 dark:text-white">{user?.name}</span>
                 <button onClick={() => navigate('/profile')} className="text-xs text-indigo-500 font-bold">Profile</button>
             </div>
             {user?.role === UserRole.ADMIN && (
                <>
                  <button onClick={() => navigate('/admin')} className={navLinkClass('/admin')}>Dashboard</button>
                  <button onClick={() => navigate('/admin/approvals')} className={`${navLinkClass('/admin/approvals')} flex justify-between items-center`}>
                      Approvals
                      {pendingCount > 0 && <span className="bg-rose-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{pendingCount}</span>}
                  </button>
                  <button onClick={() => navigate('/admin/returns')} className={`${navLinkClass('/admin/returns')} flex justify-between items-center`}>
                      Returns
                      {returnsCount > 0 && <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">{returnsCount}</span>}
                  </button>
                  <button onClick={() => navigate('/admin/inventory')} className={navLinkClass('/admin/inventory')}>Inventory</button>
                  <button onClick={() => navigate('/admin/deployments')} className={navLinkClass('/admin/deployments')}>Deployed HW</button>
                  <button onClick={() => navigate('/admin/users')} className={navLinkClass('/admin/users')}>Users</button>
                </>
              )}
              {user?.role === UserRole.USER && (
                 <button onClick={() => navigate('/user')} className={navLinkClass('/user')}>My Dashboard</button>
              )}
              {user?.role === UserRole.GUARD && (
                 <button onClick={() => navigate('/guard')} className={navLinkClass('/guard')}>Gate Verification</button>
              )}
        </div>
      )}
    </nav>
  );
};

// --- LOGIN ---
const Login: React.FC = () => {
  const { login, user } = useContext(AuthContext);
  const [email, setEmail] = useState('admin@e9ogral.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
        if (user.role === UserRole.ADMIN) navigate('/admin');
        else if (user.role === UserRole.GUARD) navigate('/guard');
        else navigate('/user');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
      setLoading(true);
      setError('');
      try {
          await login('john@e9ogral.com', 'google-auth-token'); 
      } catch (err: any) {
          setError(err.message);
      } finally {
          setLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-slate-900 overflow-hidden">
      <div className="absolute inset-0 z-0 bg-cover bg-center opacity-60 dark:opacity-40 transition-opacity" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80")' }}>
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
      </div>
      <div className="absolute top-6 right-6 z-20"><ThemeToggle /></div>
      <div className="relative z-10 w-full max-w-md p-8">
        <div className="bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 p-8">
            <div className="text-center mb-10">
                <div className="inline-flex h-16 w-16 bg-indigo-600 rounded-2xl items-center justify-center mb-4 shadow-lg shadow-indigo-900/50">
                    <span className="text-white font-bold text-3xl">E</span>
                </div>
                <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2">E9OGRAL</h1>
                <p className="text-indigo-200 text-sm font-medium tracking-wide">ENTERPRISE ASSET MANAGEMENT</p>
            </div>
            <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-4">
                   <div>
                       <label className="text-indigo-100 text-xs font-bold uppercase ml-1 block mb-1">Email Address</label>
                       <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="block w-full rounded-xl border-white/10 bg-black/20 text-white placeholder-indigo-200/50 focus:border-indigo-400 focus:ring-indigo-400 py-3.5 px-4 transition-all" placeholder="name@company.com" />
                   </div>
                   <div>
                       <label className="text-indigo-100 text-xs font-bold uppercase ml-1 block mb-1">Password</label>
                       <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="block w-full rounded-xl border-white/10 bg-black/20 text-white placeholder-indigo-200/50 focus:border-indigo-400 focus:ring-indigo-400 py-3.5 px-4 transition-all" placeholder="••••••••" />
                   </div>
                </div>
                {error && <div className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-3 text-rose-200 text-sm text-center">{error}</div>}
                <button type="submit" disabled={loading} className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/40 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed">
                    {loading ? 'Authenticating...' : 'Sign In'}
                </button>
            </form>
            <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-white/20"></div>
                <span className="px-3 text-indigo-200 text-xs font-medium">OR CONTINUE WITH</span>
                <div className="flex-1 border-t border-white/20"></div>
            </div>
            <button type="button" onClick={handleGoogleLogin} className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-800 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google Account
            </button>
            <div className="mt-8 pt-6 border-t border-white/10 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => { setEmail('admin@e9ogral.com'); setPassword('demo123'); }} className="px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-indigo-100 transition-colors">Admin Demo</button>
                <button type="button" onClick={() => { setEmail('john@e9ogral.com'); setPassword('demo123'); }} className="px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-indigo-100 transition-colors">User Demo</button>
                <button type="button" onClick={() => { setEmail('guard@e9ogral.com'); setPassword('demo123'); }} className="px-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-indigo-100 transition-colors">Guard Demo</button>
            </div>
        </div>
        <p className="text-center text-slate-400 text-xs mt-8">© 2024 E9OGRAL Systems. Secure Access.</p>
      </div>
    </div>
  );
};

// --- USER PROFILE ---
const UserProfile: React.FC = () => {
    const { user, updateUserSession } = useContext(AuthContext);
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phoneNumber || '');
    const [email, setEmail] = useState(user?.email || '');
    const [dept, setDept] = useState(user?.department || '');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        if (user) {
            setName(user.name);
            setPhone(user.phoneNumber || '');
            setEmail(user.email);
            setDept(user.department || '');
        }
    }, [user]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const updated = await api.updateUser(user!.id, { name, phoneNumber: phone, email, department: dept });
            updateUserSession(updated);
            addToast('Profile updated successfully!', 'success');
        } catch (err: any) {
            addToast(err.message || 'Failed to update profile.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">My Profile</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Manage your account settings and contact information.</p>
            <Card className="mb-6">
                <form onSubmit={handleUpdate} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                        <Input label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1-555-0000" required />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="w-full"><Input label="Email Address" value={email} onChange={e => setEmail(e.target.value)} required type="email" /></div>
                         <Input label="Department" value={dept} onChange={e => setDept(e.target.value)} />
                    </div>
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                        <Button type="submit" isLoading={loading}>Save Changes</Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

// --- ADMIN DASHBOARD ---
const AdminDashboard: React.FC = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [adminContact, setAdminContact] = useState('');
    const { addToast } = useToast();
    const navigate = useNavigate();
  
    useEffect(() => {
      const fetchData = async () => {
          setLoading(true);
          const [reqs, assts, deps, settings] = await Promise.all([
              api.getRequests(), 
              api.getAssets(), 
              api.getDeployments(),
              api.getSystemSettings()
          ]);
          setRequests(reqs);
          setAssets(assts);
          setDeployments(deps);
          setAdminContact(settings.adminContactNumber);
          setLoading(false);
      };
      fetchData();
    }, []);

    const saveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.updateSystemSettings({ adminContactNumber: adminContact });
            addToast('System settings updated', 'success');
            setShowSettings(false);
        } catch (err: any) {
            addToast(err.message, 'error');
        }
    };

    const stats = useMemo(() => {
        const total = assets.length;
        const available = assets.filter(a => a.status === 'AVAILABLE').length;
        const inUse = assets.filter(a => a.status === 'IN_USE').length;
        const deployed = assets.filter(a => a.status === 'DEPLOYED').length;
        const pending = requests.filter(r => r.status === RequestStatus.PENDING).length;
        
        // Calculate overdue: Approved items past return date
        const overdue = requests.filter(r => 
            (r.status === RequestStatus.APPROVED || r.status === RequestStatus.CHECKED_OUT) && 
            new Date(r.returnDate) < new Date()
        ).length;

        const utilization = total > 0 ? Math.round(((total - available) / total) * 100) : 0;
        
        // Mock Valuation
        const valuation = total * 1250; // Avg $1250 per asset mock

        return { total, available, inUse, deployed, pending, overdue, utilization, valuation };
    }, [assets, requests, deployments]);
  
    const recentRequests = [...requests].sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()).slice(0, 5);
  
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Executive Dashboard</h1>
                <p className="text-slate-500 text-sm mt-1">Overview of enterprise assets and approval workflows.</p>
            </div>
            <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setShowSettings(true)} icon={<span>⚙️</span>}>Settings</Button>
                <Button size="sm" onClick={() => addToast("Report generated & downloaded", "success")} icon={<span>📥</span>}>Export Report</Button>
            </div>
        </div>
        
        {/* Detailed KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {loading ? (Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)) : (
              <>
                  <Card className="bg-gradient-to-br from-indigo-600 to-violet-600 text-white border-none shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                      <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>
                      </div>
                      <div className="relative z-10">
                          <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="bg-white/20 p-1 rounded">⏳</span> Pending Actions
                          </div>
                          <div className="text-5xl font-extrabold tracking-tight">{stats.pending}</div>
                          <div className="mt-3 inline-flex items-center text-xs font-medium bg-white/10 px-2 py-1 rounded-lg backdrop-blur-sm border border-white/10">
                              {stats.pending > 0 ? 'Requires immediate review' : 'All caught up'}
                          </div>
                      </div>
                  </Card>

                  <Card className="hover:shadow-lg transition-all border-l-4 border-l-emerald-500">
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Inventory Value</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-white">${(stats.valuation / 1000).toFixed(1)}k</div>
                      <div className="mt-4 flex items-center justify-between text-xs">
                          <span className="text-slate-400">{stats.total} Total Assets</span>
                          <span className="text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded">+12 this month</span>
                      </div>
                  </Card>

                  <Card className="hover:shadow-lg transition-all border-l-4 border-l-blue-500">
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Asset Utilization</div>
                      <div className="text-3xl font-bold text-slate-900 dark:text-white">{stats.utilization}%</div>
                      <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div className="bg-blue-500 h-full rounded-full transition-all duration-1000" style={{ width: `${stats.utilization}%` }}></div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400 flex justify-between">
                          <span>{stats.inUse + stats.deployed} In Use</span>
                          <span>{stats.available} Available</span>
                      </div>
                  </Card>

                  <Card className={`hover:shadow-lg transition-all border-l-4 ${stats.overdue > 0 ? 'border-l-rose-500' : 'border-l-slate-300'}`}>
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Overdue Returns</div>
                      <div className={`text-3xl font-bold ${stats.overdue > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{stats.overdue}</div>
                      <div className="mt-4 text-xs text-slate-500">
                          {stats.overdue > 0 ? 'Items past return date' : 'No overdue items'}
                      </div>
                      {stats.overdue > 0 && <Button size="sm" variant="danger" className="mt-2 w-full text-xs py-1" onClick={() => navigate('/admin/approvals')}>View Overdue</Button>}
                  </Card>
              </>
          )}
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <button onClick={() => navigate('/admin/inventory')} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-2 group">
                 <span className="text-2xl group-hover:scale-110 transition-transform">📦</span>
                 <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Add Asset</span>
             </button>
             <button onClick={() => navigate('/admin/users')} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-2 group">
                 <span className="text-2xl group-hover:scale-110 transition-transform">👤</span>
                 <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Manage Users</span>
             </button>
             <button onClick={() => navigate('/admin/deployments')} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-2 group">
                 <span className="text-2xl group-hover:scale-110 transition-transform">🚀</span>
                 <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">New Deployment</span>
             </button>
             <button onClick={() => navigate('/admin/returns')} className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-2 group">
                 <span className="text-2xl group-hover:scale-110 transition-transform">📋</span>
                 <span className="text-xs font-bold uppercase text-slate-600 dark:text-slate-300">Audit Returns</span>
             </button>
        </div>

        {/* Activity & Stats Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Activity Stream</h2>
                    <button onClick={() => navigate('/admin/approvals')} className="text-indigo-600 text-xs font-bold hover:underline">View All</button>
                </div>
                <Card className="p-0 overflow-hidden min-h-[300px]">
                    <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">User</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Items</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Time</th></tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (<tr><td colSpan={4} className="p-8 text-center text-slate-400">Loading data...</td></tr>) : recentRequests.map(req => (
                                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-500 text-xs">{req.user.name.charAt(0)}</div>
                                            <div className="text-sm font-medium text-slate-900 dark:text-white">{req.user.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-slate-500 dark:text-slate-400">{req.items.length > 0 ? req.items[0].name : 'Unknown'} {req.items.length > 1 && `+${req.items.length-1}`}</div></td>
                                    <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={req.status} /></td>
                                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400 font-mono">{new Date(req.requestDate).toLocaleDateString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                </Card>
            </div>
            
            <div className="space-y-6">
                 <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Inventory Breakdown</h2>
                    <Card className="flex flex-col items-center justify-center p-8">
                        <div className="relative w-48 h-48 rounded-full shadow-inner" style={{ 
                            background: `conic-gradient(
                                #10b981 0% ${Math.round((stats.available / stats.total) * 100)}%, 
                                #3b82f6 ${Math.round((stats.available / stats.total) * 100)}% ${Math.round(((stats.available + stats.inUse) / stats.total) * 100)}%, 
                                #8b5cf6 ${Math.round(((stats.available + stats.inUse) / stats.total) * 100)}% 100%
                            )`
                        }}>
                            <div className="absolute inset-0 m-8 bg-white dark:bg-slate-800 rounded-full flex flex-col items-center justify-center shadow-sm">
                                <span className="text-3xl font-bold text-slate-800 dark:text-white">{stats.total}</span>
                                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Total Assets</span>
                            </div>
                        </div>
                        <div className="w-full mt-6 space-y-2">
                             <div className="flex justify-between text-xs">
                                 <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Available</span>
                                 <span className="font-bold">{stats.available}</span>
                             </div>
                             <div className="flex justify-between text-xs">
                                 <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"></span> In Use (Internal)</span>
                                 <span className="font-bold">{stats.inUse}</span>
                             </div>
                             <div className="flex justify-between text-xs">
                                 <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-violet-500"></span> Deployed (Client)</span>
                                 <span className="font-bold">{stats.deployed}</span>
                             </div>
                        </div>
                    </Card>
                 </div>
            </div>
        </div>

        <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} title="System Settings">
            <form onSubmit={saveSettings}>
                <Input 
                    label="Admin Contact Number (For Guard View)" 
                    value={adminContact} 
                    onChange={e => setAdminContact(e.target.value)} 
                    placeholder="+1-555-0000"
                />
                <div className="flex justify-end pt-4">
                    <Button type="submit">Save Settings</Button>
                </div>
            </form>
        </Modal>
      </div>
    );
};

// --- ADMIN APPROVALS ---
const AdminApprovals: React.FC = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [view, setView] = useState<'queue' | 'history'>('queue');
    const [refresh, setRefresh] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [selectedQR, setSelectedQR] = useState<string | null>(null);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<Request | null>(null);
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const { addToast } = useToast();

    useEffect(() => { 
        setLoading(true);
        api.getRequests().then(data => { setRequests(data); setLoading(false); }); 
    }, [refresh]);

    const handleApprove = async (id: string) => { 
        setProcessing(true);
        await api.updateRequestStatus(id, RequestStatus.APPROVED, undefined, 'u-1'); 
        addToast("Request approved successfully", 'success');
        setRefresh(p => p+1); 
        setProcessing(false);
    };

    const confirmReject = async () => {
        if (!rejectId || !rejectReason.trim()) return;
        setProcessing(true);
        await api.updateRequestStatus(rejectId, RequestStatus.REJECTED, rejectReason, 'u-1');
        addToast("Request rejected", 'info');
        setRejectId(null); setRejectReason(''); setRefresh(p => p+1); setProcessing(false);
    };

    const filteredList = requests
        .filter(r => view === 'queue' ? r.status === 'PENDING' : (r.status !== 'PENDING' && r.status !== 'RETURNED'))
        .filter(r => {
            const matchesSearch = r.user.name.toLowerCase().includes(searchTerm.toLowerCase()) || r.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
            const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            const dateA = new Date(a.requestDate).getTime();
            const dateB = new Date(b.requestDate).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Approvals</h1>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button onClick={() => setView('queue')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'queue' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>Queue</button>
                    <button onClick={() => setView('history')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${view === 'history' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>History</button>
                </div>
            </div>
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <Input placeholder="Search user or item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-0 flex-1" />
                <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    {view === 'history' && <Select options={[{ value: 'ALL', label: 'All Status' }, { value: RequestStatus.APPROVED, label: 'Approved' }, { value: RequestStatus.REJECTED, label: 'Rejected' }, { value: RequestStatus.CANCELLED, label: 'Cancelled' }]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mb-0 w-40 flex-shrink-0" />}
                    <Select options={[{ value: 'newest', label: 'Newest First' }, { value: 'oldest', label: 'Oldest First' }]} value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="mb-0 w-40 flex-shrink-0" />
                </div>
            </div>
            <div className="space-y-4">
                {loading ? Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />) : 
                filteredList.map(req => (
                    <Card key={req.id} className="border-l-4 border-l-indigo-500">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                            <div>
                                <h4 className="font-bold text-lg text-slate-900 dark:text-white">{req.user.name}</h4>
                                <div className="text-sm text-slate-500 dark:text-slate-400 mb-1">{req.user.department}</div>
                                <div className="my-2"><span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Requested Items:</span><div className="flex flex-wrap gap-2 mt-1">{req.items.map(i => (<span key={i.id} className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-sm text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">{i.name}</span>))}</div></div>
                                <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg mt-2 italic">"{req.purpose}"</div>
                            </div>
                            {view === 'queue' && (
                                <div className="flex flex-col sm:flex-row gap-3 mt-4 md:mt-0 w-full sm:w-auto">
                                    <Button size="sm" variant="ghost" className="border border-slate-100 dark:border-slate-700" onClick={() => setSelectedHistoryItem(req)}>View Details</Button>
                                    <div className="flex gap-3">
                                        <Button variant="success" size="sm" className="flex-1" onClick={() => handleApprove(req.id)} disabled={processing}>Approve</Button>
                                        <Button variant="danger" size="sm" className="flex-1" onClick={() => setRejectId(req.id)} disabled={processing}>Reject</Button>
                                    </div>
                                </div>
                            )}
                            {view === 'history' && (
                                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                    <StatusBadge status={req.status} />
                                    {req.status === RequestStatus.APPROVED && req.gatePassCode && (
                                        <button 
                                            onClick={() => setSelectedQR(req.gatePassCode!)}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                                            View Gate Pass QR
                                        </button>
                                    )}
                                    <span className="text-xs text-slate-400">{new Date(req.requestDate).toLocaleDateString()}</span>
                                    <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSelectedHistoryItem(req)}>View Details</Button>
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
                {filteredList.length === 0 && <div className="text-center p-8 text-slate-500">No requests found.</div>}
            </div>
            
            <Modal isOpen={!!rejectId} onClose={() => setRejectId(null)} title="Reject Request">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Please provide a reason for rejection.</p>
                    <textarea className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-600 dark:text-white" rows={3} placeholder="Reason..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setRejectId(null)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmReject} disabled={!rejectReason.trim() || processing}>Confirm Rejection</Button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={!!selectedQR} onClose={() => setSelectedQR(null)} title="Gate Pass QR Code">
                <div className="flex flex-col items-center justify-center space-y-6 py-4">
                    <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
                        <QRCodeCanvas value={selectedQR || ''} size={200} level="H" includeMargin={true} />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{selectedQR}</p>
                        <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-bold">Encrypted Gate Authorization</p>
                    </div>
                    <Button variant="secondary" className="w-full" onClick={() => setSelectedQR(null)}>Done</Button>
                </div>
            </Modal>

            {/* Admin Detail View Modal with Matching Gallery */}
            <Modal isOpen={!!selectedHistoryItem} onClose={() => setSelectedHistoryItem(null)} title="Request Detailed Review">
                {selectedHistoryItem && (
                    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                        {selectedHistoryItem.missingItemsReport && (
                            <div className="bg-rose-100 border-l-4 border-rose-500 text-rose-700 p-4 rounded-xl shadow-sm">
                                <p className="font-bold text-sm uppercase flex items-center gap-2">
                                    <span>⚠️</span> Reported Missing/Damaged
                                </p>
                                <p className="text-sm mt-1 font-medium">{selectedHistoryItem.missingItemsReport}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div>
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">User Info</div>
                                <div className="font-bold text-slate-900 dark:text-white">{selectedHistoryItem.user.name}</div>
                                <div className="text-xs text-slate-500">{selectedHistoryItem.user.department}</div>
                            </div>
                            <div className="text-right">
                                <StatusBadge status={selectedHistoryItem.status} />
                                <div className="text-xs text-slate-400 mt-1">Ref: {selectedHistoryItem.id.slice(-8)}</div>
                            </div>
                        </div>

                        <div className="space-y-3">
                             <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                 <span>📦</span> Requested Assets
                             </h4>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                 {selectedHistoryItem.items.map(item => (
                                     <div key={item.id} className="bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-xl text-sm border border-slate-200 dark:border-slate-600">
                                         <div className="font-bold">{item.name}</div>
                                         <div className="text-[10px] text-slate-500 font-mono mt-0.5">S/N: {item.serialNumber}</div>
                                     </div>
                                 ))}
                             </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-4">Evidence Gallery</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Checkout Photo</span>
                                    {selectedHistoryItem.evidenceUrl ? (
                                        <div className="relative group cursor-zoom-in overflow-hidden rounded-2xl border-2 border-slate-100 dark:border-slate-700 aspect-square" onClick={() => setEnlargedImage(selectedHistoryItem.evidenceUrl!)}>
                                            <img src={selectedHistoryItem.evidenceUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Checkout" />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="bg-white/90 text-slate-900 px-2 py-1 rounded text-[10px] font-bold shadow-lg">ZOOM</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-300">
                                            <span>No Image Provided</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Return Photo</span>
                                    {selectedHistoryItem.returnEvidenceUrl ? (
                                        <div className="relative group cursor-zoom-in overflow-hidden rounded-2xl border-2 border-indigo-400 aspect-square shadow-lg" onClick={() => setEnlargedImage(selectedHistoryItem.returnEvidenceUrl!)}>
                                            <img src={selectedHistoryItem.returnEvidenceUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Return" />
                                            <div className="absolute inset-0 bg-indigo-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                                <span className="bg-indigo-600 text-white px-2 py-1 rounded text-[10px] font-bold shadow-lg">ZOOM</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-square bg-slate-100 dark:bg-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-400 text-xs border-2 border-dashed border-slate-300">
                                            <span>Not Returned Yet</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl border border-slate-100 dark:border-slate-600 text-sm space-y-2">
                             <p><span className="font-bold text-slate-500">Requested:</span> {new Date(selectedHistoryItem.requestDate).toLocaleString()}</p>
                             {selectedHistoryItem.approvedAt && <p><span className="font-bold text-slate-500">Approved:</span> {new Date(selectedHistoryItem.approvedAt).toLocaleString()}</p>}
                             {selectedHistoryItem.actualReturnDate && <p><span className="font-bold text-emerald-600">Returned:</span> {new Date(selectedHistoryItem.actualReturnDate).toLocaleString()}</p>}
                             <p><span className="font-bold text-slate-500">Purpose:</span> {selectedHistoryItem.purpose}</p>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Global High-Resolution Image Viewer */}
            {enlargedImage && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md animate-fade-in" onClick={() => setEnlargedImage(null)}>
                    <div className="max-w-4xl w-full relative">
                        <img src={enlargedImage} className="w-full max-h-[85vh] object-contain rounded-3xl shadow-2xl border-4 border-white/10" onClick={(e) => e.stopPropagation()} />
                        <button className="absolute -top-12 right-0 text-white bg-white/20 hover:bg-white/40 rounded-full p-2.5 transition-colors" onClick={() => setEnlargedImage(null)}>
                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="mt-4 text-white text-sm font-bold tracking-widest uppercase bg-indigo-600 px-6 py-2 rounded-full shadow-lg">Evidence Inspection Mode</div>
                </div>
            )}
        </div>
    );
};

// --- ADMIN RETURNS ---
const AdminReturns: React.FC = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    
    useEffect(() => {
        fetchReturns();
    }, []);

    const fetchReturns = async () => {
        setLoading(true);
        const data = await api.getRequests();
        setRequests(data.filter(r => r.status === RequestStatus.RETURNED));
        setLoading(false);
    };

    const filtered = requests.filter(r => 
        r.user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
    ).sort((a, b) => new Date(b.actualReturnDate!).getTime() - new Date(a.actualReturnDate!).getTime());

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Returned Assets</h1>
                <Input placeholder="Search user or item..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mb-0 max-w-xs" />
            </div>

            <div className="grid gap-6">
                {loading ? (
                    Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)
                ) : filtered.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 font-bold uppercase tracking-widest text-xs">No returned assets found.</div>
                ) : (
                    filtered.map(req => (
                        <Card key={req.id} className={`border-l-8 ${req.missingItemsReport ? 'border-l-rose-500' : 'border-l-emerald-500'}`}>
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{req.user.name}</h3>
                                        {req.missingItemsReport && (
                                            <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest">⚠️ Damage/Missing</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-3">{req.user.department}</p>
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {req.items.map(item => (
                                            <span key={item.id} className="bg-slate-50 dark:bg-slate-700 px-3 py-1 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-600">
                                                {item.name} <span className="text-[10px] text-slate-400 font-mono">({item.serialNumber})</span>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-6 text-xs text-slate-400">
                                        <div><span className="font-black uppercase mr-1">Checkout:</span> {new Date(req.requestDate).toLocaleDateString()}</div>
                                        <div><span className="font-black uppercase mr-1 text-emerald-500">Returned:</span> {new Date(req.actualReturnDate!).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-2 w-full md:w-auto">
                                    {req.returnEvidenceUrl && (
                                        <div className="w-32 h-20 rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 relative group cursor-zoom-in" onClick={() => setEnlargedImage(req.returnEvidenceUrl!)}>
                                            <img src={req.returnEvidenceUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="Proof" />
                                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                <span className="text-[8px] bg-white text-slate-900 px-1.5 py-0.5 rounded font-black uppercase">Inspect</span>
                                            </div>
                                        </div>
                                    )}
                                    <Button size="sm" variant="ghost" className="w-full text-[10px] uppercase font-black tracking-widest border border-slate-100 dark:border-slate-700" onClick={() => setSelectedRequest(req)}>Full Report</Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            <Modal isOpen={!!selectedRequest} onClose={() => setSelectedRequest(null)} title="Return Verification Report">
                {selectedRequest && (
                    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Employee</h4>
                                    <p className="font-bold text-lg text-slate-900 dark:text-white uppercase">{selectedRequest.user.name}</p>
                                </div>
                                <div className="text-right">
                                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Return Date</h4>
                                    <p className="font-bold text-emerald-600 uppercase">{new Date(selectedRequest.actualReturnDate!).toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div><span className="text-slate-400 font-black uppercase mr-2">Dept:</span> <span className="font-bold">{selectedRequest.user.department}</span></div>
                                <div><span className="text-slate-400 font-black uppercase mr-2">Status:</span> <StatusBadge status="RETURNED" /></div>
                            </div>
                        </div>

                        {selectedRequest.missingItemsReport && (
                            <div className="bg-rose-50 dark:bg-rose-900/30 p-5 rounded-2xl border-2 border-rose-100 dark:border-rose-900/50 animate-pulse">
                                <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-2 flex items-center gap-1.5">
                                    <span>⚠️</span> DISCREPANCY REPORTED BY USER
                                </p>
                                <p className="text-rose-700 dark:text-rose-300 font-bold text-sm">"{selectedRequest.missingItemsReport}"</p>
                            </div>
                        )}

                        <div>
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 px-1">Visual Evidence</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Checkout Photo</span>
                                    {selectedRequest.evidenceUrl ? (
                                        <div className="aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 cursor-zoom-in" onClick={() => setEnlargedImage(selectedRequest.evidenceUrl!)}>
                                            <img src={selectedRequest.evidenceUrl} className="w-full h-full object-cover grayscale-[0.3]" />
                                        </div>
                                    ) : <div className="aspect-square bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-black uppercase">No Photo</div>}
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest ml-1">Return Photo</span>
                                    {selectedRequest.returnEvidenceUrl ? (
                                        <div className="aspect-square rounded-2xl overflow-hidden border-4 border-emerald-100 dark:border-emerald-900 cursor-zoom-in" onClick={() => setEnlargedImage(selectedRequest.returnEvidenceUrl!)}>
                                            <img src={selectedRequest.returnEvidenceUrl} className="w-full h-full object-cover" />
                                        </div>
                                    ) : <div className="aspect-square bg-slate-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800 flex items-center justify-center text-[10px] text-slate-300 font-black uppercase">No Photo</div>}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4 px-1">Asset Re-entry List</h4>
                            <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
                                {selectedRequest.items.map(item => (
                                    <div key={item.id} className="p-4 flex justify-between items-center">
                                        <div>
                                            <p className="font-black text-xs text-slate-800 dark:text-slate-200 uppercase tracking-tight">{item.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{item.category}</p>
                                        </div>
                                        <p className="font-mono text-indigo-500 text-[10px] font-black border border-indigo-100 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded shadow-sm">{item.serialNumber}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <Button className="w-full py-4 uppercase font-black tracking-widest text-xs" onClick={() => setSelectedRequest(null)}>Acknowledge Return</Button>
                    </div>
                )}
            </Modal>

            {/* Global Image Viewer for Returns */}
            {enlargedImage && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/98 backdrop-blur-xl animate-fade-in" onClick={() => setEnlargedImage(null)}>
                    <div className="max-w-4xl w-full relative">
                        <img src={enlargedImage} className="w-full max-h-[85vh] object-contain rounded-3xl shadow-2xl border-4 border-white/10 transition-all duration-300" alt="Full Preview" onClick={(e) => e.stopPropagation()} />
                        <button className="absolute -top-14 right-0 text-white bg-white/10 hover:bg-white/30 rounded-full p-3 transition-colors" onClick={() => setEnlargedImage(null)}>
                            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="mt-8 px-8 py-3 bg-emerald-600 rounded-full text-white text-[10px] font-black uppercase tracking-widest shadow-2xl">Return Evidence Inspection</div>
                </div>
            )}
        </div>
    );
};

// --- ADMIN INVENTORY ---
const AdminInventory: React.FC = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    const [viewGroup, setViewGroup] = useState<(Asset & { items: Asset[] }) | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [serialSortOrder, setSerialSortOrder] = useState<'asc' | 'desc'>('asc');
    
    // Add Asset Form State
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [desc, setDesc] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [serials, setSerials] = useState<string[]>(['']);
    
    const [selectedQR, setSelectedQR] = useState<string | null>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => { fetchAssets(); }, []);
    
    const fetchAssets = async () => { 
        setLoading(true); 
        const data = await api.getAssets(); 
        setAssets(data); 
        setLoading(false); 
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
    };

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            setCameraActive(true);
            // NOTE: srcObject assignment moved to useEffect to ensure videoRef is mounted
        } catch (err) {
            addToast("Camera access denied", "error");
        }
    };

    // Fix for camera feed attachment
    useEffect(() => {
        if (cameraActive && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraActive, videoRef.current, streamRef.current]);

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `asset-${Date.now()}.jpg`, { type: 'image/jpeg' });
                    setImageFile(file);
                    setImagePreview(URL.createObjectURL(file));
                    stopCamera();
                }
            }, 'image/jpeg', 0.9);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            stopCamera();
        }
    };

    const handleAddAsset = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        const validSerials = serials.filter(s => s.trim() !== ''); 
        if (validSerials.length === 0) { 
            addToast('Serial number required', 'error'); 
            return; 
        } 
        const imageUrl = imagePreview || `https://picsum.photos/200?random=${Date.now()}`; 
        
        try {
            await api.bulkAddAssets({ name, category, description: desc, status: 'AVAILABLE', imageUrl }, validSerials); 
            addToast(`${validSerials.length} items added`, 'success'); 
            setIsModalOpen(false); 
            // Reset form
            setName(''); setCategory(''); setDesc(''); setSerials(['']); setImageFile(null); setImagePreview(null);
            fetchAssets(); 
        } catch(err: any) {
            addToast(err.message, 'error');
        }
    };

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
        const file = e.target.files?.[0]; 
        if (!file) return; 
        const reader = new FileReader(); 
        reader.onload = async (evt) => { 
            const text = evt.target?.result as string; 
            if (text) { 
                try { 
                    const count = await api.importAssetsFromCSV(text); 
                    addToast(`Imported ${count} assets`, 'success'); 
                    fetchAssets(); 
                } catch (err) { 
                    addToast('CSV parse error', 'error'); 
                } 
            } 
        }; 
        reader.readAsText(file); 
        if (csvInputRef.current) csvInputRef.current.value = ''; 
    };

    const handleQuantityChange = (newQty: number) => { 
        const currentQty = serials.length; 
        if (newQty > currentQty) setSerials([...serials, ...Array(newQty - currentQty).fill('')]); 
        else if (newQty < currentQty) setSerials(serials.slice(0, newQty)); 
    };
    
    const updateSerial = (index: number, val: string) => { 
        const newSerials = [...serials]; 
        newSerials[index] = val; 
        setSerials(newSerials); 
    };

    const generateQRWithLabel = (asset: Asset): Promise<string> => {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const size = 300;
            const padding = 20;
            const textHeight = 60;
            canvas.width = size;
            canvas.height = size + textHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                const qrCanvas = document.getElementById(`qr-canvas-${asset.id}`) as HTMLCanvasElement;
                if (qrCanvas) {
                    ctx.drawImage(qrCanvas, padding, padding, size - 2*padding, size - 2*padding);
                }

                ctx.fillStyle = '#000000';
                ctx.font = 'bold 16px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(asset.name.substring(0, 25), size / 2, size + 10);
                ctx.font = '14px monospace';
                ctx.fillText(asset.serialNumber, size / 2, size + 35);
                
                resolve(canvas.toDataURL('image/png'));
            } else {
                resolve('');
            }
        });
    };

    const downloadQR = async (asset: Asset) => {
        const dataUrl = await generateQRWithLabel(asset);
        if (dataUrl) {
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `QR-${asset.serialNumber}.png`;
            link.click();
        }
    };

    const handlePrintAllQRs = (items: Asset[], title: string) => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print QR Codes - ${title}</title>
                    <style>
                        body { font-family: sans-serif; padding: 20px; }
                        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 30px; }
                        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 30px; }
                        .card { border: 1px solid #eee; padding: 15px; text-align: center; page-break-inside: avoid; border-radius: 12px; background: white; }
                        .qr-img { width: 140px; height: 140px; margin: 0 auto; display: block; }
                        .title { font-weight: bold; margin-top: 10px; font-size: 13px; color: #111; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
                        .serial { font-family: monospace; color: #666; font-size: 11px; margin-top: 4px; border: 1px dashed #ccc; padding: 2px; border-radius: 4px; display: inline-block; }
                        .hidden-canvas { display: none; }
                        @media print { .no-print { display: none; } body { background: white; } }
                    </style>
                </head>
                <body>
                    <div class="no-print" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Download PDF / Print</button>
                        <span style="font-size: 12px; color: #666;">Tip: Set destination to "Save as PDF" in your print dialog.</span>
                    </div>
                    <div class="header">
                        <h2 style="margin: 0; text-transform: uppercase; letter-spacing: 1px;">QR Code Inventory: ${title}</h2>
                        <p style="margin: 5px 0 0; color: #666; font-size: 14px;">Total Items: ${items.length} | Generated on ${new Date().toLocaleDateString()}</p>
                    </div>
                    <div class="grid">
            `);

            items.forEach(item => {
                printWindow.document.write(`
                    <div class="card">
                        <div id="qr-${item.id}" class="qr-placeholder"></div>
                        <div class="title">${item.name}</div>
                        <div class="serial">${item.serialNumber}</div>
                    </div>
                `);
            });

            printWindow.document.write(`</div>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
                <script>
                    const items = ${JSON.stringify(items.map(i => ({ id: i.id, sn: i.serialNumber })))};
                    items.forEach(item => {
                        const qr = qrcode(0, 'M');
                        qr.addData(item.id); 
                        qr.make();
                        document.getElementById('qr-' + item.id).innerHTML = qr.createImgTag(5);
                        document.querySelector('#qr-' + item.id + ' img').className = 'qr-img';
                    });
                </script>
            </body></html>`);
            printWindow.document.close();
        }
    };

    const handleDownloadCategoryQRs = (e: React.MouseEvent, categoryName: string) => {
        e.stopPropagation(); // Don't trigger category click
        const categoryItems = assets.filter(a => a.category === categoryName);
        handlePrintAllQRs(categoryItems, `Category: ${categoryName}`);
    };

    const categoryData = useMemo(() => {
        const categories: Record<string, { count: number; image: string }> = {};
        assets.forEach(a => {
            if (!categories[a.category]) {
                categories[a.category] = { count: 0, image: a.imageUrl };
            }
            categories[a.category].count++;
        });
        return Object.entries(categories).map(([name, data]) => ({ name, ...data }));
    }, [assets]);

    const groupedAssets = useMemo(() => {
        return Object.values(assets.reduce((acc, asset) => { 
            if (!acc[asset.name]) acc[asset.name] = { ...asset, items: [] as Asset[] }; 
            acc[asset.name].items.push(asset); 
            return acc; 
        }, {} as Record<string, Asset & { items: Asset[] }>)) as (Asset & { items: Asset[] })[];
    }, [assets]);
    
    const filteredGrouped = groupedAssets.filter(g => 
        (selectedCategory ? g.category === selectedCategory : true) &&
        (g.name.toLowerCase().includes(search.toLowerCase()) || g.category.toLowerCase().includes(search.toLowerCase())) && 
        (categoryFilter === 'ALL' || g.category === categoryFilter)
    ).sort((a, b) => sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));

    const sortedViewItems = viewGroup ? [...viewGroup.items].sort((a, b) => {
        return serialSortOrder === 'asc' 
            ? a.serialNumber.localeCompare(b.serialNumber)
            : b.serialNumber.localeCompare(a.serialNumber);
    }) : [];

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-2">
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Inventory</h1>
                    {selectedCategory && (
                        <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-2xl">/</span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold text-xl">{selectedCategory}</span>
                            <button onClick={() => setSelectedCategory(null)} className="ml-2 p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVUpload} />
                    <Button variant="secondary" onClick={() => csvInputRef.current?.click()}>Import CSV</Button>
                    <Button onClick={() => { setIsModalOpen(true); setImagePreview(null); setImageFile(null); }}>Add Assets</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center">
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="mb-0 flex-1" />
              <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                  <Select options={[{value: 'ALL', label: 'All Categories'}, ...categoryData.map(c => ({value: c.name, label: c.name}))]} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="mb-0 w-48 flex-shrink-0" />
                  <Select options={[{ value: 'asc', label: 'A-Z' }, { value: 'desc', label: 'Z-A' }]} value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="mb-0 w-40 flex-shrink-0" />
              </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
                </div>
            ) : !selectedCategory && !search ? (
                // Category Thumbnail View
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
                    {categoryData.map((cat) => (
                        <div 
                            key={cat.name} 
                            onClick={() => setSelectedCategory(cat.name)}
                            className="group cursor-pointer bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-900 transition-all overflow-hidden relative"
                        >
                            <div className="h-36 w-full relative">
                                <img src={cat.image} alt={cat.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
                                    <span className="text-white font-bold text-sm bg-indigo-600/80 px-3 py-1 rounded-full backdrop-blur-sm">{cat.count} Items</span>
                                </div>
                                <button 
                                    onClick={(e) => handleDownloadCategoryQRs(e, cat.name)}
                                    className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 hover:bg-indigo-600 hover:text-white p-2.5 rounded-2xl text-slate-700 dark:text-slate-200 shadow-lg transition-all transform hover:scale-110 group/btn"
                                    title="Download all QR codes as PDF"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-[10px] font-black uppercase px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 whitespace-nowrap transition-opacity pointer-events-none">Download all QRs</span>
                                </button>
                            </div>
                            <div className="p-5 flex justify-between items-center bg-white dark:bg-slate-800">
                                <h3 className="font-black text-slate-800 dark:text-white uppercase tracking-tight text-lg">{cat.name}</h3>
                                <div className="text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // Filtered List View (Models within category or searched models)
                <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden animate-fade-in">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                            <thead className="bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Model</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase">Category</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase">Stock</th>
                                    <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase">Action</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredGrouped.map((group, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center">
                                                <img src={group.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover mr-3 bg-slate-100" />
                                                <div>
                                                    <div className="font-bold text-slate-900 dark:text-white">{group.name}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-xs">{group.description}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4"><span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800">{group.category}</span></td>
                                        <td className="px-6 py-4 text-center"><span className="font-bold text-indigo-600">{group.items.length} Units</span></td>
                                        <td className="px-6 py-4 text-center"><Button size="sm" variant="ghost" className="border border-slate-100 dark:border-slate-700 text-[10px] uppercase font-black tracking-widest" onClick={() => setViewGroup(group)}>View Detail</Button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredGrouped.length === 0 && (
                        <div className="text-center py-20 bg-slate-50/50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase tracking-widest text-xs">No matching models found.</div>
                    )}
                </div>
            )}

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); stopCamera(); }} title="Add Asset">
                <form onSubmit={handleAddAsset} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <Input label="Model Name" value={name} onChange={e => setName(e.target.value)} required />
                            <CreatableSelect label="Category" value={category} onChange={setCategory} options={categoryData.map(c => ({ value: c.name, label: c.name }))} placeholder="Select or create new..." />
                            <Input label="Description" value={desc} onChange={e => setDesc(e.target.value)} />
                            <QuantityStepper label="Quantity" value={serials.length} onChange={handleQuantityChange} />
                        </div>

                        <div className="space-y-3">
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Asset Image</label>
                            
                            <div className="relative rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 aspect-video flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 overflow-hidden group">
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} className="w-full h-full object-cover" alt="Asset Preview" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => setImagePreview(null)}>Remove</Button>
                                        </div>
                                    </>
                                ) : cameraActive ? (
                                    <>
                                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                                        <canvas ref={canvasRef} className="hidden" />
                                        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2">
                                            <Button type="button" variant="success" size="sm" onClick={capturePhoto}>Capture</Button>
                                            <Button type="button" variant="danger" size="sm" onClick={stopCamera}>Close</Button>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center p-4">
                                        <span className="text-4xl text-slate-300 mb-2 block">🖼️</span>
                                        <p className="text-xs text-slate-500 font-medium mb-3">No image selected</p>
                                        <div className="flex gap-2">
                                            <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>Upload</Button>
                                            <Button type="button" size="sm" variant="outline" onClick={startCamera}>Camera</Button>
                                        </div>
                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 italic">Preferred aspect ratio 16:9</p>
                        </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto pr-2 space-y-2 border-l-2 border-indigo-100 dark:border-indigo-900/40 pl-3 bg-slate-50/50 dark:bg-slate-900/20 py-2 rounded-lg">
                        {serials.map((sn, idx) => (
                            <Input key={idx} label={serials.length > 1 ? `S/N #${idx + 1}` : 'Serial Number'} value={sn} onChange={(e) => updateSerial(idx, e.target.value)} placeholder="Type serial..." className="mb-0" required />
                        ))}
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-700">
                        <Button type="button" variant="ghost" className="mr-3" onClick={() => { setIsModalOpen(false); stopCamera(); }}>Cancel</Button>
                        <Button type="submit">Bulk Add Assets</Button>
                    </div>
                </form>
            </Modal>

            <Modal isOpen={!!viewGroup} onClose={() => setViewGroup(null)} title="Asset Details">
                {viewGroup && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-xl">{viewGroup.name}</h3>
                                <p className="text-sm text-slate-500">{viewGroup.description}</p>
                                <p className="text-xs mt-1 font-bold text-indigo-600">{viewGroup.category} • {viewGroup.items.length} Units</p>
                            </div>
                            <Button variant="primary" size="sm" onClick={() => handlePrintAllQRs(viewGroup.items, viewGroup.name)} icon={<span>🖨️</span>}>Print All QRs</Button>
                        </div>
                        <div className="max-h-[60vh] overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                            <table className="min-w-full">
                                <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-500 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600" onClick={() => setSerialSortOrder(serialSortOrder === 'asc' ? 'desc' : 'asc')}>Serial Number {serialSortOrder === 'asc' ? '↑' : '↓'}</th>
                                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-500 dark:text-slate-300">Status</th>
                                        <th className="px-4 py-3 text-center text-xs uppercase text-slate-500 dark:text-slate-300">QR Code</th>
                                        <th className="px-4 py-3 text-center text-xs uppercase text-slate-500 dark:text-slate-300">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                                    {sortedViewItems.map(item => (
                                        <tr key={item.id}>
                                            <td className="px-4 py-3 font-mono text-sm text-slate-700 dark:text-slate-300">{item.serialNumber}</td>
                                            <td className="px-4 py-3 text-sm"><StatusBadge status={item.status} /></td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex justify-center" onClick={() => setSelectedQR(item.id)}>
                                                    <div className="bg-white p-1 rounded border border-slate-100 cursor-zoom-in">
                                                        <QRCodeCanvas id={`qr-canvas-${item.id}`} value={item.id} size={40} level="L" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => downloadQR(item)} className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs font-bold underline">Download QR</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </Modal>
            <Modal isOpen={!!selectedQR} onClose={() => setSelectedQR(null)} title="Asset QR Code">
                <div className="flex flex-col items-center justify-center space-y-6 py-4">
                    <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
                        <QRCodeCanvas value={selectedQR || ''} size={200} level="H" includeMargin={true} />
                    </div>
                    <div className="text-center">
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">System ID</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{selectedQR}</p>
                    </div>
                    <Button variant="secondary" className="w-full" onClick={() => setSelectedQR(null)}>Done</Button>
                </div>
            </Modal>
        </div>
    );
};

// --- ADMIN DEPLOYMENTS ---
const AdminDeployments: React.FC = () => {
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast } = useToast();
    const { user } = useContext(AuthContext);
    
    // Form state
    const [clientName, setClientName] = useState('');
    const [location, setLocation] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [contactDesignation, setContactDesignation] = useState('');
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [notes, setNotes] = useState('');
    
    const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
    const csvInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const [deps, assets] = await Promise.all([api.getDeployments(), api.getAssets()]);
        setDeployments(deps);
        setAvailableAssets(assets.filter(a => a.status === 'AVAILABLE'));
        setLoading(false);
    };

    const handleAddDeployment = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.addDeployment(clientName, location, contactPerson, contactNumber, contactDesignation, selectedAssetIds, new Date().toISOString(), user?.id || 'admin', notes);
            addToast('Deployment added successfully', 'success');
            setIsModalOpen(false);
            setClientName(''); setLocation(''); setContactPerson(''); setContactNumber(''); setContactDesignation(''); setSelectedAssetIds([]); setNotes('');
            fetchData();
        } catch (err: any) { addToast(err.message, 'error'); }
    };

    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            const text = evt.target?.result as string;
            if (text) {
                try {
                    const count = await api.importDeploymentsFromCSV(text, user?.id || 'admin');
                    addToast(`Imported ${count} deployments`, 'success');
                    fetchData();
                } catch (err) { addToast('CSV parse error', 'error'); }
            }
        };
        reader.readAsText(file);
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Deployed Hardware</h1>
                <div className="flex gap-3">
                    <input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVUpload} />
                    <Button variant="secondary" onClick={() => csvInputRef.current?.click()}>Import CSV</Button>
                    <Button onClick={() => setIsModalOpen(true)}>New Deployment</Button>
                </div>
            </div>
            <div className="grid gap-6">
                {loading ? <Skeleton className="h-40" /> : deployments.map(dep => (
                    <Card key={dep.id}>
                        <div>
                            <h3 className="font-bold text-lg">{dep.clientName}</h3>
                            <p className="text-sm text-slate-500 mb-2">{dep.location}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                                <div><span className="font-semibold">Contact:</span> {dep.contactPerson} ({dep.contactDesignation})</div>
                                <div><span className="font-semibold">Phone:</span> {dep.contactNumber}</div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {dep.items.map(item => (
                                    <span key={item.id} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{item.name}</span>
                                ))}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Deployment">
                <form onSubmit={handleAddDeployment} className="space-y-4">
                    <Input label="Client Name" value={clientName} onChange={e => setClientName(e.target.value)} required />
                    <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} required />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} required />
                        <Input label="Phone" value={contactNumber} onChange={e => setContactNumber(e.target.value)} required />
                    </div>
                    <MultiSelect label="Assets" options={availableAssets.map(a => ({ value: a.id, label: a.name, subLabel: a.serialNumber }))} selectedValues={selectedAssetIds} onChange={setSelectedAssetIds} />
                    <Button type="submit" className="w-full">Deploy Assets</Button>
                </form>
            </Modal>
        </div>
    );
};

// --- ADMIN USERS ---
const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast } = useToast();
    const csvInputRef = useRef<HTMLInputElement>(null);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<UserRole>(UserRole.USER);
    const [newDept, setNewDept] = useState('');

    useEffect(() => { fetchUsers(); }, []);
    const fetchUsers = async () => { setLoading(true); try { const data = await api.getUsers(); setUsers(data); } catch (err) { addToast('Failed to load users', 'error'); } finally { setLoading(false); } };
    const handleCreateUser = async (e: React.FormEvent) => { e.preventDefault(); try { await api.createUser({ name: newName, email: newEmail, role: newRole, department: newDept }); addToast('User created', 'success'); setIsModalOpen(false); fetchUsers(); } catch (err: any) { addToast(err.message, 'error'); } };
    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (evt) => { const text = evt.target?.result as string; if (text) { try { await api.importUsersFromCSV(text); fetchUsers(); } catch (err) { addToast('Error importing CSV', 'error'); } } }; reader.readAsText(file); };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Users</h1>
                <div className="flex gap-2">
                    <input type="file" ref={csvInputRef} className="hidden" onChange={handleCSVUpload} />
                    <Button variant="secondary" onClick={() => csvInputRef.current?.click()}>CSV</Button>
                    <Button onClick={() => setIsModalOpen(true)}>Add User</Button>
                </div>
            </div>
            <Card className="p-0">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr><th className="px-6 py-3 text-left text-xs uppercase">Name</th><th className="px-6 py-3 text-left text-xs uppercase">Role</th></tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                        {users.map(u => (<tr key={u.id} className="hover:bg-slate-50"><td className="px-6 py-4">{u.name}</td><td className="px-6 py-4">{u.role}</td></tr>))}
                    </tbody>
                </table>
            </Card>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add User">
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <Input label="Name" value={newName} onChange={e => setNewName(e.target.value)} required />
                    <Input label="Email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required />
                    <Select label="Role" value={newRole} onChange={e => setNewRole(e.target.value as UserRole)} options={[{value: UserRole.USER, label: 'User'}, {value: UserRole.ADMIN, label: 'Admin'}, {value: UserRole.GUARD, label: 'Guard'}]} />
                    <Button type="submit" className="w-full">Create</Button>
                </form>
            </Modal>
        </div>
    );
};

// --- USER DASHBOARD ---
const UserDashboard: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [requests, setRequests] = useState<Request[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [purpose, setPurpose] = useState('');
    const [returnDate, setReturnDate] = useState('');
    const [cameraMode, setCameraMode] = useState<'scan' | 'request_evidence' | 'return_evidence' | null>(null);
    const [selectedQR, setSelectedQR] = useState<string | null>(null);
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [requestToReturn, setRequestToReturn] = useState<string | null>(null);
    const [isMissingItems, setIsMissingItems] = useState(false);
    const [missingItemsReport, setMissingItemsReport] = useState('');
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<Request | null>(null);
    
    const [returnEvidenceFile, setReturnEvidenceFile] = useState<File | null>(null);
    const [returnEvidencePreview, setReturnEvidencePreview] = useState<string | null>(null);

    const [requestEvidenceFile, setRequestEvidenceFile] = useState<File | null>(null);
    const [requestEvidencePreview, setRequestEvidencePreview] = useState<string | null>(null);

    const { addToast } = useToast();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const assetsRef = useRef<Asset[]>([]);
    const selectedIdsRef = useRef<string[]>([]);
    const scanningRef = useRef(false);

    useEffect(() => { assetsRef.current = assets; }, [assets]);
    useEffect(() => { selectedIdsRef.current = selectedAssetIds; }, [selectedAssetIds]);

    useEffect(() => { 
        if (user) {
            const init = async () => {
                const [reqs, assts] = await Promise.all([api.getRequests(), api.getAssets()]);
                setRequests(reqs.filter(r => r.userId === user.id));
                setAssets(assts.filter(a => a.status === 'AVAILABLE'));
                setLoading(false);
            };
            init();
        }
    }, [user]);

    const stopCamera = () => {
        setCameraMode(null);
        scanningRef.current = false;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
    };

    const startCamera = async (mode: 'scan' | 'request_evidence' | 'return_evidence') => {
        stopCamera();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            setCameraMode(mode);
        } catch (err) { addToast("Camera access failed", "error"); }
    };

    useEffect(() => {
        if (cameraMode && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            if (cameraMode === 'scan') {
                scanningRef.current = true;
                requestAnimationFrame(tick);
            }
        }
    }, [cameraMode]);

    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `evidence-${Date.now()}.jpg`, { type: 'image/jpeg' });
                        if (cameraMode === 'return_evidence') {
                            setReturnEvidenceFile(file);
                            setReturnEvidencePreview(URL.createObjectURL(file));
                        } else if (cameraMode === 'request_evidence') {
                            setRequestEvidenceFile(file);
                            setRequestEvidencePreview(URL.createObjectURL(file));
                        }
                        stopCamera();
                        addToast("Photo captured successfully!", "success");
                    }
                }, 'image/jpeg', 0.9);
            }
        }
    };

    const tick = () => {
        if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const canvasSize = 640;
                canvas.width = canvasSize; canvas.height = canvasSize;
                ctx.drawImage(video, 0, 0, canvasSize, canvasSize);
                const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    const foundAsset = assetsRef.current.find(a => a.id === code.data || a.serialNumber === code.data);
                    if (foundAsset && !selectedIdsRef.current.includes(foundAsset.id)) {
                        setSelectedAssetIds(prev => [...prev, foundAsset.id]);
                        addToast(`Added: ${foundAsset.name}`, "success");
                    }
                }
            }
        }
        if (scanningRef.current) requestAnimationFrame(tick);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createRequest(user!.id, selectedAssetIds, purpose, returnDate, requestEvidenceFile || undefined);
            addToast('Request submitted successfully', 'success');
            setIsModalOpen(false); 
            stopCamera(); 
            setSelectedAssetIds([]);
            setRequestEvidenceFile(null);
            setRequestEvidencePreview(null);
            const reqs = await api.getRequests(); 
            setRequests(reqs.filter(r => r.userId === user!.id));
        } catch (err: any) { addToast(err.message, 'error'); }
    };

    const handleReturnAsset = async () => {
        try {
            await api.submitAssetReturn(requestToReturn!, returnEvidenceFile || undefined, isMissingItems ? missingItemsReport : undefined);
            addToast("Return confirmed successfully", "success");
            setReturnModalOpen(false);
            setReturnEvidenceFile(null);
            setReturnEvidencePreview(null);
            setIsMissingItems(false);
            setMissingItemsReport('');
            const reqs = await api.getRequests(); setRequests(reqs.filter(r => r.userId === user!.id));
        } catch (err: any) { addToast(err.message, 'error'); }
    };

    const displayList = activeTab === 'active' 
        ? requests.filter(r => [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.CHECKED_OUT].includes(r.status))
        : requests.filter(r => [RequestStatus.REJECTED, RequestStatus.RETURNED, RequestStatus.CANCELLED].includes(r.status));

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">My Requests</h1>
                <div className="flex gap-2">
                    <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'active' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800'}`}>Active</button>
                    <button onClick={() => setActiveTab('history')} className={`px-4 py-2 rounded-lg text-sm ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-800'}`}>History</button>
                    <Button onClick={() => setIsModalOpen(true)}>New Request</Button>
                </div>
            </div>
            <div className="space-y-4">
                {displayList.map(req => (
                    <Card key={req.id}>
                        <div className="flex justify-between items-center">
                            <div className="cursor-pointer group" onClick={() => setSelectedHistoryItem(req)}>
                                <div className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">{req.items.map(i => i.name).join(', ')}</div>
                                <div className="text-xs text-slate-500 mt-1">Requested: {new Date(req.requestDate).toLocaleDateString()}</div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <StatusBadge status={req.status} />
                                {req.gatePassCode && <Button size="sm" variant="outline" onClick={() => setSelectedQR(req.gatePassCode!)}>View Pass</Button>}
                                {req.gateVerified && req.status !== RequestStatus.RETURNED && (
                                    <Button size="sm" variant="success" onClick={() => { setRequestToReturn(req.id); setReturnModalOpen(true); }}>Confirm Return</Button>
                                )}
                            </div>
                        </div>
                    </Card>
                ))}
                {displayList.length === 0 && <div className="text-center py-20 text-slate-400 font-medium">No requests in this section.</div>}
            </div>

            {/* Return Modal */}
            <Modal isOpen={returnModalOpen} onClose={() => { setReturnModalOpen(false); stopCamera(); }} title="Confirm Asset Return">
                <div className="space-y-5">
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                        Please take a clear photo of all assets being returned for verification.
                    </div>
                    
                    {returnEvidencePreview ? (
                        <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-400 group aspect-video">
                            <img src={returnEvidencePreview} className="w-full h-full object-cover" alt="Captured Evidence" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                <Button size="sm" variant="secondary" onClick={() => { setReturnEvidencePreview(null); startCamera('return_evidence'); }}>Retake Photo</Button>
                            </div>
                        </div>
                    ) : cameraMode === 'return_evidence' ? (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-indigo-600 shadow-xl">
                            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                                <Button type="button" variant="success" size="sm" onClick={capturePhoto}>Capture Proof Now</Button>
                                <Button type="button" variant="ghost" className="text-white" size="sm" onClick={stopCamera}>Cancel</Button>
                            </div>
                        </div>
                    ) : (
                        <Button variant="outline" className="w-full h-32 border-dashed flex flex-col gap-3 group hover:border-indigo-500" onClick={() => startCamera('return_evidence')}>
                            <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">📸</span>
                            <span className="font-bold text-slate-500 group-hover:text-indigo-600">Click to Open Camera</span>
                        </Button>
                    )}

                    <div className="pt-2">
                        <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input type="checkbox" className="w-5 h-5 rounded text-indigo-600 border-slate-300" checked={isMissingItems} onChange={e => setIsMissingItems(e.target.checked)} />
                            <span className="font-bold text-sm text-slate-700 dark:text-slate-300">Items Missing or Damaged?</span>
                        </label>
                        {isMissingItems && (
                            <textarea 
                                className="w-full mt-3 border border-rose-200 dark:border-rose-900 rounded-xl p-3 bg-rose-50/30 dark:bg-rose-900/10 text-sm focus:ring-rose-500 transition-all" 
                                rows={3}
                                placeholder="Describe missing items or damage details..." 
                                value={missingItemsReport} 
                                onChange={e => setMissingItemsReport(e.target.value)} 
                            />
                        )}
                    </div>
                    <Button onClick={handleReturnAsset} className="w-full py-4 text-lg" variant="success" disabled={!returnEvidencePreview || (isMissingItems && !missingItemsReport.trim())}>Confirm Return to IT</Button>
                </div>
            </Modal>

            {/* Details Modal */}
            <Modal isOpen={!!selectedHistoryItem} onClose={() => setSelectedHistoryItem(null)} title="Request Details">
                {selectedHistoryItem && (
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Purpose</p>
                                 <p className="text-slate-800 dark:text-white font-medium">{selectedHistoryItem.purpose}</p>
                             </div>
                             <StatusBadge status={selectedHistoryItem.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Requested</p>
                                <p>{new Date(selectedHistoryItem.requestDate).toLocaleDateString()}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 font-bold uppercase">Planned Return</p>
                                <p>{new Date(selectedHistoryItem.returnDate).toLocaleDateString()}</p>
                            </div>
                        </div>
                        {selectedHistoryItem.missingItemsReport && (
                            <div className="bg-rose-50 p-3 text-rose-800 rounded-xl border border-rose-100">
                                <p className="font-bold mb-1 text-xs uppercase tracking-widest">⚠️ Missing/Damaged Report</p>
                                <p className="font-medium">{selectedHistoryItem.missingItemsReport}</p>
                            </div>
                        )}
                        <div>
                             <p className="text-xs text-slate-500 font-bold uppercase mb-2">Requested Items</p>
                             <ul className="space-y-2">
                                 {selectedHistoryItem.items.map(i => (
                                     <li key={i.id} className="flex justify-between items-center bg-white dark:bg-slate-700 p-2 rounded-lg border border-slate-100 dark:border-slate-600">
                                         <span className="font-bold">{i.name}</span>
                                         <span className="font-mono text-[10px] text-slate-400">{i.serialNumber}</span>
                                     </li>
                                 ))}
                             </ul>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); stopCamera(); }} title="Request Asset Checkout">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Button type="button" variant="secondary" onClick={() => startCamera('scan')} className="w-full h-12" icon={<span>📸</span>}>Scan Asset QR Code</Button>
                    <canvas ref={canvasRef} className="hidden" />
                    {cameraMode === 'scan' && (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-w-[280px] mx-auto border-4 border-indigo-500">
                            <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                            <div className="absolute inset-0 border-2 border-indigo-400/50 m-12 pointer-events-none animate-pulse"></div>
                        </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                        {selectedAssetIds.map(id => (
                            <span key={id} className="bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-3 py-1 text-xs rounded-full font-bold flex items-center gap-1">
                                {assets.find(a => a.id === id)?.name}
                                <button type="button" onClick={() => setSelectedAssetIds(prev => prev.filter(p => p !== id))}>×</button>
                            </span>
                        ))}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Checkout Evidence Photo</label>
                        {requestEvidencePreview ? (
                            <div className="relative rounded-2xl overflow-hidden border-2 border-indigo-400 group aspect-video">
                                <img src={requestEvidencePreview} className="w-full h-full object-cover" alt="Captured Request Evidence" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <Button size="sm" variant="secondary" onClick={() => { setRequestEvidencePreview(null); setRequestEvidenceFile(null); startCamera('request_evidence'); }}>Retake Photo</Button>
                                </div>
                            </div>
                        ) : cameraMode === 'request_evidence' ? (
                            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video border-2 border-indigo-600 shadow-xl">
                                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                                    <Button type="button" variant="success" size="sm" onClick={capturePhoto}>Capture Now</Button>
                                    <Button type="button" variant="ghost" className="text-white" size="sm" onClick={stopCamera}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full py-6 border-dashed flex flex-col gap-2 group hover:border-indigo-500 transition-all" type="button" onClick={() => startCamera('request_evidence')}>
                                <span className="text-2xl group-hover:scale-110 transition-transform">📸</span>
                                <span className="text-xs font-bold text-slate-500 group-hover:text-indigo-600">Add Evidence Photo</span>
                            </Button>
                        )}
                    </div>

                    <Input label="Purpose of Use" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Presentation at Client Office" required />
                    <Input label="Return Expectation Date" type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} required />
                    <Button type="submit" className="w-full py-4 shadow-lg" disabled={selectedAssetIds.length === 0}>Submit IT Request</Button>
                </form>
            </Modal>

            <Modal isOpen={!!selectedQR} onClose={() => setSelectedQR(null)} title="Gate Pass QR Code">
                <div className="flex flex-col items-center gap-6 py-4">
                    <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
                        <QRCodeCanvas value={selectedQR!} size={200} level="H" />
                    </div>
                    <div className="text-center">
                        <p className="font-mono text-2xl font-black text-slate-900 dark:text-white tracking-widest">{selectedQR}</p>
                        <p className="text-xs text-slate-500 mt-2 font-bold uppercase tracking-tighter">Present this at the security gate</p>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- GUARD DASHBOARD ---
const GuardDashboard: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [request, setRequest] = useState<Request | null>(null);
    const [recentActivities, setRecentActivities] = useState<Request[]>([]);
    const [verificationQueue, setVerificationQueue] = useState<Request[]>([]);
    const [isScanning, setIsScanning] = useState(false);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<Request | null>(null);
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
    const [manualCode, setManualCode] = useState('');
    const { addToast } = useToast();
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanningRef = useRef(false);

    const fetchData = async () => {
        const allRequests = await api.getRequests();
        // Recently verified items
        const verified = allRequests
            .filter(r => r.gateVerified)
            .sort((a, b) => new Date(b.gateVerifiedAt!).getTime() - new Date(a.gateVerifiedAt!).getTime())
            .slice(0, 5);
        setRecentActivities(verified);

        // Queue: APPROVED but not verified
        const queue = allRequests
            .filter(r => r.status === RequestStatus.APPROVED && !r.gateVerified)
            .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
        setVerificationQueue(queue);
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    const stopScanner = () => {
        scanningRef.current = false;
        if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
        setIsScanning(false);
    };

    const startScanner = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            setIsScanning(true);
        } catch (err) { addToast("Camera failed", "error"); }
    };

    useEffect(() => {
        if (isScanning && videoRef.current) {
            videoRef.current.srcObject = streamRef.current;
            scanningRef.current = true;
            requestAnimationFrame(tick);
        }
    }, [isScanning]);

    const handleManualCheck = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!manualCode.trim()) return;
        
        const allRequests = await api.getRequests();
        const found = allRequests.find(r => r.gatePassCode === manualCode.trim() || r.id === manualCode.trim());
        if (found) {
            setRequest(found);
            setManualCode('');
            stopScanner();
        } else {
            addToast("Gate Pass not found.", "error");
        }
    };

    const tick = async () => {
        if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const size = Math.min(video.videoWidth, video.videoHeight);
                canvas.width = size; canvas.height = size;
                ctx.drawImage(video, 0, 0, size, size);
                const imageData = ctx.getImageData(0, 0, size, size);
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    const allRequests = await api.getRequests();
                    const found = allRequests.find(r => r.gatePassCode === code.data || r.id === code.data);
                    if (found) { 
                        setRequest(found); 
                        stopScanner(); 
                        if ('vibrate' in navigator) navigator.vibrate(100);
                    }
                }
            }
        }
        if (scanningRef.current) requestAnimationFrame(tick);
    };

    const handleVerify = async (reqId?: string) => {
        const idToVerify = reqId || request?.id;
        if (!idToVerify) return;
        
        try {
            await api.verifyGatePass(idToVerify, user!.id, "Verified at gate");
            addToast("Gate Pass Verified", "success");
            if (request && request.id === idToVerify) {
                const reqs = await api.getRequests(); 
                const updated = reqs.find(r => r.id === idToVerify)!;
                setRequest(updated);
            }
            fetchData();
        } catch (err: any) { addToast(err.message, "error"); }
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
            <h1 className="text-3xl font-black mb-8 text-slate-800 dark:text-white uppercase tracking-tight text-center">Security Verification</h1>
            
            {/* Main Scan Card */}
            {!request ? (
                <Card className="text-center space-y-6 py-10 shadow-2xl border-indigo-100 dark:border-indigo-900/30 relative overflow-hidden">
                    <div className="bg-indigo-50 dark:bg-indigo-900/20 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-2 border-2 border-indigo-100 dark:border-indigo-800 animate-pulse relative z-10">
                         <span className="text-5xl">👮</span>
                    </div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Scan Gate Pass</h3>
                        <p className="text-slate-500 text-sm mt-1">Verify authorization for equipment exit</p>
                    </div>

                    {isScanning ? (
                        <div className="relative rounded-3xl overflow-hidden bg-black aspect-square border-4 border-indigo-500 shadow-2xl max-w-sm mx-auto z-20">
                             <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                             <canvas ref={canvasRef} className="hidden" />
                             <div className="absolute inset-0 border-2 border-white/20 m-10 rounded-3xl pointer-events-none"></div>
                             <div className="absolute top-1/2 left-0 w-full h-1 bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,1)] animate-[scan-line_2s_infinite_linear]"></div>
                             <button onClick={stopScanner} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 text-white px-5 py-2 rounded-full backdrop-blur-md text-xs font-black uppercase tracking-widest hover:bg-white/40 transition-colors">Cancel Scan</button>
                        </div>
                    ) : (
                        <div className="space-y-6 relative z-10 px-4">
                            <Button onClick={startScanner} className="w-full py-5 text-xl rounded-2xl shadow-indigo-100" icon={<span>📷</span>}>Open Scanner</Button>
                            
                            <div className="flex items-center gap-4 py-2">
                                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-700"></div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manual Entry</span>
                                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-700"></div>
                            </div>
                            
                            <form onSubmit={handleManualCheck} className="flex gap-2">
                                <Input placeholder="Enter Pass Code (e.g. GP-9123)" value={manualCode} onChange={e => setManualCode(e.target.value)} className="mb-0 text-center font-mono" />
                                <Button type="submit" variant="secondary" className="px-6 rounded-xl font-black text-xs uppercase tracking-widest">Check</Button>
                            </form>
                        </div>
                    )}
                    
                    <style>{`
                        @keyframes scan-line {
                            0% { transform: translateY(-120px); opacity: 0; }
                            20% { opacity: 1; }
                            80% { opacity: 1; }
                            100% { transform: translateY(120px); opacity: 0; }
                        }
                    `}</style>
                </Card>
            ) : (
                <div className="space-y-4 animate-fade-in">
                    <Card className={`border-l-8 ${request.gateVerified ? 'border-l-emerald-500' : 'border-l-indigo-500'} overflow-visible relative`}>
                        <div className="flex justify-between items-center mb-6">
                            <div className="text-2xl font-mono font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{request.gatePassCode}</div>
                            <StatusBadge status={request.status} />
                        </div>
                        <div className="space-y-5 mb-8">
                            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                                <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center font-black text-indigo-700 dark:text-indigo-300 text-xl border border-indigo-200 dark:border-indigo-800">{request.user.name.charAt(0)}</div>
                                <div>
                                    <div className="font-bold text-lg text-slate-900 dark:text-white leading-tight">{request.user.name}</div>
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{request.user.department}</div>
                                </div>
                            </div>
                            <div className="pt-2">
                                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-3 px-1">Authorized Equipment</p>
                                <ul className="space-y-2">
                                    {request.items.map(i => (
                                        <li key={i.id} className="text-sm font-bold flex justify-between bg-white dark:bg-slate-700 p-3 rounded-xl border border-slate-100 dark:border-slate-600 shadow-sm hover:border-indigo-200 transition-colors">
                                            <span className="text-slate-800 dark:text-slate-200">{i.name}</span>
                                            <span className="font-mono text-indigo-500 text-xs">{i.serialNumber}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        {request.status === 'APPROVED' ? (
                            request.gateVerified ? (
                                <div className="bg-emerald-100 dark:bg-emerald-900/40 p-5 text-center text-emerald-800 dark:text-emerald-300 rounded-2xl font-black uppercase tracking-widest border-2 border-emerald-200 dark:border-emerald-800 animate-fade-in shadow-lg shadow-emerald-50/50">Verification Successful ✅</div>
                            ) : (
                                <div className="flex gap-3">
                                    <Button onClick={() => handleVerify()} className="flex-1 py-6 text-xl shadow-xl shadow-emerald-100 dark:shadow-none rounded-2xl" variant="success">CONFIRM EXIT ✅</Button>
                                    <Button onClick={() => setSelectedHistoryItem(request)} variant="outline" className="px-6 rounded-2xl border-slate-200 dark:border-slate-700 font-black text-xs uppercase tracking-widest">Details</Button>
                                </div>
                            )
                        ) : <div className="bg-rose-100 p-5 text-center text-rose-800 rounded-2xl font-black uppercase border-2 border-rose-200">ACCESS DENIED - UNAPPROVED ⛔</div>}
                        <button onClick={() => setRequest(null)} className="w-full mt-6 text-slate-400 hover:text-indigo-600 transition-colors font-black text-[10px] uppercase tracking-widest underline">Reset / Scan Next</button>
                    </Card>
                </div>
            )}

            {/* Verification Queue (List with Approve Button) */}
            {!request && verificationQueue.length > 0 && (
                <div className="mt-12 space-y-6 animate-fade-in">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-lg font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter flex items-center gap-2">
                            <span className="animate-pulse">🔴</span> Active Authorization Queue
                        </h2>
                        <span className="text-[10px] font-bold text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1 rounded-full">{verificationQueue.length} Waiting</span>
                    </div>
                    
                    <div className="space-y-3">
                        {verificationQueue.map(item => (
                            <div key={item.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-indigo-50 dark:border-indigo-900/40 shadow-sm flex flex-col sm:flex-row items-center gap-4 hover:border-indigo-300 transition-all group">
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-slate-400 text-lg border border-slate-200 dark:border-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">{item.user.name.charAt(0)}</div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="font-black text-slate-800 dark:text-white text-base truncate uppercase tracking-tight">{item.user.name}</div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{item.user.department}</span>
                                            <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                            <span className="text-[10px] font-black text-indigo-600 font-mono tracking-tighter">{item.gatePassCode}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <Button size="sm" variant="ghost" className="flex-1 sm:flex-none text-[10px] uppercase font-black tracking-widest px-4 border border-slate-100 dark:border-slate-700" onClick={() => setSelectedHistoryItem(item)}>View Proof</Button>
                                    <Button size="sm" variant="success" className="flex-1 sm:flex-none text-[10px] uppercase font-black tracking-widest px-4 shadow-md shadow-emerald-100" onClick={() => handleVerify(item.id)}>Allow Exit</Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Verified Activity List */}
            {!request && (
                <div className="mt-10 space-y-6">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-tighter flex items-center gap-2">
                            <span>🕒</span> Recent Gate Logs
                        </h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">Last 5 Verified</span>
                    </div>
                    
                    <div className="space-y-3">
                        {recentActivities.length === 0 ? (
                            <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 text-sm font-bold italic">No verification logs available for today.</div>
                        ) : (
                            recentActivities.map(activity => (
                                <div key={activity.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all group">
                                    <div className="flex items-center gap-4 overflow-hidden">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-black text-slate-400 text-xs border border-slate-200 dark:border-slate-600">{activity.user.name.charAt(0)}</div>
                                        <div className="overflow-hidden">
                                            <div className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-indigo-600 transition-colors truncate">{activity.user.name}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <span className="text-emerald-500 font-black">VERIFIED</span> 
                                                <span>•</span> 
                                                <span>{new Date(activity.gateVerifiedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button size="sm" variant="ghost" className="text-[10px] uppercase font-black tracking-widest px-3 border border-slate-50 dark:border-slate-700" onClick={() => setSelectedHistoryItem(activity)}>Details</Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Detailed Verification Proof Modal */}
            <Modal isOpen={!!selectedHistoryItem} onClose={() => setSelectedHistoryItem(null)} title="Gate Verification Proof">
                {selectedHistoryItem && (
                    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 scrollbar-hide">
                        <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-700 pb-5">
                            <div>
                                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Employee Info</div>
                                <div className="font-black text-slate-900 dark:text-white uppercase leading-tight text-lg">{selectedHistoryItem.user.name}</div>
                                <div className="text-[10px] font-bold text-indigo-600 uppercase mt-0.5 tracking-tighter">{selectedHistoryItem.user.department}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Gate Pass Code</div>
                                <div className="font-mono text-xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{selectedHistoryItem.gatePassCode}</div>
                                <div className="mt-1"><StatusBadge status={selectedHistoryItem.gateVerified ? 'GATE_VERIFIED' : selectedHistoryItem.status} /></div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Evidence Visuals</h4>
                                <span className="text-[8px] bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-500 uppercase font-bold">Inspect for match</span>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 px-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span> Request Photo
                                    </span>
                                    {selectedHistoryItem.evidenceUrl ? (
                                        <div className="relative group cursor-zoom-in overflow-hidden rounded-3xl border-2 border-slate-100 dark:border-slate-700 aspect-square shadow-sm transition-all hover:shadow-lg" onClick={() => setEnlargedImage(selectedHistoryItem.evidenceUrl!)}>
                                            <img src={selectedHistoryItem.evidenceUrl} className="w-full h-full object-cover grayscale-[0.1] transition-transform duration-500 group-hover:scale-110" alt="Request Visual" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                                                <span className="bg-white/90 text-slate-900 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">Enlarge</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-square bg-slate-50 dark:bg-slate-800 rounded-3xl flex flex-col items-center justify-center text-slate-300 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-slate-200 dark:border-slate-700">No Image Provided</div>
                                    )}
                                </div>
                                <div className="space-y-2.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-1.5 px-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Return Photo
                                    </span>
                                    {selectedHistoryItem.returnEvidenceUrl ? (
                                        <div className="relative group cursor-zoom-in overflow-hidden rounded-3xl border-2 border-emerald-400 aspect-square shadow-md transition-all hover:shadow-lg" onClick={() => setEnlargedImage(selectedHistoryItem.returnEvidenceUrl!)}>
                                            <img src={selectedHistoryItem.returnEvidenceUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Return Proof" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl border border-emerald-400">Match Photo</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="aspect-square bg-slate-50 dark:bg-slate-800/40 rounded-3xl flex flex-col items-center justify-center text-slate-400 text-[10px] font-black uppercase tracking-widest border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 text-center leading-tight">Return proof not yet captured</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                             <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Authorized List</h4>
                             <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                                 {selectedHistoryItem.items.map(item => (
                                     <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex justify-between items-center gap-4">
                                         <div className="flex flex-col">
                                             <span className="font-black text-slate-800 dark:text-slate-200 uppercase text-xs">{item.name}</span>
                                             <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{item.category}</span>
                                         </div>
                                         <span className="font-mono text-indigo-500 text-[10px] font-bold bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">{item.serialNumber}</span>
                                     </div>
                                 ))}
                             </div>
                        </div>

                        {selectedHistoryItem.missingItemsReport && (
                            <div className="bg-rose-50 dark:bg-rose-900/20 p-5 rounded-2xl border-2 border-rose-100 dark:border-rose-900/40 animate-pulse">
                                <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1.5 flex items-center gap-1.5">
                                    <span className="text-sm">⚠️</span> DISCREPANCY REPORTED
                                </p>
                                <p className="text-rose-700 dark:text-rose-300 font-bold text-sm leading-snug">"{selectedHistoryItem.missingItemsReport}"</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30 text-center">
                            <div>
                                <div className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Entry Date</div>
                                <div className="font-black text-slate-800 dark:text-white text-xs">{new Date(selectedHistoryItem.requestDate).toLocaleDateString()}</div>
                            </div>
                            <div>
                                <div className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">Planned Return</div>
                                <div className="font-black text-slate-800 dark:text-white text-xs">{new Date(selectedHistoryItem.returnDate).toLocaleDateString()}</div>
                            </div>
                        </div>

                        {!selectedHistoryItem.gateVerified && (
                             <Button onClick={() => handleVerify(selectedHistoryItem.id)} className="w-full py-4 text-lg font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-100" variant="success">Final Approve Exit ✅</Button>
                        )}
                    </div>
                )}
            </Modal>

            {/* Global Photo Zoom for Guard */}
            {enlargedImage && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-slate-900/98 backdrop-blur-xl animate-fade-in" onClick={() => setEnlargedImage(null)}>
                    <div className="max-w-5xl w-full relative group">
                        <img src={enlargedImage} className="w-full max-h-[85vh] object-contain rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border-4 border-white/5 transition-all duration-300" alt="Enlarged Visual" onClick={(e) => e.stopPropagation()} />
                        <button className="absolute -top-14 right-0 text-white bg-white/10 hover:bg-white/30 rounded-full p-4 transition-all hover:rotate-90 duration-300" onClick={() => setEnlargedImage(null)}>
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                    <div className="mt-8 px-10 py-3 bg-indigo-600 rounded-full text-white text-xs font-black uppercase tracking-widest shadow-2xl animate-bounce-short">Evidence Verification View</div>
                </div>
            )}

            <style>{`
                @keyframes bounce-short {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-short { animation: bounce-short 2s infinite ease-in-out; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
};

// --- APP ---
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: UserRole[] }> = ({ children, roles }) => {
    const { user, isLoading } = useContext(AuthContext);
    if (isLoading) return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
    return <>{children}</>;
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <HashRouter>
                        <GlobalLoadingBar />
                        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
                            <Routes>
                                <Route path="/login" element={<Login />} />
                                <Route path="/admin" element={<ProtectedRoute roles={[UserRole.ADMIN]}><><Navbar /><AdminDashboard /></></ProtectedRoute>} />
                                <Route path="/admin/approvals" element={<ProtectedRoute roles={[UserRole.ADMIN]}><><Navbar /><AdminApprovals /></></ProtectedRoute>} />
                                <Route path="/admin/returns" element={<ProtectedRoute roles={[UserRole.ADMIN]}><><Navbar /><AdminReturns /></></ProtectedRoute>} />
                                <Route path="/admin/inventory" element={<ProtectedRoute roles={[UserRole.ADMIN]}><><Navbar /><AdminInventory /></></ProtectedRoute>} />
                                <Route path="/admin/deployments" element={<ProtectedRoute roles={[UserRole.ADMIN]}><><Navbar /><AdminDeployments /></></ProtectedRoute>} />
                                <Route path="/admin/users" element={<ProtectedRoute roles={[UserRole.ADMIN]}><><Navbar /><AdminUsers /></></ProtectedRoute>} />
                                <Route path="/user" element={<ProtectedRoute roles={[UserRole.USER]}><><Navbar /><UserDashboard /></></ProtectedRoute>} />
                                <Route path="/guard" element={<ProtectedRoute roles={[UserRole.GUARD]}><><Navbar /><GuardDashboard /></></ProtectedRoute>} />
                                <Route path="/profile" element={<ProtectedRoute><><Navbar /><UserProfile /></></ProtectedRoute>} />
                                <Route path="/" element={<ProtectedRoute><Navigate to="/login" replace /></ProtectedRoute>} />
                            </Routes>
                        </div>
                    </HashRouter>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
};

export default App;
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
              setPendingCount(pending);
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
  
    const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING);
    const recentRequests = [...requests].sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()).slice(0, 5);
  
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
            <Button variant="secondary" size="sm" onClick={() => setShowSettings(true)} icon={<span>⚙️</span>}>System Settings</Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)) : (
              <>
                  <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-xl">
                      <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Pending Approvals</div>
                      <div className="text-5xl font-extrabold">{pendingRequests.length}</div>
                      <div className="mt-2 text-indigo-200 text-xs">Requires attention</div>
                  </Card>
                  <Card><div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Inventory</div><div className="text-4xl font-bold text-slate-800 dark:text-white">{assets.length}</div></Card>
                  <Card><div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Deployed Hardware</div><div className="text-4xl font-bold text-slate-800 dark:text-white">{deployments.length}</div></Card>
                  <Card><div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Gate Verified</div><div className="text-4xl font-bold text-slate-800 dark:text-white">{requests.filter(r => r.gateVerified).length}</div></Card>
              </>
          )}
        </div>
        <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h2>
            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">User</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Items</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</th><th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Date</th></tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                        {loading ? (<tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>) : recentRequests.map(req => (
                            <tr key={req.id}>
                                <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><div className="text-sm font-medium text-slate-900 dark:text-white">{req.user.name}</div></div></td>
                                <td className="px-6 py-4 whitespace-nowrap"><div className="text-sm text-slate-500 dark:text-slate-400">{req.items.map(i => i.name).join(', ')}</div></td>
                                <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={req.status} /></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">{new Date(req.requestDate).toLocaleDateString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </Card>
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
        .filter(r => view === 'queue' ? r.status === 'PENDING' : r.status !== 'PENDING')
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
                    {view === 'history' && <Select options={[{ value: 'ALL', label: 'All Status' }, { value: RequestStatus.APPROVED, label: 'Approved' }, { value: RequestStatus.REJECTED, label: 'Rejected' }, { value: RequestStatus.RETURNED, label: 'Returned' }]} value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mb-0 w-40 flex-shrink-0" />}
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
                            {view === 'queue' && (<div className="flex gap-3 mt-4 md:mt-0"><Button variant="success" onClick={() => handleApprove(req.id)} disabled={processing}>Approve</Button><Button variant="danger" onClick={() => setRejectId(req.id)} disabled={processing}>Reject</Button></div>)}
                            {view === 'history' && (
                                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                                    <StatusBadge status={req.status} />
                                    {req.status === RequestStatus.APPROVED && req.gatePassCode && (
                                        <button 
                                            onClick={() => setSelectedQR(req.gatePassCode!)}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
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

            {/* Admin Detail View Modal */}
            <Modal isOpen={!!selectedHistoryItem} onClose={() => setSelectedHistoryItem(null)} title="Request Details">
                {selectedHistoryItem && (
                    <div className="space-y-6">
                        {selectedHistoryItem.missingItemsReport && (
                            <div className="bg-rose-100 border-l-4 border-rose-500 text-rose-700 p-4 rounded shadow-sm">
                                <p className="font-bold text-sm uppercase flex items-center gap-2">
                                    <span>⚠️</span> Reported Missing/Damaged
                                </p>
                                <p className="text-sm mt-1">{selectedHistoryItem.missingItemsReport}</p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div>
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Request ID</div>
                                <div className="font-mono text-sm">{selectedHistoryItem.id}</div>
                            </div>
                            <div className="text-right">
                                <StatusBadge status={selectedHistoryItem.status} />
                                <div className="text-xs text-slate-400 mt-1">{new Date(selectedHistoryItem.requestDate).toLocaleDateString()}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white mb-2">Items</h4>
                                <div className="space-y-2">
                                    {selectedHistoryItem.items.map(item => (
                                        <div key={item.id} className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg text-sm border border-slate-200 dark:border-slate-600">
                                            <span className="font-bold">{item.name}</span>
                                            <div className="text-xs text-slate-500 font-mono">{item.serialNumber}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white mb-2">Timeline & Info</h4>
                                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                    <p><span className="font-semibold">Purpose:</span> {selectedHistoryItem.purpose}</p>
                                    <p><span className="font-semibold">Expected Return:</span> {new Date(selectedHistoryItem.returnDate).toLocaleDateString()}</p>
                                    
                                    {selectedHistoryItem.approvedAt && <p><span className="font-semibold text-emerald-600">Approved:</span> {new Date(selectedHistoryItem.approvedAt).toLocaleString()}</p>}
                                    
                                    {selectedHistoryItem.actualReturnDate && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded mt-2 border border-emerald-100 dark:border-emerald-800">
                                            <p className="text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase">Returned On</p>
                                            <p className="text-emerald-600 dark:text-emerald-300">{new Date(selectedHistoryItem.actualReturnDate).toLocaleString()}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-3">Evidence Gallery</h4>
                            <div className="flex gap-4 overflow-x-auto pb-2">
                                {selectedHistoryItem.evidenceUrl && (
                                    <div className="flex-shrink-0 cursor-zoom-in" onClick={() => setEnlargedImage(selectedHistoryItem.evidenceUrl!)}>
                                        <div className="text-xs mb-1 text-slate-500">Request Evidence</div>
                                        <img src={selectedHistoryItem.evidenceUrl} className="h-24 w-24 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                                    </div>
                                )}
                                {selectedHistoryItem.returnEvidenceUrl && (
                                    <div className="flex-shrink-0 cursor-zoom-in" onClick={() => setEnlargedImage(selectedHistoryItem.returnEvidenceUrl!)}>
                                        <div className="text-xs mb-1 text-slate-500 font-bold text-emerald-600">Return Evidence</div>
                                        <img src={selectedHistoryItem.returnEvidenceUrl} className="h-24 w-24 object-cover rounded-lg border-2 border-emerald-500 hover:opacity-80 transition-opacity" />
                                    </div>
                                )}
                                {!selectedHistoryItem.evidenceUrl && !selectedHistoryItem.returnEvidenceUrl && <p className="text-sm text-slate-400 italic">No images attached.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Image Enlarge Modal for Admin */}
            {enlargedImage && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setEnlargedImage(null)}>
                    <img src={enlargedImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                    <button className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/30 rounded-full p-2" onClick={() => setEnlargedImage(null)}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

// --- ADMIN INVENTORY (Restored Advanced Version) ---
const AdminInventory: React.FC = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
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
    const [serials, setSerials] = useState<string[]>(['']);
    
    const [selectedQR, setSelectedQR] = useState<string | null>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { fetchAssets(); }, []);
    
    const fetchAssets = async () => { 
        setLoading(true); 
        const data = await api.getAssets(); 
        setAssets(data); 
        setLoading(false); 
    };

    const handleAddAsset = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        const validSerials = serials.filter(s => s.trim() !== ''); 
        if (validSerials.length === 0) { 
            addToast('Serial number required', 'error'); 
            return; 
        } 
        const imageUrl = imageFile ? URL.createObjectURL(imageFile) : `https://picsum.photos/200?random=${Date.now()}`; 
        
        try {
            await api.bulkAddAssets({ name, category, description: desc, status: 'AVAILABLE', imageUrl }, validSerials); 
            addToast(`${validSerials.length} items added`, 'success'); 
            setIsModalOpen(false); 
            // Reset form
            setName(''); setCategory(''); setDesc(''); setSerials(['']); setImageFile(null); 
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

    // Function to generate image data for a specific asset
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
                
                // Draw QR Code from the hidden canvas in DOM
                const qrCanvas = document.getElementById(`qr-canvas-${asset.id}`) as HTMLCanvasElement;
                if (qrCanvas) {
                    ctx.drawImage(qrCanvas, padding, padding, size - 2*padding, size - 2*padding);
                }

                // Draw Text
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

    const handlePrintAllQRs = () => {
        if (!viewGroup) return;
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                <head>
                    <title>Print QR Codes - ${viewGroup.name}</title>
                    <style>
                        body { font-family: sans-serif; }
                        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px; padding: 20px; }
                        .card { border: 1px solid #ccc; padding: 20px; text-align: center; page-break-inside: avoid; border-radius: 8px; }
                        .qr-code { width: 150px; height: 150px; margin: 0 auto; }
                        .title { font-weight: bold; margin-top: 10px; font-size: 14px; }
                        .serial { font-family: monospace; color: #555; font-size: 12px; margin-top: 5px; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <button class="no-print" onclick="window.print()" style="padding: 10px 20px; font-size: 16px; margin-bottom: 20px; cursor: pointer;">Print / Save as PDF</button>
                    <div class="grid">
            `);

            viewGroup.items.forEach(item => {
                const canvas = document.getElementById(`qr-canvas-${item.id}`) as HTMLCanvasElement;
                const dataUrl = canvas ? canvas.toDataURL() : '';
                printWindow.document.write(`
                    <div class="card">
                        <img src="${dataUrl}" class="qr-code" />
                        <div class="title">${item.name}</div>
                        <div class="serial">${item.serialNumber}</div>
                    </div>
                `);
            });

            printWindow.document.write(`</div></body></html>`);
            printWindow.document.close();
        }
    };

    const existingCategories = Array.from(new Set(assets.map(a => a.category)));
    
    // Group assets by name
    const groupedAssets = Object.values(assets.reduce((acc, asset) => { 
        if (!acc[asset.name]) acc[asset.name] = { ...asset, items: [] as Asset[] }; 
        acc[asset.name].items.push(asset); 
        return acc; 
    }, {} as Record<string, Asset & { items: Asset[] }>)) as (Asset & { items: Asset[] })[];
    
    const filtered = groupedAssets.filter(g => 
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
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Inventory</h1>
                <div className="flex gap-3">
                    <input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVUpload} />
                    <Button variant="secondary" onClick={() => csvInputRef.current?.click()}>Import CSV</Button>
                    <Button onClick={() => setIsModalOpen(true)}>Add Assets</Button>
                </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center">
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="mb-0 flex-1" />
              <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                  <Select options={[{value: 'ALL', label: 'All Categories'}, ...existingCategories.map(c => ({value: c, label: c}))]} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="mb-0 w-48 flex-shrink-0" />
                  <Select options={[{ value: 'asc', label: 'A-Z' }, { value: 'desc', label: 'Z-A' }]} value={sortOrder} onChange={e => setSortOrder(e.target.value as any)} className="mb-0 w-40 flex-shrink-0" />
              </div>
            </div>
            
            <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
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
                            {filtered.map((group, i) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <img src={group.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover mr-3 bg-slate-100" />
                                            <div>
                                                <div className="font-bold">{group.name}</div>
                                                <div className="text-xs text-slate-500">{group.description}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4"><span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-slate-700">{group.category}</span></td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-bold text-indigo-600">{group.items.length}</span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <Button size="sm" variant="ghost" onClick={() => setViewGroup(group)}>View</Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Asset">
                <form onSubmit={handleAddAsset} className="space-y-4">
                    <Input label="Model Name" value={name} onChange={e => setName(e.target.value)} required />
                    <CreatableSelect 
                        label="Category" 
                        value={category} 
                        onChange={setCategory} 
                        options={existingCategories.map(c => ({ value: c, label: c }))} 
                        placeholder="Select or create new..."
                    />
                    <QuantityStepper label="Quantity" value={serials.length} onChange={handleQuantityChange} />
                    <div className="max-h-40 overflow-y-auto pr-2 space-y-2 border-l-2 border-slate-100 dark:border-slate-700 pl-3">
                        {serials.map((sn, idx) => (
                            <Input key={idx} label={serials.length > 1 ? `Serial Number #${idx + 1}` : 'Serial Number'} value={sn} onChange={(e) => updateSerial(idx, e.target.value)} placeholder="Scan or type S/N" className="mb-0" required />
                        ))}
                    </div>
                    <Input label="Description" value={desc} onChange={e => setDesc(e.target.value)} />
                    <div className="flex justify-end pt-4"><Button type="submit">Add Items</Button></div>
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
                            <Button variant="primary" size="sm" onClick={handlePrintAllQRs} icon={<span>🖨️</span>}>Print All QRs</Button>
                        </div>
                        <div className="max-h-[60vh] overflow-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                            <table className="min-w-full">
                                <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs uppercase text-slate-500 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-600" onClick={() => setSerialSortOrder(serialSortOrder === 'asc' ? 'desc' : 'asc')}>
                                            Serial Number {serialSortOrder === 'asc' ? '↑' : '↓'}
                                        </th>
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
                                                <button 
                                                    onClick={() => downloadQR(item)}
                                                    className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 text-xs font-bold underline"
                                                >
                                                    Download QR
                                                </button>
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
            await api.addDeployment(
                clientName, location, contactPerson, contactNumber, contactDesignation, 
                selectedAssetIds, new Date().toISOString(), user?.id || 'admin', notes
            );
            addToast('Deployment added successfully', 'success');
            setIsModalOpen(false);
            // Reset form
            setClientName(''); setLocation(''); setContactPerson(''); setContactNumber('');
            setContactDesignation(''); setSelectedAssetIds([]); setNotes('');
            fetchData();
        } catch (err: any) {
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
                    const count = await api.importDeploymentsFromCSV(text, user?.id || 'admin');
                    addToast(`Imported ${count} deployments`, 'success');
                    fetchData();
                } catch (err) {
                    addToast('CSV parse error', 'error');
                }
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
                        <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div>
                                <h3 className="font-bold text-lg">{dep.clientName}</h3>
                                <p className="text-sm text-slate-500 mb-2">{dep.location}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
                                    <div><span className="font-semibold">Contact:</span> {dep.contactPerson} ({dep.contactDesignation})</div>
                                    <div><span className="font-semibold">Phone:</span> {dep.contactNumber}</div>
                                    <div><span className="font-semibold">Date:</span> {new Date(dep.deploymentDate).toLocaleDateString()}</div>
                                </div>
                                <div className="mt-4">
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Deployed Items</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {dep.items.map(item => (
                                            <span key={item.id} className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                                                {item.name} <span className="ml-1 opacity-70 font-mono">({item.serialNumber})</span>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
                {deployments.length === 0 && !loading && <div className="text-center text-slate-500 py-10">No deployments found.</div>}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="New Deployment">
                <form onSubmit={handleAddDeployment} className="space-y-4">
                    <Input label="Client / Company Name" value={clientName} onChange={e => setClientName(e.target.value)} required />
                    <Input label="Location / Address" value={location} onChange={e => setLocation(e.target.value)} required />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} required />
                        <Input label="Contact Phone" value={contactNumber} onChange={e => setContactNumber(e.target.value)} required />
                    </div>
                    <Input label="Designation" value={contactDesignation} onChange={e => setContactDesignation(e.target.value)} />
                    
                    <MultiSelect 
                        label="Select Assets to Deploy"
                        options={availableAssets.map(a => ({ value: a.id, label: a.name, subLabel: a.serialNumber }))}
                        selectedValues={selectedAssetIds}
                        onChange={setSelectedAssetIds}
                        placeholder="Search assets..."
                    />

                    <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
                    
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={selectedAssetIds.length === 0}>Deploy Assets</Button>
                    </div>
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
    const [newPhone, setNewPhone] = useState('');

    useEffect(() => { fetchUsers(); }, []);
    const fetchUsers = async () => { setLoading(true); try { const data = await api.getUsers(); setUsers(data); } catch (err) { addToast('Failed to load users', 'error'); } finally { setLoading(false); } };
    const handleCreateUser = async (e: React.FormEvent) => { e.preventDefault(); try { await api.createUser({ name: newName, email: newEmail, role: newRole, department: newDept, phoneNumber: newPhone }); addToast('User created successfully', 'success'); setIsModalOpen(false); setNewName(''); setNewEmail(''); setNewRole(UserRole.USER); setNewDept(''); setNewPhone(''); fetchUsers(); } catch (err: any) { addToast(err.message || 'Failed to create user', 'error'); } };
    const handleRoleChange = async (userId: string, newRole: string) => { try { await api.updateUserRole(userId, newRole as UserRole); addToast('Role updated successfully', 'success'); setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as UserRole } : u)); } catch (err: any) { addToast('Failed to update role', 'error'); fetchUsers(); } };
    const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = async (evt) => { const text = evt.target?.result as string; if (text) { try { const count = await api.importUsersFromCSV(text); addToast(`Successfully imported ${count} users`, 'success'); fetchUsers(); } catch (err) { addToast('Failed to parse CSV', 'error'); } } }; reader.readAsText(file); if (csvInputRef.current) csvInputRef.current.value = ''; };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4"><h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h1><div className="flex gap-3"><input type="file" accept=".csv" ref={csvInputRef} className="hidden" onChange={handleCSVUpload} /><Button variant="secondary" onClick={() => csvInputRef.current?.click()}>Import CSV</Button><Button onClick={() => setIsModalOpen(true)}>Add User</Button></div></div>
            <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700"><thead className="bg-slate-50 dark:bg-slate-700/50"><tr><th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Name</th><th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Role</th><th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Department</th><th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</th><th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Action</th></tr></thead><tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">{users.map(u => (<tr key={u.id} className="hover:bg-slate-50 transition-colors"><td className="px-6 py-4"><div className="flex flex-col"><span className="font-bold">{u.name}</span><span className="text-xs text-slate-500">{u.email}</span></div></td><td className="px-6 py-4"><span className="px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800">{u.role}</span></td><td className="px-6 py-4 text-sm">{u.department || 'N/A'}</td><td className="px-6 py-4 text-center"><span className={`inline-flex h-2.5 w-2.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} /></td><td className="px-6 py-4 text-center"><select className="text-xs border rounded p-1" value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}><option value={UserRole.USER}>User</option><option value={UserRole.ADMIN}>Admin</option><option value={UserRole.GUARD}>Guard</option></select></td></tr>))}</tbody></table></div></div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New User"><form onSubmit={handleCreateUser} className="space-y-4"><Input label="Full Name" value={newName} onChange={e => setNewName(e.target.value)} required /><Input label="Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required /><div className="grid grid-cols-2 gap-4"><Input label="Department" value={newDept} onChange={e => setNewDept(e.target.value)} /><Input label="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} /></div><Select label="Role" value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} options={[{ value: UserRole.USER, label: 'Employee' }, { value: UserRole.ADMIN, label: 'Administrator' }, { value: UserRole.GUARD, label: 'Security Guard' }]} /><div className="flex justify-end pt-4"><Button type="submit">Create Account</Button></div></form></Modal>
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
    
    // View State
    const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
    
    // Form state
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [purpose, setPurpose] = useState('');
    const [returnDate, setReturnDate] = useState('');
    const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
    const [evidencePreview, setEvidencePreview] = useState<string | null>(null);
    const [selectedQR, setSelectedQR] = useState<string | null>(null);
    const [adminContact, setAdminContact] = useState('');
    
    // Detailed History View State
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<Request | null>(null);
    const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

    // Cancel Request State
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [requestToCancel, setRequestToCancel] = useState<string | null>(null);
    const [cancellationNote, setCancellationNote] = useState('');

    // Return Asset State
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [requestToReturn, setRequestToReturn] = useState<string | null>(null);
    const [returnEvidenceFile, setReturnEvidenceFile] = useState<File | null>(null);
    const [returnEvidencePreview, setReturnEvidencePreview] = useState<string | null>(null);
    const [isMissingItems, setIsMissingItems] = useState(false);
    const [missingItemsReport, setMissingItemsReport] = useState('');

    // Scanner/Camera state
    const [cameraMode, setCameraMode] = useState<'scan' | 'request_evidence' | 'return_evidence' | null>(null);
    
    const { addToast } = useToast();
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const lastScannedCodeRef = useRef<string>('');
    const lastScannedTimeRef = useRef<number>(0);
    const scanningRef = useRef<boolean>(false);

    // Refs for closure access in loop
    const assetsRef = useRef<Asset[]>([]);
    const selectedIdsRef = useRef<string[]>([]);

    useEffect(() => { assetsRef.current = assets; }, [assets]);
    useEffect(() => { selectedIdsRef.current = selectedAssetIds; }, [selectedAssetIds]);

    useEffect(() => { 
        if (user) {
            const init = async () => {
                setLoading(true);
                const [allReqs, allAssets, settings] = await Promise.all([
                    api.getRequests(), 
                    api.getAssets(),
                    api.getSystemSettings()
                ]);
                setRequests(allReqs.filter(r => r.userId === user?.id));
                setAssets(allAssets.filter(a => a.status === 'AVAILABLE'));
                if (settings) setAdminContact(settings.adminContactNumber);
                setLoading(false);
            };
            init();
        }
    }, [user]);
    
    const handleSubmit = async (e: React.FormEvent) => { 
        e.preventDefault(); 
        if (selectedAssetIds.length === 0) { 
            addToast('Please scan or select at least one item', 'error'); 
            return; 
        } 
        try { 
            await api.createRequest(user!.id, selectedAssetIds, purpose, returnDate, evidenceFile || undefined); 
            addToast('Request submitted successfully', 'success'); 
            closeModal();
            refreshData();
        } catch (err: any) { 
            addToast(err.message, 'error'); 
        } 
    };

    const handleCancelRequest = async () => {
        if (!requestToCancel || !cancellationNote.trim()) return;
        try {
            await api.cancelRequest(requestToCancel, cancellationNote);
            addToast("Request cancelled successfully", "success");
            setCancelModalOpen(false);
            setRequestToCancel(null);
            setCancellationNote('');
            refreshData();
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    const handleReturnAsset = async () => {
        if (!requestToReturn) return;
        // In a strict app, we might force photo evidence.
        try {
            const missingReport = isMissingItems ? missingItemsReport : undefined;
            await api.submitAssetReturn(requestToReturn, returnEvidenceFile || undefined, missingReport);
            addToast("Assets marked as returned", "success");
            setReturnModalOpen(false);
            setRequestToReturn(null);
            setReturnEvidenceFile(null);
            setReturnEvidencePreview(null);
            setIsMissingItems(false);
            setMissingItemsReport('');
            stopCamera();
            refreshData();
        } catch (err: any) {
            addToast(err.message, "error");
        }
    };

    const refreshData = async () => {
        const allReqs = await api.getRequests();
        setRequests(allReqs.filter(r => r.userId === user?.id));
    };

    const closeModal = () => {
        setIsModalOpen(false);
        stopCamera();
        setSelectedAssetIds([]);
        setPurpose('');
        setReturnDate('');
        setEvidenceFile(null);
        setEvidencePreview(null);
    };

    const startCamera = async (mode: 'scan' | 'request_evidence' | 'return_evidence') => {
        stopCamera();
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 } 
                } 
            });
            streamRef.current = stream;
            setCameraMode(mode);
            // Wait for next render cycle to attach stream
        } catch (err) {
            console.error("Camera access failed:", err);
            addToast("Unable to access camera. Please check permissions.", "error");
        }
    };

    // Effect to attach stream when video element is mounted and stream is ready
    useEffect(() => {
        if (cameraMode && videoRef.current && streamRef.current) {
            const video = videoRef.current;
            video.srcObject = streamRef.current;
            video.setAttribute("playsinline", "true"); 
            video.setAttribute("autoplay", "true");
            video.setAttribute("muted", "true");
            
            video.play().then(() => {
                if (cameraMode === 'scan') {
                    scanningRef.current = true;
                    requestAnimationFrame(tick);
                } else {
                    scanningRef.current = false;
                }
            }).catch(e => console.error("Play failed", e));
        }
    }, [cameraMode]);

    const stopCamera = () => {
        setCameraMode(null);
        scanningRef.current = false;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        lastScannedCodeRef.current = '';
    };

    const capturePhoto = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video && canvas && video.readyState >= 2) { 
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (ctx) {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `evidence-${Date.now()}.jpg`, { type: 'image/jpeg' });
                        if (cameraMode === 'request_evidence') {
                            setEvidenceFile(file);
                            setEvidencePreview(URL.createObjectURL(file));
                        } else if (cameraMode === 'return_evidence') {
                            setReturnEvidenceFile(file);
                            setReturnEvidencePreview(URL.createObjectURL(file));
                        }
                        stopCamera();
                        addToast("Photo captured successfully!", "success");
                    }
                }, 'image/jpeg', 0.9);
            }
        } else {
            addToast("Camera not ready. Please try again.", "error");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setEvidenceFile(file);
            setEvidencePreview(URL.createObjectURL(file));
            addToast("Evidence uploaded", "success");
        }
    };

    const tick = () => {
        if (!scanningRef.current || !streamRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
            if (canvas) {
                const context = canvas.getContext("2d", { willReadFrequently: true });
                if (context) {
                    const canvasSize = 640;
                    canvas.width = canvasSize;
                    canvas.height = canvasSize;
                    
                    const videoW = video.videoWidth;
                    const videoH = video.videoHeight;
                    const minDim = Math.min(videoW, videoH);
                    
                    context.drawImage(video, (videoW - minDim) / 2, (videoH - minDim) / 2, minDim, minDim, 0, 0, canvasSize, canvasSize);
                    
                    const imageData = context.getImageData(0, 0, canvasSize, canvasSize);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                    
                    if (code) {
                        const now = Date.now();
                        if (code.data !== lastScannedCodeRef.current || now - lastScannedTimeRef.current > 3000) {
                            lastScannedCodeRef.current = code.data;
                            lastScannedTimeRef.current = now;
                            const scannedValue = code.data;
                            const currentAssets = assetsRef.current;
                            const currentSelectedIds = new Set(selectedIdsRef.current);
                            const foundAsset = currentAssets.find(a => a.id === scannedValue || a.serialNumber === scannedValue);
                            
                            if (foundAsset) {
                                if (currentSelectedIds.has(foundAsset.id)) {
                                    addToast(`Product "${foundAsset.name}" is already in the list`, "info");
                                } else {
                                    setSelectedAssetIds(prev => [...prev, foundAsset.id]);
                                    addToast(`Product added successfully: ${foundAsset.name}`, "success");
                                    if ('vibrate' in navigator) navigator.vibrate(50);
                                }
                            } else {
                                addToast(`Scanned: ${code.data} (Not found)`, "info");
                            }
                        }
                    }
                }
            }
        }
        requestAnimationFrame(tick);
    };

    useEffect(() => { return () => stopCamera(); }, []);

    const activeRequests = requests.filter(r => 
        [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.CHECKED_OUT].includes(r.status) &&
        !r.gateVerified // Treat gate verified but not "checked out" status yet as active or history? Let's keep Active until returned.
    ).sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());

    const historyRequests = requests.filter(r => 
        [RequestStatus.REJECTED, RequestStatus.RETURNED, RequestStatus.CANCELLED].includes(r.status) ||
        (r.status === RequestStatus.APPROVED && r.gateVerified) // Moved verified to history if you prefer, or keep in active. Let's put verified items in active until returned for this use case so they can see the "Return" button.
        // Actually prompt implies returning asset is a main action. So verified items stay in active.
    ).filter(r => 
        // Logic fix: History usually means "Done". 
        // Active means "Action needed" or "In possession".
        // REJECTED, CANCELLED, RETURNED are definitely history.
        // APPROVED (not verified) -> Active (Waiting for gate)
        // APPROVED (verified) -> Active (In possession, waiting to return)
        // PENDING -> Active
        [RequestStatus.REJECTED, RequestStatus.RETURNED, RequestStatus.CANCELLED].includes(r.status)
    ).sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());

    // Adjusting logic: Active = Pending, Approved (Verified or not).
    // History = Cancelled, Rejected, Returned.
    const displayList = activeTab === 'active' 
        ? requests.filter(r => [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.CHECKED_OUT].includes(r.status)).sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime())
        : historyRequests;

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Requests</h1>
                <div className="flex gap-4 w-full sm:w-auto">
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex-1 sm:flex-none">
                        <button onClick={() => setActiveTab('active')} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'active' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>Active</button>
                        <button onClick={() => setActiveTab('history')} className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>History</button>
                    </div>
                    {activeTab === 'active' && <Button onClick={() => setIsModalOpen(true)}>New Request</Button>}
                </div>
            </div>

            <div className="space-y-4">
                {displayList.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                        <div className="text-5xl mb-4 opacity-50">📂</div>
                        <h3 className="text-lg font-bold text-slate-400">No {activeTab} requests found</h3>
                        {activeTab === 'active' && <Button variant="ghost" onClick={() => setIsModalOpen(true)} className="mt-4">Submit your first request</Button>}
                    </div>
                ) : (
                    displayList.map(req => (
                        <Card key={req.id} className={`${activeTab === 'history' ? 'opacity-90 hover:opacity-100' : ''}`}>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div className="flex items-start gap-4 cursor-pointer" onClick={() => { if(activeTab === 'history') setSelectedHistoryItem(req) }}>
                                    {req.evidenceUrl ? (
                                        <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 flex-shrink-0 overflow-hidden border border-slate-200 dark:border-slate-600 relative group">
                                            <img src={req.evidenceUrl} alt="Evidence" className="w-full h-full object-cover" />
                                            {activeTab === 'history' && <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors"><span className="text-white text-xs">View</span></div>}
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl">📦</div>
                                    )}
                                    <div>
                                        <div className="flex flex-wrap gap-2 mb-1">
                                            {req.items.map(i => (<span key={i.id} className="font-bold text-indigo-600 dark:text-indigo-400">{i.name}</span>))}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            <div className="mb-1">Requested: {new Date(req.requestDate).toLocaleDateString()}</div>
                                            {req.status === RequestStatus.APPROVED && req.gatePassCode && (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 rounded text-xs">GP: {req.gatePassCode}</span>
                                                    <button onClick={(e) => { e.stopPropagation(); setSelectedQR(req.gatePassCode!); }} className="text-indigo-500 hover:underline text-xs">Show QR</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="flex flex-col items-end gap-2">
                                    <StatusBadge status={req.status} />
                                    
                                    {/* Action Buttons for Active Tab */}
                                    {activeTab === 'active' && req.status === RequestStatus.PENDING && (
                                        <Button size="sm" variant="danger" className="text-xs py-1 h-8" onClick={() => { setRequestToCancel(req.id); setCancelModalOpen(true); }}>Cancel Request</Button>
                                    )}
                                    
                                    {activeTab === 'active' && (req.status === RequestStatus.APPROVED || req.status === RequestStatus.CHECKED_OUT) && req.gateVerified && (
                                        <Button size="sm" variant="outline" className="text-xs py-1 h-8 border-emerald-500 text-emerald-600 hover:bg-emerald-50" onClick={() => { setRequestToReturn(req.id); setReturnModalOpen(true); }}>Return Assets</Button>
                                    )}

                                    {/* History View Button */}
                                    {activeTab === 'history' && (
                                        <Button size="sm" variant="ghost" onClick={() => setSelectedHistoryItem(req)}>View Details</Button>
                                    )}
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
            
            {/* New Request Modal */}
            <Modal isOpen={isModalOpen} onClose={closeModal} title="Request Assets">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <canvas ref={canvasRef} className="hidden" />
                    
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Scan Asset QR Code</label>
                          <p className="text-xs text-slate-500">Scanner stays active for continuous scanning.</p>
                        </div>
                        
                        <Button 
                            type="button" 
                            variant={cameraMode === 'scan' ? "danger" : "primary"} 
                            className="w-full py-3.5 flex flex-row items-center justify-center gap-2 shadow-lg transition-all" 
                            onClick={cameraMode === 'scan' ? stopCamera : () => startCamera('scan')}
                            icon={<span>📷</span>}
                        >
                            {cameraMode === 'scan' ? 'Close Scanner' : 'Open QR Scanner'}
                        </Button>

                        {cameraMode === 'scan' && (
                            <div className="relative overflow-hidden rounded-3xl bg-slate-900 aspect-square w-full max-w-[240px] mx-auto border-4 border-indigo-500 shadow-2xl animate-fade-in z-10 mt-2">
                                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-32 h-32 border-2 border-indigo-400 border-dashed rounded-3xl animate-pulse relative">
                                        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-indigo-400/40 -translate-y-1/2 animate-scan-up-down"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {selectedAssetIds.length > 0 && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900 mt-4 animate-fade-in">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                                    <span className="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 p-1 rounded-md">📦</span>
                                    Scanned Products ({selectedAssetIds.length})
                                </label>
                                <button type="button" onClick={() => setSelectedAssetIds([])} className="text-xs text-rose-500 hover:underline">Clear All</button>
                            </div>
                            
                            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                {selectedAssetIds.map(id => {
                                    const asset = assets.find(a => a.id === id);
                                    if (!asset) return null;
                                    return (
                                        <div key={id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 animate-slide-in">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-800 dark:text-white text-sm">{asset.name}</span>
                                                <span className="text-xs text-slate-500 font-mono">{asset.serialNumber}</span>
                                            </div>
                                            <button type="button" className="p-1.5 text-slate-400 hover:text-rose-500" onClick={() => setSelectedAssetIds(prev => prev.filter(p => p !== id))}>×</button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col gap-1">
                          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Supporting Evidence</label>
                        </div>

                        {evidencePreview ? (
                            <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 group">
                                <img src={evidencePreview} alt="Preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" size="sm" onClick={() => { setEvidenceFile(null); setEvidencePreview(null); startCamera('request_evidence'); }}>Retake</Button>
                                        <Button variant="danger" size="sm" onClick={() => { setEvidenceFile(null); setEvidencePreview(null); }}>Remove</Button>
                                    </div>
                                </div>
                            </div>
                        ) : cameraMode === 'request_evidence' ? (
                            <div className="relative overflow-hidden rounded-2xl bg-slate-900 h-64 w-full border-4 border-indigo-500 shadow-xl animate-fade-in">
                                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                                    <Button type="button" variant="success" size="sm" onClick={capturePhoto}>Capture Now</Button>
                                    <Button type="button" variant="ghost" className="bg-black/40 text-white hover:bg-black/60 backdrop-blur-md" size="sm" onClick={stopCamera}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button type="button" variant="outline" className="flex-1 border-dashed py-6 group hover:border-indigo-400" onClick={() => fileInputRef.current?.click()} icon={<span className="text-2xl">📁</span>}>Upload File</Button>
                                <Button type="button" variant="outline" className="flex-1 border-dashed py-6 group hover:border-indigo-400" onClick={() => startCamera('request_evidence')} icon={<span className="text-2xl">📸</span>}>Take Photo</Button>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Input label="Purpose of Request" value={purpose} onChange={e => setPurpose(e.target.value)} required />
                        <Input type="date" label="Return Date" value={returnDate} onChange={e => setReturnDate(e.target.value)} required />
                    </div>
                    
                    <div className="flex justify-end pt-2">
                        <Button type="submit" disabled={selectedAssetIds.length === 0} size="lg" className="w-full">Submit Request</Button>
                    </div>
                </form>
            </Modal>

            {/* User QR Modal */}
            <Modal isOpen={!!selectedQR} onClose={() => setSelectedQR(null)} title="Gate Pass QR">
                <div className="flex flex-col items-center justify-center space-y-6 py-4">
                    <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100">
                        <QRCodeCanvas value={selectedQR || ''} size={200} level="H" includeMargin={true} />
                    </div>
                    <div className="text-center px-4">
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{selectedQR}</p>
                        <p className="text-xs text-slate-500 mt-2">Present to security guard at the gate.</p>
                    </div>
                    <Button variant="primary" className="w-full" onClick={() => setSelectedQR(null)}>Done</Button>
                </div>
            </Modal>

            {/* Cancel Request Modal */}
            <Modal isOpen={cancelModalOpen} onClose={() => setCancelModalOpen(false)} title="Cancel Request">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Are you sure you want to cancel this request? Admin will be notified.</p>
                    <textarea className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-600 dark:text-white" rows={3} placeholder="Reason for cancellation..." value={cancellationNote} onChange={e => setCancellationNote(e.target.value)} />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setCancelModalOpen(false)}>Back</Button>
                        <Button variant="danger" onClick={handleCancelRequest} disabled={!cancellationNote.trim()}>Confirm Cancel</Button>
                    </div>
                </div>
            </Modal>

            {/* Return Asset Modal */}
            <Modal isOpen={returnModalOpen} onClose={() => { setReturnModalOpen(false); stopCamera(); }} title="Return Assets">
                <div className="space-y-6">
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-xl text-sm text-indigo-800 dark:text-indigo-200">
                        <p className="font-bold mb-1">Instructions:</p>
                        <ul className="list-disc pl-4 space-y-1">
                            <li>Place all assets on a desk or return counter.</li>
                            <li>Take a clear photo showing all items.</li>
                            <li>The return time will be recorded automatically.</li>
                        </ul>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Return Evidence Photo</label>
                        <canvas ref={canvasRef} className="hidden" /> 
                        {returnEvidencePreview ? (
                            <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 group">
                                <img src={returnEvidencePreview} alt="Return Evidence" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                    <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20" size="sm" onClick={() => { setReturnEvidenceFile(null); setReturnEvidencePreview(null); startCamera('return_evidence'); }}>Retake Photo</Button>
                                </div>
                            </div>
                        ) : cameraMode === 'return_evidence' ? (
                            <div className="relative overflow-hidden rounded-2xl bg-slate-900 h-64 w-full border-4 border-indigo-500 shadow-xl">
                                <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                                <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3">
                                    <Button type="button" variant="success" size="sm" onClick={capturePhoto}>Capture</Button>
                                    <Button type="button" variant="ghost" className="bg-black/40 text-white" size="sm" onClick={stopCamera}>Cancel</Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full h-32 border-dashed flex flex-col gap-2" onClick={() => startCamera('return_evidence')}>
                                <span className="text-3xl">📸</span>
                                <span>Take Return Photo</span>
                            </Button>
                        )}
                    </div>

                    <div className="pt-2">
                        <label className="flex items-center space-x-2 cursor-pointer mb-3">
                            <input 
                                type="checkbox" 
                                className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                checked={isMissingItems}
                                onChange={(e) => setIsMissingItems(e.target.checked)}
                            />
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Are there any items missing or damaged?</span>
                        </label>
                        
                        {isMissingItems && (
                            <div className="animate-fade-in">
                                <label className="block text-sm font-semibold text-rose-600 dark:text-rose-400 mb-1.5">Missing/Damaged Items Details</label>
                                <textarea 
                                    className="w-full p-3 border border-rose-300 dark:border-rose-800 rounded-xl dark:bg-rose-900/10 text-slate-900 dark:text-white"
                                    rows={3}
                                    placeholder="Please list missing or damaged items here..."
                                    value={missingItemsReport}
                                    onChange={(e) => setMissingItemsReport(e.target.value)}
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Return Date & Time</label>
                        <input className="block w-full rounded-xl border-slate-300 bg-slate-100 text-slate-500 sm:text-sm py-2.5 px-3" value={new Date().toLocaleString()} disabled />
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button type="submit" onClick={handleReturnAsset} disabled={!returnEvidenceFile || (isMissingItems && !missingItemsReport.trim())} variant="success" size="lg" className="w-full">Confirm Return</Button>
                    </div>
                </div>
            </Modal>

            {/* Detailed History Modal */}
            <Modal isOpen={!!selectedHistoryItem} onClose={() => setSelectedHistoryItem(null)} title="Request Details">
                {selectedHistoryItem && (
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div>
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Request ID</div>
                                <div className="font-mono text-sm">{selectedHistoryItem.id}</div>
                            </div>
                            <div className="text-right">
                                <StatusBadge status={selectedHistoryItem.status} />
                                <div className="text-xs text-slate-400 mt-1">{new Date(selectedHistoryItem.requestDate).toLocaleDateString()}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white mb-2">Items</h4>
                                <div className="space-y-2">
                                    {selectedHistoryItem.items.map(item => (
                                        <div key={item.id} className="bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg text-sm border border-slate-200 dark:border-slate-600">
                                            <span className="font-bold">{item.name}</span>
                                            <div className="text-xs text-slate-500 font-mono">{item.serialNumber}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white mb-2">Timeline & Info</h4>
                                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                                    <p><span className="font-semibold">Purpose:</span> {selectedHistoryItem.purpose}</p>
                                    <p><span className="font-semibold">Expected Return:</span> {new Date(selectedHistoryItem.returnDate).toLocaleDateString()}</p>
                                    
                                    {selectedHistoryItem.approvedAt && <p><span className="font-semibold text-emerald-600">Approved:</span> {new Date(selectedHistoryItem.approvedAt).toLocaleString()}</p>}
                                    {selectedHistoryItem.gateVerifiedAt && <p><span className="font-semibold text-indigo-600">Gate Verified:</span> {new Date(selectedHistoryItem.gateVerifiedAt).toLocaleString()}</p>}
                                    
                                    {selectedHistoryItem.cancelledAt && (
                                        <div className="bg-rose-50 dark:bg-rose-900/20 p-2 rounded mt-2 border border-rose-100 dark:border-rose-800">
                                            <p className="text-rose-700 dark:text-rose-400 font-bold text-xs uppercase">Cancelled By User</p>
                                            <p className="text-rose-600 dark:text-rose-300">"{selectedHistoryItem.cancellationNote}"</p>
                                            <p className="text-xs text-rose-400 mt-1">{new Date(selectedHistoryItem.cancelledAt).toLocaleString()}</p>
                                        </div>
                                    )}

                                    {selectedHistoryItem.rejectionReason && (
                                        <div className="bg-rose-50 dark:bg-rose-900/20 p-2 rounded mt-2 border border-rose-100 dark:border-rose-800">
                                            <p className="text-rose-700 dark:text-rose-400 font-bold text-xs uppercase">Rejected By Admin</p>
                                            <p className="text-rose-600 dark:text-rose-300">"{selectedHistoryItem.rejectionReason}"</p>
                                        </div>
                                    )}

                                    {selectedHistoryItem.actualReturnDate && (
                                        <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded mt-2 border border-emerald-100 dark:border-emerald-800">
                                            <p className="text-emerald-700 dark:text-emerald-400 font-bold text-xs uppercase">Returned On</p>
                                            <p className="text-emerald-600 dark:text-emerald-300">{new Date(selectedHistoryItem.actualReturnDate).toLocaleString()}</p>
                                        </div>
                                    )}
                                    
                                    {selectedHistoryItem.missingItemsReport && (
                                        <div className="bg-rose-50 dark:bg-rose-900/20 p-2 rounded mt-2 border border-rose-100 dark:border-rose-800">
                                            <p className="text-rose-700 dark:text-rose-400 font-bold text-xs uppercase">⚠️ Missing/Damaged Items</p>
                                            <p className="text-rose-600 dark:text-rose-300 text-sm">"{selectedHistoryItem.missingItemsReport}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                            <h4 className="font-bold text-slate-800 dark:text-white mb-3">Evidence Gallery</h4>
                            <div className="flex gap-4 overflow-x-auto pb-2">
                                {selectedHistoryItem.evidenceUrl && (
                                    <div className="flex-shrink-0 cursor-zoom-in" onClick={() => setEnlargedImage(selectedHistoryItem.evidenceUrl!)}>
                                        <div className="text-xs mb-1 text-slate-500">Request Evidence</div>
                                        <img src={selectedHistoryItem.evidenceUrl} className="h-24 w-24 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                                    </div>
                                )}
                                {selectedHistoryItem.returnEvidenceUrl && (
                                    <div className="flex-shrink-0 cursor-zoom-in" onClick={() => setEnlargedImage(selectedHistoryItem.returnEvidenceUrl!)}>
                                        <div className="text-xs mb-1 text-slate-500">Return Evidence</div>
                                        <img src={selectedHistoryItem.returnEvidenceUrl} className="h-24 w-24 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition-opacity" />
                                    </div>
                                )}
                                {!selectedHistoryItem.evidenceUrl && !selectedHistoryItem.returnEvidenceUrl && <p className="text-sm text-slate-400 italic">No images attached.</p>}
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Image Enlarge Modal */}
            {enlargedImage && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setEnlargedImage(null)}>
                    <img src={enlargedImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
                    <button className="absolute top-4 right-4 text-white bg-white/20 hover:bg-white/30 rounded-full p-2" onClick={() => setEnlargedImage(null)}>
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            <style>{`
                @keyframes scan-up-down {
                    0% { transform: translateY(-60px); opacity: 0; }
                    50% { opacity: 1; }
                    100% { transform: translateY(60px); opacity: 0; }
                }
                .animate-scan-up-down { animation: scan-up-down 2.5s linear infinite; }
                @keyframes fade-in {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                @keyframes slide-in {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                .animate-slide-in { animation: slide-in 0.3s ease-out forwards; }
            `}</style>
        </div>
    );
};

// --- GUARD DASHBOARD ---
const GuardDashboard: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [request, setRequest] = useState<Request | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [manualCode, setManualCode] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const { addToast } = useToast();
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanningRef = useRef<boolean>(false);

    useEffect(() => {
        return () => {
            stopScanner();
        };
    }, []);

    const handleScan = async (code: string) => {
        if (loading) return;
        setLoading(true);
        stopScanner();
        try {
            const allRequests = await api.getRequests();
            const found = allRequests.find(r => r.gatePassCode === code || r.id === code);
            if (found) {
                setRequest(found);
                setScanResult(code);
                addToast("Request found", "success");
            } else {
                addToast("Invalid Gate Pass Code or Request ID", "error");
            }
        } catch (err) {
            addToast("Error fetching data", "error");
        } finally {
            setLoading(false);
        }
    };

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim()) handleScan(manualCode.trim());
    };

    const handleVerify = async () => {
        if (!request || !user) return;
        setActionLoading(true);
        try {
            await api.verifyGatePass(request.id, user.id, "Verified at gate");
            addToast("Gate Pass Verified Successfully", "success");
            // Refresh request data
            const allRequests = await api.getRequests();
            const updated = allRequests.find(r => r.id === request.id);
            if (updated) setRequest(updated);
        } catch (err: any) {
            addToast(err.message, "error");
        } finally {
            setActionLoading(false);
        }
    };

    const handleReportIssue = async () => {
         if (!request || !user) return;
         const reason = prompt("Enter issue details:");
         if (!reason) return;

         setActionLoading(true);
         try {
             await api.reportGateIssue(request.id, user.id, reason);
             addToast("Issue reported", "info");
             const allRequests = await api.getRequests();
             const updated = allRequests.find(r => r.id === request.id);
             if (updated) setRequest(updated);
         } catch (err: any) {
             addToast(err.message, "error");
         } finally {
             setActionLoading(false);
         }
    };

    const startScanner = async () => {
        setIsScanning(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'environment' } 
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Wait for video to be ready
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    scanningRef.current = true;
                    requestAnimationFrame(tick);
                };
            }
        } catch (err) {
            console.error(err);
            addToast("Camera access denied or unavailable", "error");
            setIsScanning(false);
        }
    };

    const stopScanner = () => {
        setIsScanning(false);
        scanningRef.current = false;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    const tick = () => {
        if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
             const size = Math.min(video.videoWidth, video.videoHeight);
             canvas.width = size;
             canvas.height = size;
             const ctx = canvas.getContext('2d', { willReadFrequently: true });
             if (ctx) {
                 // Crop center square
                 const sx = (video.videoWidth - size) / 2;
                 const sy = (video.videoHeight - size) / 2;
                 ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
                 
                 const imageData = ctx.getImageData(0, 0, size, size);
                 const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: "dontInvert" });
                 
                 if (code && code.data) {
                     handleScan(code.data);
                     return; 
                 }
             }
        }
        if (scanningRef.current) requestAnimationFrame(tick);
    };

    const reset = () => {
        setRequest(null);
        setScanResult(null);
        setManualCode('');
        stopScanner();
    };

    return (
        <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-6">Security Gate Check</h1>
            
            {!request ? (
                <Card className="p-6 space-y-6">
                    <div className="text-center">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="text-4xl">👮</span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Scan Gate Pass</h3>
                        <p className="text-slate-500 text-sm">Scan the QR code presented by the employee.</p>
                    </div>
                    
                    {isScanning ? (
                        <div className="relative overflow-hidden rounded-2xl bg-black aspect-square max-w-sm mx-auto border-4 border-indigo-500 shadow-2xl">
                            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                            <canvas ref={canvasRef} className="hidden" />
                            <div className="absolute inset-0 border-2 border-indigo-400/50 rounded-2xl m-8 pointer-events-none animate-pulse"></div>
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-indigo-500 animate-[scan-up-down_2s_infinite]"></div>
                            <button onClick={stopScanner} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 text-white px-4 py-2 rounded-full backdrop-blur-md text-sm hover:bg-white/30 transition-colors">Cancel Scan</button>
                        </div>
                    ) : (
                        <Button size="lg" className="w-full py-4 text-lg" onClick={startScanner} icon={<span>📷</span>}>
                            Start Camera Scan
                        </Button>
                    )}

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-bold">Or enter manually</span>
                        <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    </div>

                    <form onSubmit={handleManualSubmit} className="flex gap-2">
                        <Input 
                            placeholder="Enter GP Code (e.g. GP-1234)" 
                            value={manualCode} 
                            onChange={e => setManualCode(e.target.value)} 
                            className="mb-0"
                        />
                        <Button type="submit" disabled={!manualCode.trim() || loading}>Check</Button>
                    </form>
                </Card>
            ) : (
                <div className="space-y-6 animate-fade-in">
                    <Card className={`border-l-8 ${request.status === 'APPROVED' ? 'border-l-emerald-500' : 'border-l-amber-500'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gate Pass</span>
                                <h2 className="text-3xl font-mono font-bold text-slate-900 dark:text-white">{request.gatePassCode || 'N/A'}</h2>
                            </div>
                            <StatusBadge status={request.status} />
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6">
                            <div className="flex items-center gap-4 mb-4">
                                <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xl">
                                    {request.user.name.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-bold text-lg text-slate-900 dark:text-white">{request.user.name}</div>
                                    <div className="text-sm text-slate-500">{request.user.department}</div>
                                    {request.user.phoneNumber && <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-1">📞 {request.user.phoneNumber}</div>}
                                </div>
                            </div>
                            
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Authorized Items</div>
                                <ul className="space-y-2">
                                    {request.items.map(item => (
                                        <li key={item.id} className="flex justify-between items-center text-sm font-medium bg-white dark:bg-slate-700 p-2 rounded border border-slate-100 dark:border-slate-600">
                                            <span>{item.name}</span>
                                            <span className="font-mono text-slate-500">{item.serialNumber}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="block text-slate-400 text-xs">Return Date</span>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(request.returnDate).toLocaleDateString()}</span>
                                </div>
                                {request.gateComment && (
                                    <div className="col-span-2 mt-2 bg-slate-200 dark:bg-slate-800 p-2 rounded text-xs">
                                        <span className="font-bold">Note:</span> {request.gateComment}
                                    </div>
                                )}
                            </div>
                        </div>

                        {request.status === 'APPROVED' ? (
                            request.gateVerified ? (
                                <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 p-4 rounded-xl text-center font-bold border border-emerald-200 dark:border-emerald-800">
                                    ✅ Already Verified at {request.gateVerifiedAt ? new Date(request.gateVerifiedAt).toLocaleTimeString() : ''}
                                </div>
                            ) : (
                                <div className="flex gap-4">
                                    <Button onClick={handleVerify} variant="success" className="flex-1 py-4 text-lg shadow-lg shadow-emerald-200 dark:shadow-none" disabled={actionLoading}>
                                        ALLOW EXIT ✅
                                    </Button>
                                    <Button onClick={handleReportIssue} variant="danger" className="flex-1 py-4 shadow-lg shadow-rose-200 dark:shadow-none" disabled={actionLoading}>
                                        DENY / REPORT ⚠️
                                    </Button>
                                </div>
                            )
                        ) : (
                            <div className="bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 p-4 rounded-xl text-center font-bold border border-rose-200 dark:border-rose-800">
                                ⛔ NOT APPROVED FOR EXIT
                            </div>
                        )}
                        
                        <div className="mt-6 text-center">
                            <button onClick={reset} className="text-slate-500 hover:text-indigo-600 text-sm font-medium underline">
                                Scan Another Pass
                            </button>
                        </div>
                    </Card>
                </div>
            )}
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
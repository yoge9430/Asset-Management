
import React, { useState, useEffect, useContext, createContext, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { APP_NAME, MOCK_ASSETS, MOCK_USERS } from './constants';
import { User, UserRole, Request, RequestStatus, Notification, Asset, Deployment } from './types';
import * as api from './services/mockBackend';
import { Button, Card, Input, StatusBadge, Modal, Skeleton, Select, QuantityStepper, MultiSelect, ThemeProvider, ThemeToggle, ToastProvider, useToast } from './components/UI';

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
    // Subscribe to backend loading events
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

// --- NAVBAR (Responsive + Notifications + Approvals Badge) ---
const Navbar: React.FC = () => {
  const { user, logout } = useContext(AuthContext);
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [pendingCount, setPendingCount] = useState(0); // For Admin Badge
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // Mobile Menu State

  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
          // Fetch Notifications
          const userNotifs = await api.getNotifications(user.id);
          setNotifs(userNotifs);

          // If Admin, fetch pending requests count
          if (user.role === UserRole.ADMIN) {
              const reqs = await api.getRequests();
              const pending = reqs.filter(r => r.status === RequestStatus.PENDING).length;
              setPendingCount(pending);
          }
      };

      fetchData();
      const interval = setInterval(fetchData, 10000); // Poll every 10s
      return () => clearInterval(interval);
    }
  }, [user]);

  // Click outside to close notifications
  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
              setShowNotifs(false);
          }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
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
            {/* Mobile Menu Button */}
            <div className="flex md:hidden">
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-500 hover:text-indigo-600 dark:text-slate-400 focus:outline-none">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                    </svg>
                </button>
            </div>

            <div className="flex-shrink-0 cursor-pointer flex items-center gap-2" onClick={() => navigate('/')}>
              <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-200 dark:shadow-none shadow-lg">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="text-slate-900 dark:text-white font-bold text-xl tracking-tight hidden sm:block">{APP_NAME}</span>
            </div>
            
            {/* Desktop Navigation */}
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
             
             {/* NOTIFICATION DROPDOWN */}
             <div className="relative" ref={notifRef}>
                 <div 
                    onClick={() => setShowNotifs(!showNotifs)}
                    className="relative group cursor-pointer p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                 >
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
                                     <div 
                                        key={n.id} 
                                        className={`p-4 border-b border-slate-100 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${!n.read ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`}
                                        onClick={() => handleMarkRead(n.id)}
                                     >
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

      {/* Mobile Menu */}
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

// ... [Existing UserProfile and Login components remain unchanged] ...

const UserProfile: React.FC = () => {
    const { user, updateUserSession } = useContext(AuthContext);
    const [name, setName] = useState(user?.name || '');
    const [phone, setPhone] = useState(user?.phoneNumber || '');
    const [email, setEmail] = useState(user?.email || '');
    const [dept, setDept] = useState(user?.department || '');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();

    // Reset local state if user changes in context
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
            const updated = await api.updateUser(user!.id, {
                name,
                phoneNumber: phone,
                email,
                department: dept
            });
            updateUserSession(updated); // Update context
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
                        <Input 
                            label="Phone Number" 
                            value={phone} 
                            onChange={e => setPhone(e.target.value)} 
                            placeholder="+1-555-0000"
                            required 
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="w-full">
                            <Input 
                                label="Email Address"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                type="email"
                            />
                         </div>
                         <Input label="Department" value={dept} onChange={e => setDept(e.target.value)} />
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                        <Button type="submit" isLoading={loading}>Save Changes</Button>
                    </div>
                </form>
            </Card>

            <Card title="Security">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">Password</p>
                        <p className="text-sm text-slate-500">Last changed 3 months ago</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => addToast('Feature coming soon', 'info')}>Change Password</Button>
                </div>
            </Card>
        </div>
    );
};

// 1. LOGIN
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
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center opacity-60 dark:opacity-40 transition-opacity" 
        style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80")' }}
      >
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>
      </div>
      
      {/* Theme Toggle in Top Right */}
      <div className="absolute top-6 right-6 z-20">
          <ThemeToggle />
      </div>

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
                       <input 
                          type="email" 
                          value={email} 
                          onChange={(e) => setEmail(e.target.value)} 
                          required 
                          className="block w-full rounded-xl border-white/10 bg-black/20 text-white placeholder-indigo-200/50 focus:border-indigo-400 focus:ring-indigo-400 py-3.5 px-4 transition-all"
                          placeholder="name@company.com"
                        />
                   </div>
                   <div>
                       <label className="text-indigo-100 text-xs font-bold uppercase ml-1 block mb-1">Password</label>
                       <input 
                          type="password" 
                          value={password} 
                          onChange={(e) => setPassword(e.target.value)} 
                          required 
                          className="block w-full rounded-xl border-white/10 bg-black/20 text-white placeholder-indigo-200/50 focus:border-indigo-400 focus:ring-indigo-400 py-3.5 px-4 transition-all"
                          placeholder="••••••••"
                        />
                   </div>
                </div>
                
                {error && (
                    <div className="bg-rose-500/20 border border-rose-500/50 rounded-lg p-3 text-rose-200 text-sm text-center">
                        {error}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/40 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? 'Authenticating...' : 'Sign In'}
                </button>
            </form>

            <div className="my-6 flex items-center">
                <div className="flex-1 border-t border-white/20"></div>
                <span className="px-3 text-indigo-200 text-xs font-medium">OR CONTINUE WITH</span>
                <div className="flex-1 border-t border-white/20"></div>
            </div>

            <button 
                type="button"
                onClick={handleGoogleLogin}
                className="w-full py-3 px-4 bg-white hover:bg-slate-100 text-slate-800 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-3 active:scale-95"
            >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
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

// ... [Existing AdminDashboard and AdminApprovals] ...

// 2. ADMIN DASHBOARD
const AdminDashboard: React.FC = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [loading, setLoading] = useState(true);
  
    useEffect(() => {
      const fetchData = async () => {
          setLoading(true);
          const [reqs, assts, deps] = await Promise.all([
              api.getRequests(),
              api.getAssets(),
              api.getDeployments()
          ]);
          setRequests(reqs);
          setAssets(assts);
          setDeployments(deps);
          setLoading(false);
      };
      fetchData();
    }, []);
  
    const pendingRequests = requests.filter(r => r.status === RequestStatus.PENDING);
    const recentRequests = [...requests].sort((a,b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()).slice(0, 5);
  
    return (
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
        
        {/* STATS CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
               Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
          ) : (
              <>
                  <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-xl shadow-indigo-200 dark:shadow-none">
                      <div className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Pending Approvals</div>
                      <div className="text-5xl font-extrabold">{pendingRequests.length}</div>
                      <div className="mt-2 text-indigo-200 text-xs">Requires attention</div>
                  </Card>
                  <Card>
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Inventory</div>
                      <div className="text-4xl font-bold text-slate-800 dark:text-white">{assets.length}</div>
                  </Card>
                  <Card>
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Deployed Hardware</div>
                      <div className="text-4xl font-bold text-slate-800 dark:text-white">{deployments.length}</div>
                  </Card>
                  <Card>
                      <div className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Gate Verified</div>
                      <div className="text-4xl font-bold text-slate-800 dark:text-white">{requests.filter(r => r.gateVerified).length}</div>
                  </Card>
              </>
          )}
        </div>

        {/* RECENT ACTIVITY */}
        <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h2>
            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">User</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Items</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                        {loading ? (
                            <tr><td colSpan={4} className="p-4 text-center">Loading...</td></tr>
                        ) : recentRequests.map(req => (
                            <tr key={req.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="text-sm font-medium text-slate-900 dark:text-white">{req.user.name}</div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-slate-500 dark:text-slate-400">{req.items.map(i => i.name).join(', ')}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <StatusBadge status={req.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                                    {new Date(req.requestDate).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            </Card>
        </div>
      </div>
    );
};

// 3. ADMIN APPROVALS
const AdminApprovals: React.FC = () => {
    const [requests, setRequests] = useState<Request[]>([]);
    const [view, setView] = useState<'queue' | 'history'>('queue');
    const [refresh, setRefresh] = useState(0);
    const [loading, setLoading] = useState(true);
    
    // Filters & Sorting
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [statusFilter, setStatusFilter] = useState('ALL');
    
    // Reject Modal State
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [processing, setProcessing] = useState(false);
    
    const { addToast } = useToast();

    useEffect(() => { 
        setLoading(true);
        api.getRequests().then(data => {
            setRequests(data);
            setLoading(false);
        }); 
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
        setRejectId(null);
        setRejectReason('');
        setRefresh(p => p+1);
        setProcessing(false);
    };

    // Filter Logic
    const filteredList = requests
        .filter(r => view === 'queue' ? r.status === 'PENDING' : r.status !== 'PENDING')
        .filter(r => {
            const matchesSearch = r.user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  r.items.some(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
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

            {/* FILTERS TOOLBAR */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <Input 
                    placeholder="Search user or item..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="mb-0 flex-1"
                />
                <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    {view === 'history' && (
                        <Select 
                            options={[
                                { value: 'ALL', label: 'All Status' },
                                { value: RequestStatus.APPROVED, label: 'Approved' },
                                { value: RequestStatus.REJECTED, label: 'Rejected' },
                                { value: RequestStatus.RETURNED, label: 'Returned' }
                            ]}
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="mb-0 w-40 flex-shrink-0"
                        />
                    )}
                    <Select 
                        options={[
                            { value: 'newest', label: 'Newest First' },
                            { value: 'oldest', label: 'Oldest First' }
                        ]}
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value as any)}
                        className="mb-0 w-40 flex-shrink-0"
                    />
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
                                <div className="my-2">
                                    <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Requested Items:</span>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {req.items.map(i => (
                                            <span key={i.id} className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-sm text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">{i.name}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 p-3 rounded-lg mt-2 italic">
                                    "{req.purpose}"
                                </div>
                                {req.evidenceUrl && <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 font-bold">📎 Evidence Attached</div>}
                            </div>
                            
                            {view === 'queue' && (
                                <div className="flex gap-3 mt-4 md:mt-0">
                                    <Button variant="success" onClick={() => handleApprove(req.id)} disabled={processing}>Approve</Button>
                                    <Button variant="danger" onClick={() => setRejectId(req.id)} disabled={processing}>Reject</Button>
                                </div>
                            )}
                            
                            {view === 'history' && (
                                <div className="flex flex-col items-end gap-2">
                                    <StatusBadge status={req.status} />
                                    {req.rejectionReason && <span className="text-xs text-rose-500">Reason: {req.rejectionReason}</span>}
                                    <span className="text-xs text-slate-400">{new Date(req.requestDate).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
                {filteredList.length === 0 && <div className="text-center p-8 text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">No requests found.</div>}
            </div>

            {/* REJECT MODAL */}
            <Modal isOpen={!!rejectId} onClose={() => setRejectId(null)} title="Reject Request">
                <div className="space-y-4">
                    <p className="text-sm text-slate-500 dark:text-slate-400">Please provide a reason for rejection. This will be visible to the user.</p>
                    <textarea 
                        className="w-full p-3 border rounded-xl dark:bg-slate-900 dark:border-slate-600 dark:text-white" 
                        rows={3}
                        placeholder="e.g. Item not available, Business justification insufficient..."
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button variant="ghost" onClick={() => setRejectId(null)}>Cancel</Button>
                        <Button variant="danger" onClick={confirmReject} disabled={!rejectReason.trim() || processing}>Confirm Rejection</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

// --- ADMIN USERS PAGE ---
const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { addToast } = useToast();
    const csvInputRef = useRef<HTMLInputElement>(null);

    // Add User Form State
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState<UserRole>(UserRole.USER);
    const [newDept, setNewDept] = useState('');
    const [newPhone, setNewPhone] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (err) {
            addToast('Failed to load users', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.createUser({
                name: newName,
                email: newEmail,
                role: newRole,
                department: newDept,
                phoneNumber: newPhone
            });
            addToast('User created successfully', 'success');
            setIsModalOpen(false);
            setNewName(''); setNewEmail(''); setNewRole(UserRole.USER); setNewDept(''); setNewPhone('');
            fetchUsers();
        } catch (err: any) {
            addToast(err.message || 'Failed to create user', 'error');
        }
    };

    const handleRoleChange = async (userId: string, newRole: string) => {
        try {
            await api.updateUserRole(userId, newRole as UserRole);
            addToast('Role updated successfully', 'success');
            // Optimistic update
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as UserRole } : u));
        } catch (err: any) {
            addToast('Failed to update role', 'error');
            fetchUsers(); // Revert on error
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
                    const count = await api.importUsersFromCSV(text);
                    addToast(`Successfully imported ${count} users`, 'success');
                    fetchUsers();
                } catch (err) {
                    addToast('Failed to parse CSV', 'error');
                }
            }
        };
        reader.readAsText(file);
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">User Management</h1>
                <div className="flex gap-3">
                    <input 
                        type="file" 
                        accept=".csv" 
                        ref={csvInputRef} 
                        className="hidden" 
                        onChange={handleCSVUpload} 
                    />
                    <Button variant="secondary" onClick={() => csvInputRef.current?.click()} icon={<span>📄</span>}>Import CSV</Button>
                    <Button onClick={() => setIsModalOpen(true)} icon={<span>+</span>}>Add User</Button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-slate-50 dark:bg-slate-700/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Name</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Role</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Department</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Status</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Change Role</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                Array(5).fill(0).map((_, i) => (
                                    <tr key={i}>
                                        <td className="px-6 py-4"><Skeleton className="h-6 w-32" /></td>
                                        <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
                                        <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
                                        <td className="px-6 py-4"><Skeleton className="h-6 w-16 mx-auto" /></td>
                                        <td className="px-6 py-4"><Skeleton className="h-8 w-24 mx-auto" /></td>
                                    </tr>
                                ))
                            ) : (
                                users.map(u => (
                                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 dark:text-white">{u.name}</span>
                                                <span className="text-xs text-slate-500">{u.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                                                u.role === UserRole.ADMIN ? 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300' :
                                                u.role === UserRole.GUARD ? 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300' :
                                                'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300'
                                            }`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-300">{u.department || 'N/A'}</td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-flex h-2.5 w-2.5 rounded-full ${u.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} title={u.isActive ? 'Active' : 'Inactive'} />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <select 
                                                className="text-xs border rounded-lg p-1.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 focus:ring-indigo-500 cursor-pointer"
                                                value={u.role}
                                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                            >
                                                <option value={UserRole.USER}>User</option>
                                                <option value={UserRole.ADMIN}>Admin</option>
                                                <option value={UserRole.GUARD}>Guard</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Create New User">
                <form onSubmit={handleCreateUser} className="space-y-4">
                    <Input label="Full Name" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="e.g. Jane Doe" />
                    <Input label="Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required placeholder="user@company.com" />
                    <div className="grid grid-cols-2 gap-4">
                        <Input label="Department" value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="Engineering" />
                        <Input label="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+1..." />
                    </div>
                    <Select 
                        label="Role"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as UserRole)}
                        options={[
                            { value: UserRole.USER, label: 'Employee' },
                            { value: UserRole.ADMIN, label: 'Administrator' },
                            { value: UserRole.GUARD, label: 'Security Guard' }
                        ]}
                    />
                    <div className="flex justify-end pt-4">
                        <Button type="submit">Create Account</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

// 4. ADMIN INVENTORY (Modified with CSV)
const AdminInventory: React.FC = () => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const { addToast } = useToast();
    
    // View Details Modal State
    const [viewGroup, setViewGroup] = useState<(Asset & { items: Asset[] }) | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    
    // Form State
    const [name, setName] = useState('');
    const [category, setCategory] = useState('');
    const [desc, setDesc] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [serials, setSerials] = useState<string[]>(['']);

    // CSV Input Ref
    const csvInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchAssets();
    }, []);

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
            addToast('Please enter at least one serial number', 'error');
            return;
        }
        const imageUrl = imageFile ? URL.createObjectURL(imageFile) : 'https://picsum.photos/200/200';
        await api.bulkAddAssets({ name, category, description: desc, status: 'AVAILABLE', imageUrl }, validSerials);
        addToast(`${validSerials.length} items added successfully`, 'success');
        setIsModalOpen(false);
        setName(''); setCategory(''); setDesc(''); setSerials(['']); setImageFile(null);
        fetchAssets();
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
                    addToast(`Successfully imported ${count} assets from CSV`, 'success');
                    fetchAssets();
                } catch (err) {
                    addToast('Failed to parse CSV', 'error');
                }
            }
        };
        reader.readAsText(file);
        // Reset input
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    // ... [Reuse quantity helper functions from previous AdminInventory] ...
    const handleQuantityChange = (newQty: number) => {
        const currentQty = serials.length;
        if (newQty > currentQty) {
            const added = Array(newQty - currentQty).fill('');
            setSerials([...serials, ...added]);
        } else if (newQty < currentQty) {
            setSerials(serials.slice(0, newQty));
        }
    };

    const updateSerial = (index: number, val: string) => {
        const newSerials = [...serials];
        newSerials[index] = val;
        setSerials(newSerials);
    };

    const removeSerialInput = (index: number) => {
        if (serials.length === 1) {
            setSerials(['']); 
        } else {
            setSerials(serials.filter((_, i) => i !== index));
        }
    };

    // Derived Categories
    const existingCategories = Array.from(new Set(assets.map(a => a.category)));
    const groupedAssets = Object.values(assets.reduce((acc, asset) => {
        if (!acc[asset.name]) acc[asset.name] = { ...asset, items: [] as Asset[] };
        acc[asset.name].items.push(asset);
        return acc;
    }, {} as Record<string, Asset & { items: Asset[] }>));

    const filtered = groupedAssets
        .filter(g => {
            const matchesSearch = g.name.toLowerCase().includes(search.toLowerCase()) || 
                                  g.category.toLowerCase().includes(search.toLowerCase());
            const matchesCategory = categoryFilter === 'ALL' || g.category === categoryFilter;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            return sortOrder === 'asc' 
                ? a.name.localeCompare(b.name) 
                : b.name.localeCompare(a.name);
        });

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Inventory</h1>
                <div className="flex gap-3">
                    <input 
                        type="file" 
                        accept=".csv" 
                        ref={csvInputRef} 
                        className="hidden" 
                        onChange={handleCSVUpload} 
                    />
                    <Button variant="secondary" onClick={() => csvInputRef.current?.click()} icon={<span>📄</span>}>Import CSV</Button>
                    <Button onClick={() => setIsModalOpen(true)} icon={<span>+</span>}>Add Assets</Button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <Input 
                    placeholder="Search model, category..." 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    className="mb-0 flex-1"
                />
                <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <Select 
                        options={[{value: 'ALL', label: 'All Categories'}, ...existingCategories.map(c => ({value: c, label: c}))]}
                        value={categoryFilter}
                        onChange={e => setCategoryFilter(e.target.value)}
                        className="mb-0 w-48 flex-shrink-0"
                    />
                    <Select 
                        options={[{ value: 'asc', label: 'Name (A-Z)' }, { value: 'desc', label: 'Name (Z-A)' }]}
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value as any)}
                        className="mb-0 w-40 flex-shrink-0"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Model Name</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Category</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Total Stock</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Available</th>
                            <th className="px-6 py-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                        {loading ? (
                             Array(5).fill(0).map((_, i) => (
                                <tr key={i}>
                                    <td className="px-6 py-4"><Skeleton className="h-6 w-32" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
                                    <td className="px-6 py-4 text-center"><Skeleton className="h-6 w-8 mx-auto" /></td>
                                    <td className="px-6 py-4 text-center"><Skeleton className="h-6 w-8 mx-auto" /></td>
                                    <td className="px-6 py-4 text-center"><Skeleton className="h-8 w-24 mx-auto" /></td>
                                </tr>
                            ))
                        ) : filtered.map((group, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                <td className="px-6 py-4 text-slate-900 dark:text-white font-medium whitespace-nowrap">{group.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300">
                                        {group.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center text-slate-900 dark:text-white font-bold">{group.items.length}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded">
                                        {group.items.filter(i => i.status === 'AVAILABLE').length}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setViewGroup(group)}>View Details</Button>
                                </td>
                            </tr>
                        ))}
                         {!loading && filtered.length === 0 && (
                            <tr><td colSpan={5} className="text-center p-8 text-slate-500">No assets found matching filters.</td></tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {/* Same Modals as before ... */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Asset">
                <form onSubmit={handleAddAsset} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                             <Input label="Asset Model Name" placeholder="e.g. MacBook Pro M3" value={name} onChange={e => setName(e.target.value)} required />
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                                <input 
                                    list="categories" 
                                    className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2.5 px-3 border transition-colors"
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    placeholder="Select existing or type to create new..."
                                    required
                                />
                                <datalist id="categories">
                                    {existingCategories.map(c => <option key={c} value={c} />)}
                                </datalist>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Asset Image</label>
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-4 text-center cursor-pointer relative h-32 flex flex-col items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <input type="file" onChange={e => setImageFile(e.target.files?.[0] || null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" accept="image/*" />
                                {imageFile ? (
                                    <div className="relative z-10">
                                        <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[150px]">{imageFile.name}</p>
                                        <p className="text-xs text-slate-400">Click to change</p>
                                    </div>
                                ) : (
                                    <>
                                        <span className="text-2xl mb-1">📷</span>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">Click to upload</div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <QuantityStepper label="Quantity" value={serials.length} onChange={handleQuantityChange} />
                    
                    <div className="space-y-2 mb-4">
                         <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Serial Numbers</label>
                         <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
                             {serials.map((sn, index) => (
                                 <div key={index} className="flex gap-2 items-center">
                                     <span className="text-xs text-slate-400 w-6 text-right">{index + 1}.</span>
                                     <input 
                                        type="text"
                                        className="flex-1 rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm py-2 px-3 border transition-colors"
                                        placeholder={`Serial Number #${index + 1}`}
                                        value={sn}
                                        onChange={e => updateSerial(index, e.target.value)}
                                        required
                                     />
                                     <button type="button" onClick={() => removeSerialInput(index)} className="text-slate-400 hover:text-rose-500 transition-colors p-1"><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                                 </div>
                             ))}
                         </div>
                    </div>
                    
                    <Input label="Description (Optional)" placeholder="Specs, condition, etc." value={desc} onChange={e => setDesc(e.target.value)} />
                    <div className="flex justify-end pt-4">
                        <Button type="submit" variant="primary">Add {serials.length} Item{serials.length > 1 ? 's' : ''}</Button>
                    </div>
                </form>
            </Modal>

            {/* DETAIL MODAL (Same as before) */}
            <Modal isOpen={!!viewGroup} onClose={() => setViewGroup(null)} title="Asset Details">
                {viewGroup && (
                    <div className="space-y-6">
                        <div className="flex flex-col md:flex-row gap-6">
                            <img src={viewGroup.imageUrl} alt={viewGroup.name} className="w-full md:w-48 h-48 object-cover rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600" />
                            <div className="flex-1 space-y-3">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{viewGroup.name}</h3>
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300 mt-1 border border-slate-200 dark:border-slate-600">
                                        {viewGroup.category}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {viewGroup.description || "No description provided."}
                                </p>
                                <div className="flex gap-4 pt-2">
                                    <div className="text-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <div className="text-xs text-slate-500 uppercase font-bold">Total</div>
                                        <div className="text-xl font-bold text-slate-900 dark:text-white">{viewGroup.items.length}</div>
                                    </div>
                                    <div className="text-center p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800">
                                        <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-bold">Available</div>
                                        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{viewGroup.items.filter(i => i.status === 'AVAILABLE').length}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                                <span>Inventory List</span>
                                <span className="text-xs font-normal text-slate-500">({viewGroup.items.length} items)</span>
                            </h4>
                            <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                                    <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Serial Number</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                                            <th className="px-4 py-2 text-left text-xs font-bold text-slate-500 uppercase">Asset ID</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
                                        {viewGroup.items.map(item => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2 text-sm font-mono text-slate-700 dark:text-slate-300">{item.serialNumber}</td>
                                                <td className="px-4 py-2">
                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                                                        item.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                                        item.status === 'IN_USE' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800' :
                                                        item.status === 'DEPLOYED' ? 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800' :
                                                        'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                                                    }`}>
                                                        {item.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2 text-xs text-slate-400">{item.id}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button onClick={() => setViewGroup(null)}>Close Details</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// ... [Existing AdminDeployments, UserDashboard, GuardDashboard remain the same] ...

// 5. ADMIN DEPLOYMENTS (Modified with CSV)
const AdminDeployments: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [deployments, setDeployments] = useState<Deployment[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

    // CSV Input
    const csvInputRef = useRef<HTMLInputElement>(null);

    // Deployment Form State
    const [client, setClient] = useState('');
    const [location, setLocation] = useState('');
    const [contactPerson, setContactPerson] = useState('');
    const [contactNumber, setContactNumber] = useState('');
    const [contactDesignation, setContactDesignation] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [date, setDate] = useState('');
    
    // View Details Modal
    const [viewDeployment, setViewDeployment] = useState<Deployment | null>(null);

    const { addToast } = useToast();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const [depData, assetData] = await Promise.all([api.getDeployments(), api.getAssets()]);
        setDeployments(depData);
        setAssets(assetData.filter(a => a.status === 'AVAILABLE'));
        setLoading(false);
    };

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault();
        await api.addDeployment(
            client, 
            location,
            contactPerson,
            contactNumber,
            contactDesignation,
            selectedIds, 
            date, 
            user?.id || 'admin'
        );
        addToast('Deployment recorded successfully', 'success');
        setIsModalOpen(false);
        // Reset form
        setClient(''); setLocation(''); setContactPerson(''); setContactNumber(''); setContactDesignation(''); setSelectedIds([]); setDate('');
        fetchData();
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
                    addToast(`Successfully imported ${count} deployments from CSV`, 'success');
                    fetchData();
                } catch (err) {
                    addToast('Failed to parse CSV', 'error');
                }
            }
        };
        reader.readAsText(file);
        if (csvInputRef.current) csvInputRef.current.value = '';
    };

    // Filter Logic
    const filteredDeployments = deployments
        .filter(d => d.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const dateA = new Date(a.deploymentDate).getTime();
            const dateB = new Date(b.deploymentDate).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">External Deployments</h1>
                <div className="flex gap-3">
                    <input 
                        type="file" 
                        accept=".csv" 
                        ref={csvInputRef} 
                        className="hidden" 
                        onChange={handleCSVUpload} 
                    />
                    <Button variant="secondary" onClick={() => csvInputRef.current?.click()} icon={<span>📄</span>}>Import CSV</Button>
                    <Button onClick={() => setIsModalOpen(true)} icon={<span>+</span>}>New Deployment</Button>
                </div>
            </div>

            {/* FILTERS TOOLBAR */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mb-6 flex flex-col md:flex-row gap-4 items-center">
                <Input 
                    placeholder="Search client/company..." 
                    value={searchTerm} 
                    onChange={e => setSearchTerm(e.target.value)} 
                    className="mb-0 flex-1"
                />
                <div className="w-full md:w-auto">
                    <Select 
                        options={[
                            { value: 'newest', label: 'Newest First' },
                            { value: 'oldest', label: 'Oldest First' }
                        ]}
                        value={sortOrder}
                        onChange={e => setSortOrder(e.target.value as any)}
                        className="mb-0 w-40"
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700/50">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Client / Company</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Location</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Contact</th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                            <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                        {loading ? (
                             Array(5).fill(0).map((_, i) => (
                                <tr key={i}>
                                    <td className="px-6 py-4"><Skeleton className="h-6 w-32" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-10 w-24" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-6 w-20" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-8 w-20 ml-auto" /></td>
                                </tr>
                            ))
                        ) : filteredDeployments.map(d => (
                            <tr key={d.id}>
                                <td className="px-6 py-4 text-slate-900 dark:text-white font-medium whitespace-nowrap">{d.clientName}</td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">{d.location}</td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">
                                    <div className="font-semibold">{d.contactPerson}</div>
                                    <div className="text-xs">{d.contactNumber}</div>
                                </td>
                                <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm whitespace-nowrap">{new Date(d.deploymentDate).toLocaleDateString()}</td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <Button size="sm" variant="outline" onClick={() => setViewDeployment(d)}>View Items</Button>
                                </td>
                            </tr>
                        ))}
                        {!loading && filteredDeployments.length === 0 && (
                            <tr><td colSpan={5} className="text-center p-8 text-slate-500">No deployments found.</td></tr>
                        )}
                    </tbody>
                </table>
                </div>
            </div>

            {/* CREATE MODAL */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Deploy Hardware">
                <form onSubmit={handleDeploy} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input label="Client / Company Name" value={client} onChange={e => setClient(e.target.value)} required />
                        <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} required placeholder="City, Office, etc." />
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Site Contact Details</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <Input label="Contact Person" value={contactPerson} onChange={e => setContactPerson(e.target.value)} required />
                             <Input label="Contact Number" value={contactNumber} onChange={e => setContactNumber(e.target.value)} required />
                             <Input label="Designation" value={contactDesignation} onChange={e => setContactDesignation(e.target.value)} required placeholder="e.g. IT Manager" />
                        </div>
                    </div>

                    <MultiSelect label="Select Assets to Deploy" options={assets.map(a => ({value: a.id, label: a.name, subLabel: a.serialNumber}))} selectedValues={selectedIds} onChange={setSelectedIds} />
                    <Input type="date" label="Deployment Date" value={date} onChange={e => setDate(e.target.value)} required />
                    
                    <div className="flex justify-end pt-4">
                        <Button type="submit">Confirm Deployment</Button>
                    </div>
                </form>
            </Modal>

            {/* VIEW DETAILS MODAL */}
            <Modal isOpen={!!viewDeployment} onClose={() => setViewDeployment(null)} title={`Deployment Details: ${viewDeployment?.clientName}`}>
                {viewDeployment && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-6 text-sm">
                            <div>
                                <h5 className="text-xs font-bold text-slate-500 uppercase mb-1">Location</h5>
                                <p className="text-slate-900 dark:text-white font-medium">{viewDeployment.location}</p>
                            </div>
                            <div>
                                <h5 className="text-xs font-bold text-slate-500 uppercase mb-1">Deployment Date</h5>
                                <p className="text-slate-900 dark:text-white font-medium">{new Date(viewDeployment.deploymentDate).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                             <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Point of Contact</h5>
                             <div className="grid grid-cols-3 gap-4 text-sm">
                                 <div>
                                     <span className="block text-slate-400 text-xs">Name</span>
                                     <span className="font-medium text-slate-900 dark:text-white">{viewDeployment.contactPerson}</span>
                                 </div>
                                 <div>
                                     <span className="block text-slate-400 text-xs">Phone</span>
                                     <span className="font-medium text-slate-900 dark:text-white">{viewDeployment.contactNumber}</span>
                                 </div>
                                 <div>
                                     <span className="block text-slate-400 text-xs">Designation</span>
                                     <span className="font-medium text-slate-900 dark:text-white">{viewDeployment.contactDesignation}</span>
                                 </div>
                             </div>
                        </div>

                        <div>
                            <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Deployed Assets ({viewDeployment.items.length})</h5>
                            <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                                <table className="min-w-full">
                                    <thead className="bg-slate-50 dark:bg-slate-800">
                                        <tr>
                                            <th className="text-left text-xs py-2 px-3 text-slate-500 uppercase">Asset Name</th>
                                            <th className="text-left text-xs py-2 px-3 text-slate-500 uppercase">Serial Number</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewDeployment.items.map(item => (
                                            <tr key={item.id} className="border-b border-slate-50 dark:border-slate-700 last:border-0">
                                                <td className="py-2 px-3 text-sm font-medium text-slate-900 dark:text-white">{item.name}</td>
                                                <td className="py-2 px-3 text-sm font-mono text-slate-500 dark:text-slate-400">{item.serialNumber}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button onClick={() => setViewDeployment(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

// ... [Existing UserDashboard and GuardDashboard remain unchanged] ...

// 6. USER DASHBOARD
const UserDashboard: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [requests, setRequests] = useState<Request[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Form
    const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
    const [purpose, setPurpose] = useState('');
    const [returnDate, setReturnDate] = useState('');
    
    const { addToast } = useToast();

    const fetchData = async () => {
        setLoading(true);
        const [allReqs, allAssets] = await Promise.all([api.getRequests(), api.getAssets()]);
        setRequests(allReqs.filter(r => r.userId === user?.id));
        setAssets(allAssets.filter(a => a.status === 'AVAILABLE')); // Only show available
        setLoading(false);
    };

    useEffect(() => {
        if (user) fetchData();
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedAssetIds.length === 0) {
            addToast('Please select at least one item', 'error');
            return;
        }
        try {
            await api.createRequest(user!.id, selectedAssetIds, purpose, returnDate);
            addToast('Request submitted successfully', 'success');
            setIsModalOpen(false);
            fetchData();
            // Reset
            setSelectedAssetIds([]); setPurpose(''); setReturnDate('');
        } catch (err: any) {
            addToast(err.message, 'error');
        }
    };

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Requests</h1>
                <Button onClick={() => setIsModalOpen(true)} icon={<span>+</span>}>New Request</Button>
            </div>

            <div className="space-y-4">
                {loading ? <Skeleton className="h-24" /> : requests.map(req => (
                    <Card key={req.id}>
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="flex gap-2 mb-2">
                                    {req.items.map(i => (
                                        <span key={i.id} className="font-bold text-slate-800 dark:text-white">{i.name}</span>
                                    ))}
                                </div>
                                <div className="text-sm text-slate-500">
                                    Requested: {new Date(req.requestDate).toLocaleDateString()} • Return: {new Date(req.returnDate).toLocaleDateString()}
                                </div>
                                {req.gatePassCode && <div className="mt-2 text-indigo-600 font-mono font-bold bg-indigo-50 px-2 py-1 inline-block rounded border border-indigo-100">Gate Pass: {req.gatePassCode}</div>}
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <StatusBadge status={req.status} />
                                {req.gateVerified && <span className="text-xs text-emerald-600 font-bold">Gate Verified</span>}
                            </div>
                        </div>
                    </Card>
                ))}
                {!loading && requests.length === 0 && <div className="text-center p-8 text-slate-500">No requests history.</div>}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Request Assets">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <MultiSelect 
                        label="Select Items" 
                        options={assets.map(a => ({ value: a.id, label: a.name, subLabel: a.category }))} 
                        selectedValues={selectedAssetIds} 
                        onChange={setSelectedAssetIds} 
                    />
                    <Input label="Purpose" value={purpose} onChange={e => setPurpose(e.target.value)} required placeholder="Why do you need this?" />
                    <Input type="date" label="Return Date" value={returnDate} onChange={e => setReturnDate(e.target.value)} required />
                    <div className="flex justify-end pt-4">
                        <Button type="submit">Submit Request</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

// 7. GUARD DASHBOARD
const GuardDashboard: React.FC = () => {
    const [code, setCode] = useState('');
    const [foundRequest, setFoundRequest] = useState<Request | null>(null);
    const [loading, setLoading] = useState(false);
    const [empIdInput, setEmpIdInput] = useState('');
    const [admins, setAdmins] = useState<Record<string, string>>({});
    
    const { addToast } = useToast();
    const { user } = useContext(AuthContext);

    // Fetch users to map Admin IDs to Names
    useEffect(() => {
        api.getUsers().then(users => {
            const map = users.reduce((acc, u) => ({...acc, [u.id]: u.name}), {});
            setAdmins(map);
        });
    }, []);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const reqs = await api.getRequests();
        const found = reqs.find(r => r.gatePassCode === code || r.id === code);
        
        if (found) {
            setFoundRequest(found);
            setEmpIdInput('');
            addToast('Request found', 'success');
        } else {
            setFoundRequest(null);
            addToast('Invalid Gate Pass Code or Request ID', 'error');
        }
        setLoading(false);
    };

    const handleVerify = async () => {
        if (!foundRequest || !user) return;
        try {
            const finalComment = empIdInput.trim() ? `[ID Checked: ${empIdInput}] Verified at gate` : "Verified at gate";
            const updated = await api.verifyGatePass(foundRequest.id, user.id, finalComment);
            setFoundRequest(updated);
            addToast('Gate Pass Verified. User allowed to exit.', 'success');
        } catch (err: any) {
            addToast(err.message, 'error');
        }
    };

    return (
        <div className="max-w-2xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-8 text-center">Gate Verification</h1>
            
            <Card className="mb-8">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <Input 
                        placeholder="Enter Gate Pass Code (e.g. GP-1234)" 
                        value={code} 
                        onChange={e => setCode(e.target.value)} 
                        className="mb-0 flex-1"
                        autoFocus
                    />
                    <Button type="submit" isLoading={loading}>Verify</Button>
                </form>
            </Card>

            {foundRequest && (
                <Card title="Request Details" className="animate-slide-in">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div>
                                <div className="text-xs text-slate-500 uppercase font-bold">Employee</div>
                                <div className="font-bold text-lg text-slate-900 dark:text-white">{foundRequest.user.name}</div>
                                <div className="text-sm text-slate-500">{foundRequest.user.department}</div>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-slate-500 uppercase font-bold">Status</div>
                                <StatusBadge status={foundRequest.status} />
                            </div>
                        </div>

                        <div>
                            <div className="text-xs text-slate-500 uppercase font-bold mb-2">Approved Items</div>
                            <div className="space-y-2">
                                {foundRequest.items.map(item => (
                                    <div key={item.id} className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg">
                                        <span className="font-medium text-slate-800 dark:text-slate-200">{item.name}</span>
                                        <span className="font-mono text-xs text-slate-400">{item.serialNumber}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Approval Details Section */}
                         <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg border border-slate-100 dark:border-slate-700 mt-2">
                            <div>
                                <span className="block text-xs text-slate-500 uppercase font-bold mb-0.5">Approved By</span>
                                <span className="font-medium text-slate-900 dark:text-white">{admins[foundRequest.approvedBy || ''] || 'System Admin'}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500 uppercase font-bold mb-0.5">Approval Time</span>
                                <span className="font-medium text-slate-900 dark:text-white">{foundRequest.approvedAt ? new Date(foundRequest.approvedAt).toLocaleString() : '-'}</span>
                            </div>
                        </div>

                        {/* Verification Action Section */}
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                             {foundRequest.gateVerified ? (
                                 <div className="w-full text-center p-4 bg-emerald-100 text-emerald-800 rounded-xl font-bold border border-emerald-200">
                                     ✅ ALREADY VERIFIED
                                     <div className="text-xs font-normal opacity-75 mt-1">
                                         {new Date(foundRequest.gateVerifiedAt!).toLocaleString()} by {foundRequest.gateVerifiedBy}
                                     </div>
                                 </div>
                             ) : (
                                 <div className="space-y-4">
                                     {foundRequest.status === 'APPROVED' && (
                                         <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Verify Employee ID (Optional)</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    className="block w-full rounded-xl border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 px-3 border"
                                                    placeholder="Scan or type ID..."
                                                    value={empIdInput}
                                                    onChange={e => setEmpIdInput(e.target.value)}
                                                />
                                            </div>
                                         </div>
                                     )}
                                     
                                     <div className="flex justify-between items-center">
                                        <div className="text-sm text-slate-500">Check items physically before verifying.</div>
                                        <Button variant="success" size="lg" onClick={handleVerify} disabled={foundRequest.status !== 'APPROVED'}>
                                            CONFIRM EXIT
                                        </Button>
                                     </div>
                                 </div>
                             )}
                        </div>
                        
                        {foundRequest.status !== 'APPROVED' && foundRequest.status !== 'CHECKED_OUT' && (
                             <div className="text-center text-rose-600 font-bold bg-rose-50 p-2 rounded">
                                 ⚠️ Request is not APPROVED. Do not let out.
                             </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};

// 8. APP ROUTING
const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: UserRole[] }> = ({ children, roles }) => {
    const { user, isLoading } = useContext(AuthContext);
    
    if (isLoading) return <div className="min-h-screen flex items-center justify-center dark:bg-slate-900"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;
    
    if (!user) return <Navigate to="/login" replace />;
    
    if (roles && !roles.includes(user.role)) {
        return <div className="min-h-screen flex flex-col items-center justify-center dark:bg-slate-900 dark:text-white">
            <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
            <p className="text-slate-500">You do not have permission to view this page.</p>
            <Button className="mt-4" onClick={() => window.history.back()}>Go Back</Button>
        </div>;
    }
    
    return <>{children}</>;
};

const AppRoutes: React.FC = () => {
    const { user } = useContext(AuthContext);
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
            {user && <Navbar />}
            <Routes>
                <Route path="/login" element={<Login />} />
                
                {/* ADMIN */}
                <Route path="/admin" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminDashboard /></ProtectedRoute>} />
                <Route path="/admin/approvals" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminApprovals /></ProtectedRoute>} />
                <Route path="/admin/inventory" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminInventory /></ProtectedRoute>} />
                <Route path="/admin/deployments" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminDeployments /></ProtectedRoute>} />
                <Route path="/admin/users" element={<ProtectedRoute roles={[UserRole.ADMIN]}><AdminUsers /></ProtectedRoute>} />
                
                {/* USER */}
                <Route path="/user" element={<ProtectedRoute roles={[UserRole.USER]}><UserDashboard /></ProtectedRoute>} />
                
                {/* GUARD */}
                <Route path="/guard" element={<ProtectedRoute roles={[UserRole.GUARD]}><GuardDashboard /></ProtectedRoute>} />
                
                {/* COMMON */}
                <Route path="/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
                
                <Route path="/" element={<Navigate to={user ? (user.role === UserRole.ADMIN ? "/admin" : user.role === UserRole.GUARD ? "/guard" : "/user") : "/login"} replace />} />
            </Routes>
        </div>
    );
};

const App: React.FC = () => {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <HashRouter>
                        <GlobalLoadingBar />
                        <AppRoutes />
                    </HashRouter>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
};

export default App;

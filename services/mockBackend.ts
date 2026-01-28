
import { User, Asset, Request, UserRole, RequestStatus, Notification, Deployment, SystemSettings } from '../types';
import { MOCK_USERS, MOCK_ASSETS, MOCK_REQUESTS, MOCK_DEPLOYMENTS } from '../constants';

// Keys for LocalStorage
const KEY_USERS = 'e9ogral_users';
const KEY_ASSETS = 'e9ogral_assets';
const KEY_REQUESTS = 'e9ogral_requests';
const KEY_DEPLOYMENTS = 'e9ogral_deployments';
const KEY_NOTIFICATIONS = 'e9ogral_notifications';
const KEY_SESSION = 'e9ogral_session';
const KEY_SETTINGS = 'e9ogral_settings';

// --- GLOBAL LOADING LISTENER ---
type Listener = (isLoading: boolean) => void;
let loadingListener: Listener | null = null;
let activeRequests = 0;

export const subscribeToLoading = (listener: Listener) => {
  loadingListener = listener;
  // Initialize with current state
  listener(activeRequests > 0);
  return () => { loadingListener = null; };
};

const notifyLoading = () => {
  if (loadingListener) loadingListener(activeRequests > 0);
};

// Helper to simulate network delay
const delay = (ms: number) => {
  activeRequests++;
  notifyLoading();
  return new Promise(resolve => setTimeout(() => {
    activeRequests--;
    notifyLoading();
    resolve(true);
  }, ms));
};

// Initialize Data
const initializeDB = () => {
  if (!localStorage.getItem(KEY_USERS)) localStorage.setItem(KEY_USERS, JSON.stringify(MOCK_USERS));
  if (!localStorage.getItem(KEY_ASSETS)) localStorage.setItem(KEY_ASSETS, JSON.stringify(MOCK_ASSETS));
  if (!localStorage.getItem(KEY_REQUESTS)) localStorage.setItem(KEY_REQUESTS, JSON.stringify(MOCK_REQUESTS));
  if (!localStorage.getItem(KEY_DEPLOYMENTS)) localStorage.setItem(KEY_DEPLOYMENTS, JSON.stringify(MOCK_DEPLOYMENTS));
  if (!localStorage.getItem(KEY_NOTIFICATIONS)) localStorage.setItem(KEY_NOTIFICATIONS, JSON.stringify([]));
  if (!localStorage.getItem(KEY_SETTINGS)) localStorage.setItem(KEY_SETTINGS, JSON.stringify({ adminContactNumber: '+1-555-0199' }));
};

initializeDB();

// --- AUTH SERVICE ---

export const login = async (email: string, password?: string): Promise<User> => {
  await delay(800);
  
  // Basic validation (Simulating secure check)
  if (!email) throw new Error('Email is required');
  // For Google Login simulation, we might skip password check or use a specific flag
  if (password !== 'google-auth-token' && !password) throw new Error('Password is required');

  const users: User[] = JSON.parse(localStorage.getItem(KEY_USERS) || '[]');
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) throw new Error('User not found');
  if (!user.isActive) throw new Error('Account deactivated');

  localStorage.setItem(KEY_SESSION, JSON.stringify(user));
  return user;
};

export const logout = async () => {
  localStorage.removeItem(KEY_SESSION);
};

export const getSession = (): User | null => {
  const s = localStorage.getItem(KEY_SESSION);
  return s ? JSON.parse(s) : null;
};

// --- DATA SERVICES ---

const getDB = () => ({
  users: JSON.parse(localStorage.getItem(KEY_USERS) || '[]') as User[],
  assets: JSON.parse(localStorage.getItem(KEY_ASSETS) || '[]') as Asset[],
  requests: JSON.parse(localStorage.getItem(KEY_REQUESTS) || '[]') as Request[],
  deployments: JSON.parse(localStorage.getItem(KEY_DEPLOYMENTS) || '[]') as Deployment[],
  notifications: JSON.parse(localStorage.getItem(KEY_NOTIFICATIONS) || '[]') as Notification[],
  settings: JSON.parse(localStorage.getItem(KEY_SETTINGS) || '{}') as SystemSettings
});

const saveDB = (key: string, data: any) => localStorage.setItem(key, JSON.stringify(data));

// SETTINGS
export const getSystemSettings = async (): Promise<SystemSettings> => {
    await delay(200);
    return getDB().settings;
};

export const updateSystemSettings = async (settings: SystemSettings): Promise<void> => {
    await delay(400);
    saveDB(KEY_SETTINGS, settings);
};

// USERS & PROFILE
export const getUsers = async () => { await delay(300); return getDB().users; };

export const createUser = async (user: Omit<User, 'id' | 'isActive'>): Promise<User> => {
    await delay(600);
    const db = getDB();
    if (db.users.some(u => u.email.toLowerCase() === user.email.toLowerCase())) {
        throw new Error("User with this email already exists");
    }
    const newUser: User = {
        ...user,
        id: `u-${Date.now()}`,
        isActive: true
    };
    db.users.push(newUser);
    saveDB(KEY_USERS, db.users);
    return newUser;
};

export const updateUserRole = async (userId: string, newRole: UserRole): Promise<User> => {
    await delay(400);
    const db = getDB();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error("User not found");
    
    db.users[idx].role = newRole;
    saveDB(KEY_USERS, db.users);
    return db.users[idx];
};

export const importUsersFromCSV = async (csvText: string): Promise<number> => {
    await delay(1500);
    const db = getDB();
    const lines = csvText.split('\n');
    let count = 0;
    
    // Expected format: Name,Email,Role,Department,Phone
    // Skip header row if present (simple check if first row contains "Email")
    const startIdx = lines[0].toLowerCase().includes('email') ? 1 : 0;

    for (let i = startIdx; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const [name, email, roleStr, dept, phone] = line.split(',');
        
        if (name && email) {
            // Check duplicate
            if (db.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) continue;

            const role = Object.values(UserRole).includes(roleStr?.trim().toUpperCase() as UserRole) 
                ? (roleStr.trim().toUpperCase() as UserRole) 
                : UserRole.USER;

            db.users.push({
                id: `u-${Date.now()}-${i}`,
                name: name.trim(),
                email: email.trim(),
                role: role,
                department: dept ? dept.trim() : 'General',
                phoneNumber: phone ? phone.trim() : '',
                isActive: true
            });
            count++;
        }
    }
    saveDB(KEY_USERS, db.users);
    return count;
};

export const updateUser = async (userId: string, updates: Partial<User>): Promise<User> => {
    await delay(500);
    const db = getDB();
    const idx = db.users.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error("User not found");

    // Check email uniqueness if email is being updated
    if (updates.email && updates.email !== db.users[idx].email) {
        const emailExists = db.users.some(u => u.email.toLowerCase() === updates.email!.toLowerCase() && u.id !== userId);
        if (emailExists) throw new Error("Email already in use");
    }

    const updatedUser = { ...db.users[idx], ...updates };
    db.users[idx] = updatedUser;
    saveDB(KEY_USERS, db.users);

    // Update session if it's the current user
    const session = getSession();
    if (session && session.id === userId) {
        localStorage.setItem(KEY_SESSION, JSON.stringify(updatedUser));
    }

    return updatedUser;
};


// REQUESTS

export const getRequests = async (): Promise<Request[]> => {
  await delay(400);
  const db = getDB();
  // CRITICAL: Join with latest Users data to ensure phone numbers are up to date for the Guard
  return db.requests.map(req => {
      const freshUser = db.users.find(u => u.id === req.userId);
      return freshUser ? { ...req, user: freshUser } : req;
  });
};

// Updated to accept multiple asset IDs and evidence file
export const createRequest = async (userId: string, assetIds: string[], purpose: string, returnDate: string, evidenceFile?: File): Promise<Request> => {
  await delay(800); // Increased delay to simulate upload
  const db = getDB();
  const user = db.users.find(u => u.id === userId);
  const selectedAssets = db.assets.filter(a => assetIds.includes(a.id));
  
  if (!user || selectedAssets.length === 0) throw new Error("Invalid user or no assets selected");

  // Mock file upload by creating a fake URL if file exists
  const evidenceUrl = evidenceFile ? URL.createObjectURL(evidenceFile) : undefined;

  const newRequest: Request = {
    id: `req-${Date.now()}`,
    userId,
    user,
    itemIds: assetIds,
    items: selectedAssets,
    status: RequestStatus.PENDING,
    requestDate: new Date().toISOString(),
    returnDate,
    purpose,
    gateVerified: false,
    evidenceUrl
  };

  db.requests.unshift(newRequest);
  saveDB(KEY_REQUESTS, db.requests);
  const assetNames = selectedAssets.map(a => a.name).join(', ');
  createNotification(userId, `Request submitted for ${assetNames}`);
  return newRequest;
};

export const updateRequestStatus = async (reqId: string, status: RequestStatus, reason?: string, adminId?: string): Promise<Request> => {
  await delay(400);
  const db = getDB();
  const idx = db.requests.findIndex(r => r.id === reqId);
  if (idx === -1) throw new Error("Request not found");

  const req = db.requests[idx];
  req.status = status;
  
  const assetNames = req.items.map(i => i.name).join(', ');

  if (status === RequestStatus.APPROVED) {
    req.approvedBy = adminId;
    req.approvedAt = new Date().toISOString();
    req.gatePassCode = `GP-${Math.floor(1000 + Math.random() * 9000)}`;
    createNotification(req.userId, `Your request for ${assetNames} has been APPROVED. Gate Pass: ${req.gatePassCode}`);
  } else if (status === RequestStatus.REJECTED) {
    req.rejectionReason = reason;
    req.approvedBy = adminId; 
    req.approvedAt = new Date().toISOString(); 
    createNotification(req.userId, `Your request for ${assetNames} was REJECTED. Reason: ${reason}`);
  }

  db.requests[idx] = req;
  saveDB(KEY_REQUESTS, db.requests);
  return req;
};

export const cancelRequest = async (reqId: string, note: string): Promise<Request> => {
    await delay(500);
    const db = getDB();
    const idx = db.requests.findIndex(r => r.id === reqId);
    if (idx === -1) throw new Error("Request not found");

    if (db.requests[idx].status !== RequestStatus.PENDING) {
        throw new Error("Only pending requests can be cancelled");
    }

    db.requests[idx].status = RequestStatus.CANCELLED;
    db.requests[idx].cancellationNote = note;
    db.requests[idx].cancelledAt = new Date().toISOString();

    saveDB(KEY_REQUESTS, db.requests);
    return db.requests[idx];
};

export const submitAssetReturn = async (reqId: string, evidenceFile?: File, missingItemsReport?: string): Promise<Request> => {
    await delay(1000);
    const db = getDB();
    const idx = db.requests.findIndex(r => r.id === reqId);
    if (idx === -1) throw new Error("Request not found");

    const req = db.requests[idx];
    
    // In a real app we might have a RETURN_PENDING state, but here we mark as returned.
    req.status = RequestStatus.RETURNED;
    req.actualReturnDate = new Date().toISOString();
    req.missingItemsReport = missingItemsReport;
    
    if (evidenceFile) {
        req.returnEvidenceUrl = URL.createObjectURL(evidenceFile);
    }

    db.requests[idx] = req;
    
    saveDB(KEY_REQUESTS, db.requests);
    
    let msg = `Assets returned for Request #${req.id}`;
    if (missingItemsReport) msg += " (With missing items report)";
    createNotification(req.userId, msg);
    
    return req;
};

// GATE VERIFICATION
export const verifyGatePass = async (reqId: string, guardId: string, comment: string): Promise<Request> => {
  await delay(600);
  const db = getDB();
  const idx = db.requests.findIndex(r => r.id === reqId);
  if (idx === -1) throw new Error("Request not found");

  const req = db.requests[idx];
  
  if (req.status !== RequestStatus.APPROVED && req.status !== RequestStatus.CHECKED_OUT) {
    throw new Error("Cannot verify gate pass for unapproved requests");
  }

  req.gateVerified = true;
  req.gateVerifiedBy = guardId;
  req.gateVerifiedAt = new Date().toISOString();
  req.gateComment = comment;

  db.requests[idx] = req;
  saveDB(KEY_REQUESTS, db.requests);

  createNotification(req.userId, `Gate Pass Verified. You may now take the items.`);
  createNotification('u-1', `Gate verified by Guard for Request #${req.id}`);

  return req;
};

// REPORT GATE ISSUE (DENY EXIT)
export const reportGateIssue = async (reqId: string, guardId: string, comment: string): Promise<Request> => {
    await delay(600);
    const db = getDB();
    const idx = db.requests.findIndex(r => r.id === reqId);
    if (idx === -1) throw new Error("Request not found");
  
    const req = db.requests[idx];
    
    // We do NOT set gateVerified to true. We just log the issue.
    req.gateVerified = false;
    req.gateVerifiedBy = guardId;
    // We treat gateComment as the issue log
    req.gateComment = `[ISSUE REPORTED]: ${comment}`;
    req.gateVerifiedAt = new Date().toISOString(); // Mark when the issue happened
  
    db.requests[idx] = req;
    saveDB(KEY_REQUESTS, db.requests);
  
    createNotification(req.userId, `ISSUE AT GATE: ${comment}. Please contact security.`);
    createNotification('u-1', `Guard reported issue for Request #${req.id}: ${comment}`);
  
    return req;
  };

// ASSETS
export const getAssets = async () => { await delay(300); return getDB().assets; };

export const addAsset = async (asset: Omit<Asset, 'id'>): Promise<Asset> => {
    await delay(500);
    const db = getDB();
    const newAsset: Asset = {
        ...asset,
        id: `a-${Date.now()}`
    };
    db.assets.unshift(newAsset);
    saveDB(KEY_ASSETS, db.assets);
    return newAsset;
};

// New function for Bulk Add
export const bulkAddAssets = async (baseAsset: Omit<Asset, 'id' | 'serialNumber'>, serialNumbers: string[]): Promise<Asset[]> => {
    await delay(600);
    const db = getDB();
    const timestamp = Date.now();
    
    const newAssets: Asset[] = serialNumbers.map((sn, index) => ({
        ...baseAsset,
        id: `a-${timestamp}-${index}`,
        serialNumber: sn
    }));
    
    // Add to beginning
    db.assets.unshift(...newAssets);
    saveDB(KEY_ASSETS, db.assets);
    return newAssets;
};

export const importAssetsFromCSV = async (csvText: string): Promise<number> => {
    await delay(1500);
    const db = getDB();
    const lines = csvText.split('\n');
    let count = 0;
    
    // Expected format: Name,Category,SerialNumber,Description
    for (let i = 1; i < lines.length; i++) { // Skip header
        const line = lines[i].trim();
        if (!line) continue;
        
        const [name, category, serialNumber, description] = line.split(',');
        
        if (name && category && serialNumber) {
            db.assets.unshift({
                id: `a-${Date.now()}-${i}`,
                name: name.trim(),
                category: category.trim(),
                serialNumber: serialNumber.trim(),
                description: description ? description.trim() : '',
                status: 'AVAILABLE',
                imageUrl: 'https://picsum.photos/200/200?random=' + i
            });
            count++;
        }
    }
    saveDB(KEY_ASSETS, db.assets);
    return count;
};

// DEPLOYED HARDWARE
export const getDeployments = async (): Promise<Deployment[]> => {
    await delay(300);
    return getDB().deployments;
};

export const addDeployment = async (
  clientName: string, 
  location: string,
  contactPerson: string,
  contactNumber: string,
  contactDesignation: string,
  assetIds: string[], 
  deploymentDate: string, 
  deployedBy: string, 
  notes?: string
): Promise<Deployment> => {
    await delay(500);
    const db = getDB();
    
    const selectedAssets = db.assets.filter(a => assetIds.includes(a.id));
    
    // Update assets status to DEPLOYED
    db.assets = db.assets.map(a => {
        if (assetIds.includes(a.id)) {
            return { ...a, status: 'DEPLOYED' };
        }
        return a;
    });

    const newDep: Deployment = {
        id: `dep-${Date.now()}`,
        clientName,
        location,
        contactPerson,
        contactNumber,
        contactDesignation,
        items: selectedAssets,
        deploymentDate,
        deployedBy,
        notes
    };
    
    db.deployments.unshift(newDep);
    
    saveDB(KEY_DEPLOYMENTS, db.deployments);
    saveDB(KEY_ASSETS, db.assets); // Save updated asset statuses
    
    return newDep;
};

export const importDeploymentsFromCSV = async (csvText: string, adminId: string): Promise<number> => {
    await delay(1500);
    const db = getDB();
    const lines = csvText.split('\n');
    let count = 0;

    // Expected: ClientName,Location,ContactName,ContactNumber,Designation,Date,AssetSerialNumbers(semicolon sep)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const [client, loc, contact, phone, desig, date, assetSerials] = line.split(',');
        
        if (client && assetSerials) {
            const serials = assetSerials.split(';').map(s => s.trim());
            const assetsToDeploy = db.assets.filter(a => serials.includes(a.serialNumber) && a.status === 'AVAILABLE');
            
            if (assetsToDeploy.length > 0) {
                // Update Asset Status
                db.assets = db.assets.map(a => {
                    if (assetsToDeploy.some(ad => ad.id === a.id)) return { ...a, status: 'DEPLOYED' };
                    return a;
                });

                db.deployments.unshift({
                    id: `dep-${Date.now()}-${i}`,
                    clientName: client.trim(),
                    location: loc ? loc.trim() : 'Remote',
                    contactPerson: contact ? contact.trim() : 'N/A',
                    contactNumber: phone ? phone.trim() : 'N/A',
                    contactDesignation: desig ? desig.trim() : 'N/A',
                    items: assetsToDeploy,
                    deploymentDate: date ? date.trim() : new Date().toISOString(),
                    deployedBy: adminId
                });
                count++;
            }
        }
    }
    
    saveDB(KEY_DEPLOYMENTS, db.deployments);
    saveDB(KEY_ASSETS, db.assets);
    return count;
};


// NOTIFICATIONS
const createNotification = (userId: string, message: string) => {
  const db = getDB();
  const notif: Notification = {
    id: `n-${Date.now()}`,
    userId,
    message,
    read: false,
    createdAt: new Date().toISOString(),
    type: 'INFO'
  };
  db.notifications.unshift(notif);
  saveDB(KEY_NOTIFICATIONS, db.notifications);
};

export const getNotifications = async (userId: string) => {
  await delay(200);
  return getDB().notifications.filter(n => n.userId === userId);
};

export const markNotificationRead = async (notifId: string) => {
  const db = getDB();
  const idx = db.notifications.findIndex(n => n.id === notifId);
  if (idx > -1) {
    db.notifications[idx].read = true;
    saveDB(KEY_NOTIFICATIONS, db.notifications);
  }
};

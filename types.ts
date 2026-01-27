
export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER',
  GUARD = 'GUARD'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CHECKED_OUT = 'CHECKED_OUT',
  RETURNED = 'RETURNED'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  department?: string;
  phoneNumber?: string; // Added for contact feature
}

export interface Asset {
  id: string;
  name: string;
  serialNumber: string;
  category: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'DEPLOYED';
  imageUrl: string;
  description: string;
}

export interface Deployment {
  id: string;
  clientName: string; // Company Name
  location: string;       // NEW
  contactPerson: string;  // NEW
  contactNumber: string;  // NEW
  contactDesignation: string; // NEW
  items: Asset[];
  deploymentDate: string;
  deployedBy: string;
  notes?: string;
}

export interface Request {
  id: string;
  userId: string;
  user: User;
  
  // Changed from single asset to multiple
  itemIds: string[]; 
  items: Asset[]; 

  status: RequestStatus;
  requestDate: string;
  returnDate: string;
  purpose: string;
  
  // Evidence
  evidenceUrl?: string; // URL or Mock File Name

  // Approval
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;

  // Gate Verification
  gateVerified: boolean;
  gateVerifiedBy?: string;
  gateVerifiedAt?: string;
  gateComment?: string;
  gatePassCode?: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  createdAt: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING';
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

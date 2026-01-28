
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
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED' // New Status
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  avatarUrl?: string;
  department?: string;
  phoneNumber?: string;
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
  clientName: string;
  location: string;
  contactPerson: string;
  contactNumber: string;
  contactDesignation: string;
  items: Asset[];
  deploymentDate: string;
  deployedBy: string;
  notes?: string;
}

export interface Request {
  id: string;
  userId: string;
  user: User;
  
  itemIds: string[]; 
  items: Asset[]; 

  status: RequestStatus;
  requestDate: string;
  returnDate: string;
  purpose: string;
  
  // Evidence (Request creation)
  evidenceUrl?: string;

  // Approval
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;

  // Cancellation
  cancellationNote?: string;
  cancelledAt?: string;

  // Return
  actualReturnDate?: string;
  returnEvidenceUrl?: string;
  missingItemsReport?: string; // New field for missing/damaged items

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

export interface SystemSettings {
  adminContactNumber: string;
}

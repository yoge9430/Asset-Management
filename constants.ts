
import { User, UserRole, Asset, Request, RequestStatus, Deployment } from './types';

export const APP_NAME = "E9OGRAL";

export const MOCK_USERS: User[] = [
  {
    id: 'u-1',
    name: 'Admin User',
    email: 'admin@e9ogral.com',
    role: UserRole.ADMIN,
    isActive: true,
    department: 'IT Operations',
    phoneNumber: '+1-555-0101'
  },
  {
    id: 'u-2',
    name: 'John Employee',
    email: 'john@e9ogral.com',
    role: UserRole.USER,
    isActive: true,
    department: 'Sales',
    phoneNumber: '+1-555-0102'
  },
  {
    id: 'u-3',
    name: 'Sarah Guard',
    email: 'guard@e9ogral.com',
    role: UserRole.GUARD,
    isActive: true,
    department: 'Security',
    phoneNumber: '+1-555-0199' // Guard Hotline
  }
];

export const MOCK_ASSETS: Asset[] = [
  {
    id: 'a-1',
    name: 'MacBook Pro 16"',
    serialNumber: 'MBP-2024-X99',
    category: 'Laptop',
    status: 'AVAILABLE',
    imageUrl: 'https://picsum.photos/200/200?random=1',
    description: 'High performance laptop for development'
  },
  {
    id: 'a-2',
    name: 'Dell XPS 15',
    serialNumber: 'DELL-5520-B21',
    category: 'Laptop',
    status: 'AVAILABLE',
    imageUrl: 'https://picsum.photos/200/200?random=2',
    description: 'Standard issue laptop'
  },
  {
    id: 'a-3',
    name: 'Sony Alpha Camera',
    serialNumber: 'SNY-CAM-001',
    category: 'Camera',
    status: 'IN_USE',
    imageUrl: 'https://picsum.photos/200/200?random=3',
    description: 'For marketing events'
  },
  {
    id: 'a-4',
    name: 'Projector 4K',
    serialNumber: 'EPS-PROJ-882',
    category: 'Equipment',
    status: 'AVAILABLE',
    imageUrl: 'https://picsum.photos/200/200?random=4',
    description: 'Conference room projector'
  },
  {
    id: 'a-5',
    name: 'Cisco Router 2900',
    serialNumber: 'CSC-2900-881',
    category: 'Network',
    status: 'DEPLOYED',
    imageUrl: 'https://picsum.photos/200/200?random=5',
    description: 'Network Gateway'
  },
  {
    id: 'a-6',
    name: 'Dell PowerEdge',
    serialNumber: 'DEL-PE-7721',
    category: 'Server',
    status: 'DEPLOYED',
    imageUrl: 'https://picsum.photos/200/200?random=6',
    description: 'Rack Server'
  }
];

export const MOCK_DEPLOYMENTS: Deployment[] = [
  {
    id: 'dep-1',
    clientName: 'Acme Corp',
    location: 'New York, NY',
    contactPerson: 'Alice Smith',
    contactNumber: '212-555-0101',
    contactDesignation: 'IT Director',
    items: [MOCK_ASSETS[4]],
    deploymentDate: '2023-11-15',
    deployedBy: 'u-1',
    notes: 'Main office gateway'
  },
  {
    id: 'dep-2',
    clientName: 'TechStart Inc',
    location: 'San Francisco, CA',
    contactPerson: 'Bob Jones',
    contactNumber: '415-555-0999',
    contactDesignation: 'CTO',
    items: [MOCK_ASSETS[5], MOCK_ASSETS[3]],
    deploymentDate: '2024-01-10',
    deployedBy: 'u-1',
    notes: 'On-premise deployment with presentation kit'
  }
];

export const MOCK_REQUESTS: Request[] = [
  {
    id: 'req-1',
    userId: 'u-2',
    user: MOCK_USERS[1],
    itemIds: ['a-3'],
    items: [MOCK_ASSETS[2]],
    status: RequestStatus.APPROVED,
    requestDate: new Date().toISOString(),
    returnDate: new Date(Date.now() + 86400000 * 3).toISOString(),
    purpose: 'Product photo shoot',
    approvedBy: 'u-1',
    approvedAt: new Date().toISOString(),
    gateVerified: false,
    gatePassCode: 'GP-9123'
  },
  {
    id: 'req-2',
    userId: 'u-2',
    user: MOCK_USERS[1],
    itemIds: ['a-1'],
    items: [MOCK_ASSETS[0]],
    status: RequestStatus.PENDING,
    requestDate: new Date().toISOString(),
    returnDate: new Date(Date.now() + 86400000 * 7).toISOString(),
    purpose: 'My laptop is broken, need loaner',
    gateVerified: false
  },
  {
    id: 'req-3',
    userId: 'u-2',
    user: MOCK_USERS[1],
    itemIds: ['a-2'],
    items: [MOCK_ASSETS[1]],
    status: RequestStatus.REJECTED,
    requestDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    returnDate: new Date(Date.now() + 86400000 * 2).toISOString(),
    purpose: 'Gaming test',
    approvedBy: 'u-1',
    rejectionReason: 'Not business critical',
    gateVerified: false
  }
];

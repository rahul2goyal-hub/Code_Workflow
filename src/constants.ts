import { User, UserRole } from './types';

export const DUMMY_USERS: User[] = [
  { id: '1', username: 'pl_user', role: UserRole.PL, name: 'John PL' },
  { id: '2', username: 'pmo_user', role: UserRole.PMO, name: 'Sarah PMO' },
  { id: '3', username: 'mlh_user1', role: UserRole.MLH, name: 'Mike MLH 1' },
  { id: '4', username: 'mlh_user2', role: UserRole.MLH, name: 'Alice MLH 2' },
  { id: '5', username: 'rmt_user', role: UserRole.RMT, name: 'Robert RMT' },
  { id: '6', username: 'pl_user2', role: UserRole.PL, name: 'Jane PL 2' },
];

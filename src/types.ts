export enum UserRole {
  PL = 'PL',
  PMO = 'PMO',
  MLH = 'MLH',
  RMT = 'RMT'
}

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  PENDING_PMO = 'PENDING_PMO',
  PENDING_MLH_INITIAL = 'PENDING_MLH_INITIAL',
  PENDING_PL_DETAILS = 'PENDING_PL_DETAILS',
  PENDING_MLH_FINAL = 'PENDING_MLH_FINAL',
  COMPLETED_RMT = 'COMPLETED_RMT'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

export interface WorkflowItem {
  id: string;
  status: WorkflowStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  
  // Initial Stage (PL)
  ipcDocumentUrl?: string;
  
  // PMO Stage
  modelName?: string;
  archetype?: string;
  partOfCP?: boolean; // Yes/No
  flowType?: 'R' | 'D';
  assignedMLH?: string; // User ID
  sopDate?: string;
  
  // MLH Initial Stage
  assignedPL?: string; // User ID
  
  // PL Details Stage
  newModelBaseModel?: string;
  baseModelChange?: string;
  newModelChange?: string;
  actualCompletionDate?: string;
  marketType?: 'GB' | 'D';
  baseModelMarketType?: string;
  
  // History/Logs
  history: WorkflowLog[];
}

export interface WorkflowLog {
  status: WorkflowStatus;
  updatedBy: string;
  timestamp: number;
  comment?: string;
}

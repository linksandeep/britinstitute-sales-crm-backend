import { Document } from 'mongoose';
import * as mongoose from 'mongoose';


export type AssignmentSource =
  | 'Manual'
  | 'Bulk'
  | 'Import'
  | 'Reimport'
  | 'System';

export interface IAssignmentHistory {
  assignedTo: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId | null;
  assignedAt: Date;
  source: AssignmentSource;
}


// User Types
export interface IUser extends Document {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'admin' | 'user';
  isActive: boolean;
  lastLogin?: Date;
  canWorkFromHome:boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ILead extends Document {
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  zoomPhoneNumber?: string;
  position: string;
  folder: string;
  source: LeadSource;
  status: LeadStatus;
  priority: LeadPriority;
  campaignName?: string;  // Added
  adsetName?: string;     // Added
  adName?: string;        // Added
  metaLeadId?: string;
  assignedTo?: mongoose.Types.ObjectId;
  assignedBy?: mongoose.Types.ObjectId;

  /**  THIS WAS MISSING */
  assignmentHistory: IAssignmentHistory[];

  notes: ILeadNote[];
  leadScore?: number;

  createdAt: Date;
  updatedAt: Date;

  /** methods */
  addNote(content: string, createdBy: mongoose.Types.ObjectId): Promise<this>;

  /** virtuals (optional but recommended) */
  assignmentCount?: number;
  wasReassigned?: boolean;
}


export interface ILeadModel extends mongoose.Model<ILead> {
  findDuplicates(email: string, phone: string, excludeId?: string): Promise<ILead[]>;
  getDuplicateError(error: any): string | null;
}

export interface ILeadNote {
  id: string;
  content: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
}

export type LeadSource =
  | 'Website'
  | 'Social Media'
  | 'Referral'
  | 'Import'
  | 'Manual'
  | 'Cold Call'
  | 'Email Campaign'
  | 'strategy_call_modal'
  | 'data_analytics_landing_page';

// LeadStatus is now dynamic - can be any string
export type LeadStatus = string;

export type LeadPriority = 'High' | 'Medium' | 'Low';

export interface CreateLeadInput {
  name: string;
  email: string;
  phone: string;
  whatsapp?: string;
  zoomPhoneNumber?: string;
  position?: string;
  folder?: string;
  source: LeadSource;

  priority: LeadPriority;
  notes?: string;
  campaignName?: string;
  adsetName?: string;
  adName?: string;
  metaLeadId?: string;
}

export interface UpdateLeadInput {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  zoomPhoneNumber?: string;
  position?: string;
  folder?: string;
  source?: LeadSource;
  status?: LeadStatus;
  priority?: LeadPriority;
}

export interface AssignLeadInput {
  leadIds: string[];
  assignToUserId: string;
}

export interface AddNoteInput {
  leadId: string;
  content: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  message: string;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Dashboard Stats Types
export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  qualifiedLeads: number;
  salesDone: number;
  dnpLeads: number;
  conversionRate: number;
  averageResponseTime: number;
  leadsThisMonth: number;
  leadsGrowth: number;
  topPerformers: Array<{
    userId: string;
    userName: string;
    leadsAssigned: number;
    leadsConverted: number;
    conversionRate: number;
  }>;
  leadsBySource: Array<{
    source: LeadSource;
    count: number;
    percentage: number;
  }>;
  leadsByStatus: Array<{
    status: LeadStatus;
    count: number;
    percentage: number;
  }>;
  leadsByFolder: Array<{
    folder: string;
    count: number;
    percentage: number;
  }>;
  lastUpdated: string;
}

// Filter Types
export interface LeadFilters {
  status?: LeadStatus[];
  source?: LeadSource[];
  priority?: LeadPriority[];
  assignedTo?: string[];
  folder?: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  search?: string;
}

// Excel Import Types
export interface ExcelUploadResult {
  success: boolean;
  message: string;
  data: {
    totalRows: number;
    successfulImports: number;
    failedImports: number;
    errors: Array<{
      row: number;
      field: string;
      message: string;
    }>;
    leads: ILead[];
  };
}

export interface ExcelLeadRow {
  name?: string;
  email?: string;
  phone?: string;
  position?: string;
  folder?: string;
  source?: string;
  priority?: string;
}

// Dynamic Excel Import Types
export interface ExcelSheetInfo {
  name: string;
  rowCount: number;
  columnHeaders: string[];
  hasData: boolean;
}

export interface ExcelFileAnalysis {
  fileName: string;
  fileSize: number;
  sheets: ExcelSheetInfo[];
  uploadedAt: string;
}

export interface FieldMapping {
  leadField: string;
  excelColumn: string;
  isRequired: boolean;
  defaultValue?: string;
}

export interface NoteMapping {
  excelColumns: string[];
  isRequired: boolean;
}

export interface SheetPreviewData {
  headers: string[];
  sampleRows: any[][];
  totalRows: number;
}

export interface DynamicImportRequest {
  fileName: string;
  sheetName: string;
  fieldMappings: FieldMapping[];
  noteMappings: NoteMapping[];
  skipEmptyRows: boolean;
  startFromRow: number;
}

export interface ImportValidationResult {
  isValid: boolean;
  rowNumber: number;
  data: any;
  errors: Array<{
    field: string;
    message: string;
    value: any;
  }>;
}

// JWT Types
export interface JwtPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
  iat?: number;
  exp?: number;
}

// Request Extensions
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: 'admin' | 'user';
  };
}

// Pagination Options
export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

// Search Options
export interface SearchOptions {
  query?: string;
  fields?: string[];
}

// Environment Variables
export interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  MONGODB_URI: string;
  JWT_SECRET: string;
  JWT_EXPIRE: string;
  BCRYPT_ROUNDS: number;
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  UPLOAD_MAX_SIZE: number;
  UPLOAD_ALLOWED_TYPES: string[];
}

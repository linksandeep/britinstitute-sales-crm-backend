import mongoose from 'mongoose';
import Lead from '../models/Lead';
import DuplicateLead from '../models/DuplicateLead';
import User from '../models/User';
import { getCsvFromGoogleSheet } from '../utils/googleSheet';
import { applyLeadDateFilter } from '../utils/leadDateFilter';

export const importLeadsFromGoogleSheetService = async (sheetUrl: string) => {
  const rows = await getCsvFromGoogleSheet(sheetUrl);

  if (!rows || !rows.length) {
    const err: any = new Error('Google Sheet is empty');
    err.statusCode = 400;
    throw err;
  }

  console.log('📥 Total rows received:', rows.length);
  
  // Log headers for debugging
  console.log('CSV Headers:', Object.keys(rows[0] || {}));

  const requiredFields = ['name', 'email', 'phone'];

  let insertedCount = 0;
  let updatedCount = 0;
  const duplicateLeads: any[] = [];

  // Simple normalization function if yours isn't working
  const normalizeRow = (rawRow: any) => {
    const normalized: any = {};
    
    // Convert all keys to lowercase and trim
    for (const [key, value] of Object.entries(rawRow)) {
      const normalizedKey = key.toLowerCase().trim();
      normalized[normalizedKey] = value;
    }
    
    // Also handle common variations
    if (!normalized.name && normalized['full name']) {
      normalized.name = normalized['full name'];
    }
    if (!normalized.email && normalized['e-mail']) {
      normalized.email = normalized['e-mail'];
    }
    if (!normalized.phone && normalized['mobile']) {
      normalized.phone = normalized['mobile'];
    }
    if (!normalized.phone && normalized['telephone']) {
      normalized.phone = normalized['telephone'];
    }
    if (!normalized.assignedto && normalized['assigned to']) {
      normalized.assignedto = normalized['assigned to'];
    }
    if (!normalized.assignedto && normalized['assigned']) {
      normalized.assignedto = normalized['assigned'];
    }
    
    return normalized;
  };

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const rowNumber = i + 2;

    // Use the simple normalization function
    const row = normalizeRow(rawRow);
    
    // Debug logging
    console.log(`➡️ Processing row ${rowNumber}`);
    console.log('Normalized row:', row);

    //  Validate required fields - check if they exist and have value
    const missingFields = [];
    for (const field of requiredFields) {
      const fieldValue = row[field];
      if (!fieldValue || fieldValue.toString().trim() === '') {
        missingFields.push(field);
      }
    }
    
    if (missingFields.length > 0) {
      console.error(`❌ Missing fields at row ${rowNumber}:`, missingFields);
      console.error('Row data:', row);
      
      // Skip this row and continue with others
      console.log(`⏭️ Skipping row ${rowNumber} due to missing fields`);
      continue;
      
      // Or throw error if you want to stop the entire import:
      // const err: any = new Error(
      //   `Missing required fields "${missingFields.join(', ')}" at row ${rowNumber}`
      // );
      // err.statusCode = 400;
      // throw err;
    }

    const name = row.name.trim();
    const email = row.email.toLowerCase().trim();
    const phone = row.phone.toString().trim();
    const assignedToName = row.assignedto?.trim() || '';

    console.log('👤 Extracted:', { name, email, phone, assignedToName });

    //  Find existing lead
    const existingLead = await Lead.findOne({
      $or: [{ email }, { phone }]
    });

    console.log('🔍 existingLead:', existingLead?._id || 'NOT FOUND');

    //  Resolve assigned user
    let assignedUser = null;
    if (assignedToName && assignedToName !== '') {
      // Clean up the assignedToName (remove quotes, newlines, etc.)
      const cleanName = assignedToName.replace(/["'\n\r]/g, '').trim();
      
      if (cleanName) {
        assignedUser = await User.findOne({
          name: new RegExp(`^${cleanName}$`, 'i')
        }).select('_id');

        console.log('👥 Searching for user:', cleanName);
        console.log('👥 resolved user:', assignedUser?._id || 'NOT FOUND');
      }
    }

    const assignedUserId = assignedUser?._id
      ? new mongoose.Types.ObjectId(String(assignedUser._id))
      : null;

    console.log(' assignedUserId:', assignedUserId || 'NULL');

    // ─────────────────────────────────────────────
    //  CASE 1: NEW LEAD
    // ─────────────────────────────────────────────
    if (!existingLead) {
      const newLead = await Lead.create({
        name,
        email,
        phone,
        position: row.position || '',
        folder:"By Sheet",
        source: 'Import',
        status: 'New',
        priority: 'Medium',
        assignedTo: assignedUserId || undefined,
        assignmentHistory: assignedUserId
          ? [
              {
                assignedTo: assignedUserId,
                assignedBy: null,
                assignedAt: new Date(),
                source: 'Import'
              }
            ]
          : []
      });

      console.log(' New lead created:', newLead._id);

      insertedCount++;
      continue;
    }

    // ─────────────────────────────────────────────
    //  CASE 2: UPDATE EXISTING LEAD'S FOLDER TO "DUPLICATE"
    // ─────────────────────────────────────────────
    //  ADDED: Update folder to "duplicate" for existing lead
    if (existingLead) {
      // Update the existing lead's folder to "duplicate"
      existingLead.folder = 'duplicate';
      await existingLead.save();
      console.log('📁 Updated existing lead folder to "duplicate":', existingLead._id);
    }

    // ─────────────────────────────────────────────
    // CASE 3: EXISTING LEAD — ALREADY ASSIGNED
    // ─────────────────────────────────────────────
    if (existingLead.assignedTo) {
      console.log(' Lead already assigned, keeping same user');

      existingLead.assignmentHistory.push({
        assignedTo: existingLead.assignedTo as mongoose.Types.ObjectId,
        assignedBy: null,
        assignedAt: new Date(),
        source: 'Reimport'
      });

      await existingLead.save();
      updatedCount++;
      continue;
    }

    // ─────────────────────────────────────────────
    //  CASE 4: EXISTING BUT NOT ASSIGNED → ASSIGN
    // ─────────────────────────────────────────────
    if (!existingLead.assignedTo && assignedUserId) {
      console.log(' Assigning unassigned lead');

      //  IMPORTANT FIX (NO TS ERROR)
      existingLead.set('assignedTo', assignedUserId);

      existingLead.assignmentHistory.push({
        assignedTo: assignedUserId,
        assignedBy: null,
        assignedAt: new Date(),
        source: 'Import'
      });

      await existingLead.save();
      updatedCount++;
      continue;
    }

    // ─────────────────────────────────────────────
    // CASE 5: TRUE DUPLICATE → UPDATE DUPLICATE MODEL
    // ─────────────────────────────────────────────
    console.log('⚠️ Duplicate detected');

    let reason = 'EMAIL_PHONE_EXISTS';
    if (existingLead.email === email) reason = 'EMAIL_EXISTS';
    else if (existingLead.phone === phone) reason = 'PHONE_EXISTS';

    await DuplicateLead.findOneAndUpdate(
      { existingLeadId: existingLead._id },
      {
        originalData: row,
        reason,
        existingLeadId: existingLead._id
      },
      { upsert: true }
    );

    duplicateLeads.push({
      row: rowNumber,
      name,
      email,
      phone,
      reason
    });
    
    updatedCount++;
  }

  console.log(' Import Summary:', {
    insertedCount,
    updatedCount,
    duplicateCount: duplicateLeads.length
  });

  return {
    insertedCount,
    updatedCount,
    duplicateCount: duplicateLeads.length,
    duplicateLeads
  };
};



import type { AssignLeadInput } from '../types';

export const assignLeadsService = async (
  input: AssignLeadInput,
  performedByUserId: string
) => {
  const { leadIds, assignToUserId } = input;

  //  Validate leadIds
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    const err: any = new Error('Lead IDs are required');
    err.statusCode = 400;
    err.details = ['Please provide a non-empty array of lead IDs'];
    throw err;
  }

  //  Validate assignToUserId
  if (!assignToUserId) {
    const err: any = new Error('User ID is required');
    err.statusCode = 400;
    err.details = ['Please provide a user ID to assign leads to'];
    throw err;
  }

  //  Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(assignToUserId)) {
    const err: any = new Error('Invalid user ID');
    err.statusCode = 400;
    throw err;
  }

  //  Check if user exists
  const assignToUser = await User.findById(assignToUserId).select('_id');
  if (!assignToUser) {
    const err: any = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  //  Assign leads
  const result = await Lead.updateMany(
    { _id: { $in: leadIds } },
    {
      assignedTo: assignToUser._id,
      assignedBy: new mongoose.Types.ObjectId(performedByUserId),
      updatedAt: new Date()
    }
  );

  //  Fetch updated leads
  const updatedLeads = await Lead.find({ _id: { $in: leadIds } })
    .populate('assignedToUser', 'name email')
    .populate('assignedByUser', 'name email');

  return {
    modifiedCount: result.modifiedCount,
    leads: updatedLeads
  };
};




import { Request } from 'express';

interface GetLeadsResult {
  leads: any[];
  total: number;
}

export const getLeadsService = async (
  req: Request
): Promise<GetLeadsResult> => {
  const {
    page = 1,
    limit = 10,
    status,
    source,
    priority,
    assignedTo,
    folder,
    search
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const filter: any = {};

  // ---------------- ROLE BASED ACCESS ----------------
  if (req.user?.role !== 'admin') {
    filter.assignedTo = req.user?.userId;
  }

  // ---------------- EXISTING FILTERS ----------------
  if (status) {
    const statusArray = Array.isArray(status) ? status : [status];
    filter.status = { $in: statusArray };
  }

  if (source) {
    const sourceArray = Array.isArray(source) ? source : [source];
    filter.source = { $in: sourceArray };
  }

  if (priority) {
    const priorityArray = Array.isArray(priority) ? priority : [priority];
    filter.priority = { $in: priorityArray };
  }

  if (assignedTo && req.user?.role === 'admin') {
    const assignedToArray = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    const hasUnassigned = assignedToArray.some(id => [null, 'null', 'unassigned'].includes(id as any));
    const otherAssignees = assignedToArray.filter(id => ![null, 'null', 'unassigned'].includes(id as any));

    if (hasUnassigned && otherAssignees.length === 0) {
      filter.assignedTo = { $in: [null, undefined] };
    } else if (hasUnassigned && otherAssignees.length > 0) {
      filter.$or = [
        { assignedTo: { $in: [null, undefined] } },
        { assignedTo: { $in: otherAssignees } }
      ];
    } else {
      filter.assignedTo = { $in: assignedToArray };
    }
  }

  // ---------------- 📂 FOLDER FILTER (UPDATED) ----------------
  if (folder) {
    const folderArray = Array.isArray(folder) ? folder : [folder];

    // Check if 'Uncategorized' is requested
    const isUncategorizedSelected = folderArray.includes('Uncategorized');

    // ONLY add folder filters if 'Uncategorized' is NOT the selection.
    // If it is 'Uncategorized', we ignore this block entirely so the query returns ALL folders.
    if (!isUncategorizedSelected) {
      const hasEmpty = folderArray.some(f => ['', 'null', 'undefined'].includes(String(f)));
      const otherFolders = folderArray.filter(f => !['', 'null', 'undefined'].includes(String(f)));

      if (hasEmpty && otherFolders.length === 0) {
        filter.$or = [{ folder: '' }, { folder: { $exists: false } }, { folder: null }];
      } else if (hasEmpty && otherFolders.length > 0) {
        filter.$or = [
          { folder: '' },
          { folder: { $exists: false } },
          { folder: null },
          { folder: { $in: otherFolders } }
        ];
      } else {
        filter.folder = { $in: folderArray };
      }
    }
  }

  // ---------------- 🔍 SEARCH ----------------
  if (search && typeof search === 'string') {
    const searchText = search.trim();
    const searchConditions = [
      { name: { $regex: searchText, $options: 'i' } },
      { email: { $regex: searchText, $options: 'i' } },
      { $expr: { $eq: [{ $toString: '$phone' }, searchText] } }
    ];

    // If folder logic already created an $or, we must combine them safely
    if (filter.$or) {
      filter.$and = [
        { $or: filter.$or },
        { $or: searchConditions }
      ];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  // ---------------- 📅 DATE FILTER ----------------
  applyLeadDateFilter(filter, req.query as Record<string, unknown>);

  // Temporary debug block for API filter diagnostics.
  // Enable with DEBUG_LEADS_FILTER=true in backend .env
  if (process.env.DEBUG_LEADS_FILTER === 'true') {
    console.log('[LEADS_FILTER_DEBUG] requestContext=', {
      role: req.user?.role,
      userId: req.user?.userId,
      query: req.query,
      page: pageNum,
      limit: limitNum
    });
    console.log('[LEADS_FILTER_DEBUG] mongoFilter=', JSON.stringify(filter));
  }

  // ---------------- QUERY ----------------
  const [rawLeads, total] = await Promise.all([
    Lead.find(filter)
      .populate('assignedToUser', 'name email')
      .populate('assignedByUser', 'name email')
      .populate('assignmentHistory.assignedTo', 'name email')
      .populate('assignmentHistory.assignedBy', 'name email')
      .populate('notes.createdBy', 'name email')
      .sort({ createdAt: -1 }) // Newest leads first
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Lead.countDocuments(filter)
  ]);

  const leads = rawLeads.map((lead: any) => {
    const historyCount = lead.assignmentHistory?.length || 0;
    return {
      ...lead,
      assignmentCount: historyCount,
      wasAssignedInPast: historyCount > 1,
      lastAssignedAt: historyCount > 0 ? lead.assignmentHistory[historyCount - 1].assignedAt : null
    };
  });

  return { leads, total };
};



import { FilterQuery } from 'mongoose';
import { Chat } from '../models/chat';

interface GetDuplicateLeadsResult {
  leads: any[];
  total: number;
}

export const getDuplicateLeadsService = async (
  req: Request
): Promise<GetDuplicateLeadsResult> => {
  const { page = 1, limit = 10, search, dateRange } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const filter: FilterQuery<any> = {};

  // 🔒 role-based filter (kept as-is)
  if (req.user?.role !== 'admin') {
    filter.assignedTo = req.user?.userId;
  }

  // 🔍 search (kept as-is)
  if (search) {
    const regex = new RegExp(search as string, 'i');
    filter.$or = [
      { 'originalData.name': regex },
      { 'originalData.email': regex },
      { 'originalData.phone': regex }
    ];
  }

  // date range (kept as-is)
  if (dateRange) {
    const range =
      typeof dateRange === 'string'
        ? JSON.parse(dateRange)
        : dateRange;

    if (range?.from && range?.to) {
      filter.createdAt = {
        $gte: new Date(range.from),
        $lte: new Date(range.to)
      };
    }
  }

  // 👉 fetch duplicate records
  const duplicates = await DuplicateLead
    .find(filter)
    .sort({ createdAt: 1 } as any) // TS-safe
    .skip(skip)
    .limit(limitNum)
    .lean<any>();

  const total = await DuplicateLead.countDocuments(filter);

  /**
   *  NORMALIZE DUPLICATE → LEAD FORMAT
   * (THIS IS THE REQUIRED FIX)
   */
  const leads = duplicates.map((dup: any) => ({
    _id: dup._id,
    name: dup.originalData?.name || '',
    email: dup.originalData?.email || '',
    phone: dup.originalData?.phone || '',
    position: '',
    folder: 'Duplicate',
    source: 'Import',
    status: 'Duplicate',
    priority: 'Medium',
    leadScore: 0,
    notes: [],
    assignedTo: null,
    assignedByUser: null,
    assignedToUser: null,
    createdAt: dup.createdAt,
    updatedAt: dup.updatedAt
  }));
  

  return { leads, total };
};

interface LeadCountResult {
  duplicate: number;
  uncategorized: number;
}
export const getDuplicateAndUncategorizedCountService = async (
  req: Request
): Promise<LeadCountResult> => {
  const duplicateFilter: any = {};
  const uncategorizedFilter: any = {
    $or: [
      { folder: '' },
      { folder: null },
      { folder: { $exists: false } }
    ]
  };

  // 🔒 role-based restriction (same logic philosophy)
  if (req.user?.role !== 'admin') {
    duplicateFilter.assignedTo = req.user?.userId;
    uncategorizedFilter.assignedTo = req.user?.userId;
  }

  const [duplicateCount, uncategorizedCount] = await Promise.all([
    DuplicateLead.countDocuments(duplicateFilter),
    Lead.countDocuments(uncategorizedFilter)
  ]);

  return {
    duplicate: duplicateCount,
    uncategorized: uncategorizedCount
  };
};





export const getMyLeadsService = async (req: Request) => {
  const {
    page = 1,
    limit = 10,
    status,
    source,
    priority,
    folder,
    search
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  const filter: any = { assignedTo: req.user?.userId };

  /* ---------- filters (UNCHANGED) ---------- */
  if (status) {
    filter.status = { $in: Array.isArray(status) ? status : [status] };
  }

  if (source) {
    filter.source = { $in: Array.isArray(source) ? source : [source] };
  }

  if (priority) {
    filter.priority = { $in: Array.isArray(priority) ? priority : [priority] };
  }

  if (folder) {
    const folderArray = Array.isArray(folder) ? folder : [folder];
    const hasEmpty = folderArray.includes('Uncategorized');

    if (hasEmpty) {
      filter.$or = [
        { folder: '' },
        { folder: { $exists: false } },
        { folder: null }
      ];
    } else {
      filter.folder = { $in: folderArray };
    }
  }

  if (search) {
    const regex = new RegExp(search as string, 'i');
    const searchConditions = [
      { name: regex },
      { email: regex },
      { phone: regex },
      { position: regex }
    ];

    if (filter.$or) {
      filter.$and = [
        { $or: filter.$or },
        { $or: searchConditions }
      ];
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  applyLeadDateFilter(filter, req.query as Record<string, unknown>);

  /* ---------- QUERY ---------- */
  const [leads, total] = await Promise.all([
    Lead.find(filter)
      .populate('assignedByUser', 'name email')
      .populate('notes.createdBy', 'name email')
      .populate('assignmentHistory.assignedTo', 'name email')   //  NEW
      .populate('assignmentHistory.assignedBy', 'name email')   //  NEW
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Lead.countDocuments(filter)
  ]);

  /* ---------- ADD FLAGS (SAFE, NON-BREAKING) ---------- */
  const enrichedLeads = leads.map((lead: any) => ({
    ...lead,
    assignmentCount: lead.assignmentHistory?.length || 0,
    wasAssignedInPast: (lead.assignmentHistory?.length || 0) > 1
  }));

  return {
    leads: enrichedLeads,
    total,
    page: pageNum,
    limit: limitNum
  };
};




interface SearchLeadsResult {
  leads: any[];
  total: number;
}

export const searchLeadsService = async (
  req: Request
): Promise<SearchLeadsResult> => {
  const { q } = req.query;

  if (!q || typeof q !== 'string') {
    return { leads: [], total: 0 };
  }

  const searchText = q.trim();
  const normalizedPhone = searchText.replace(/\D/g, '');

  const filter: any = {};

  /* =======================
     ROLE BASED ACCESS (RBC)
  ======================= */
  if (req.user?.role !== 'admin') {
    filter.assignedTo = req.user?.userId;
  }

  /* =======================
     SEARCH CONDITIONS
  ======================= */
  const orConditions: any[] = [
    { name: { $regex: searchText, $options: 'i' } },
    { email: { $regex: searchText, $options: 'i' } }
  ];

  // ✅ Phone search (number-safe)
  if (normalizedPhone.length >= 4) {
    // exact match (FAST)
    orConditions.push({ phone: Number(normalizedPhone) });
  }

  filter.$or = orConditions;

  const [rawLeads, total] = await Promise.all([
    Lead.find(filter)
      .populate('assignedToUser', 'name email')
      .populate('assignedByUser', 'name email')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Lead.countDocuments(filter)
  ]);

  const leads = rawLeads.map((lead: any) => {
    const historyCount = lead.assignmentHistory?.length || 0;

    return {
      ...lead,
      assignmentCount: historyCount,
      wasAssignedInPast: historyCount > 1,
      lastAssignedAt:
        historyCount > 0
          ? lead.assignmentHistory[historyCount - 1].assignedAt
          : null
    };
  });

  return { leads, total };
};


export const getAllChatsService = async (req: Request) => {
  const {
    page = 1,
    limit = 50,
    phone,
    platform,
    search
  } = req.query;

  const pageNum = parseInt(page as string, 10);
  const limitNum = parseInt(limit as string, 10);
  const skip = (pageNum - 1) * limitNum;

  // Initialize filter (Admin sees everything, so filter starts empty)
  const filter: any = {};

  // Filter by specific phone number
  if (phone) {
    filter.phone = phone;
  }

  // Filter by platform (whatsapp, web, etc.)
  if (platform) {
    filter['metadata.platform'] = platform;
  }

  // Search within the message content or username
  if (search) {
    const regex = new RegExp(search as string, 'i');
    filter.$or = [
      { content: regex },
      { userName: regex },
      { phone: regex }
    ];
  }

  /* ---------- QUERY ---------- */
  const [chats, total] = await Promise.all([
    Chat.find(filter)
      .sort({ timestamp: -1 }) // Newest messages first
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Chat.countDocuments(filter)
  ]);

  return {
    chats,
    total,
    page: pageNum,
    limit: limitNum
  };
};



import moment from 'moment';

export const getAdminLeadStatsService = async (query: any) => {
  const { startDate, endDate, period = 'day' } = query;

  // 1. Define Date Range
  const start = startDate ? new Date(startDate as string) : moment().startOf('month').toDate();
  const end = endDate ? new Date(endDate as string) : new Date();

  // 2. Base Filter
  const matchFilter = {
    createdAt: { $gte: start, $lte: end }
  };

  // 3. Overall Counts (Today, Week, Month, Year)
  const [counts] = await Lead.aggregate([
    {
      $facet: {
        today: [
          { $match: { createdAt: { $gte: moment().startOf('day').toDate() } } },
          { $count: 'count' }
        ],
        thisWeek: [
          { $match: { createdAt: { $gte: moment().startOf('week').toDate() } } },
          { $count: 'count' }
        ],
        thisMonth: [
          { $match: { createdAt: { $gte: moment().startOf('month').toDate() } } },
          { $count: 'count' }
        ],
        thisYear: [
          { $match: { createdAt: { $gte: moment().startOf('year').toDate() } } },
          { $count: 'count' }
        ],
        totalInRange: [
          { $match: matchFilter },
          { $count: 'count' }
        ]
      }
    }
  ]);

  // 4. Time-based Breakdown (The trend logic)
  let groupingId: any = {};
  if (period === 'month') {
    groupingId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };
  } else if (period === 'week') {
    groupingId = { year: { $year: '$createdAt' }, week: { $week: '$createdAt' } };
  } else {
    groupingId = { year: { $year: '$createdAt' }, month: { $month: '$createdAt' }, day: { $dayOfMonth: '$createdAt' } };
  }

  const trend = await Lead.aggregate([
    { $match: matchFilter },
    {
      $group: {
        _id: groupingId,
        count: { $sum: 1 },
        date: { $first: '$createdAt' }
      }
    },
    { $sort: { 'date': 1 } },
    {
      $project: {
        _id: 0,
        count: 1,
        periodLabel: period === 'week' ? { $concat: ["Week ", { $toString: "$_id.week" }] } : "$date",
        // This gives you the readable range like "1 Jan 2024"
        formattedDate: { $dateToString: { format: "%d %b %Y", date: "$date" } }
      }
    }
  ]);

  return {
    summary: {
      today: counts.today[0]?.count || 0,
      thisWeek: counts.thisWeek[0]?.count || 0,
      thisMonth: counts.thisMonth[0]?.count || 0,
      thisYear: counts.thisYear[0]?.count || 0,
      totalInRange: counts.totalInRange[0]?.count || 0
    },
    trend
  };
};

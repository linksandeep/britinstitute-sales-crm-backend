import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Attendance } from '../models/attendance.model';
import { EmployeeDocument } from '../models/EmployeeDocument.model';
import Lead from '../models/Lead';
import { Leave } from '../models/Leave';
import { EmployeeLeaveBalance, Salary } from '../models/leaveAndPay';
import Reminder from '../models/reminder';
import User from '../models/User';
import ZoomPhoneNumberAssignment from '../models/ZoomPhoneNumberAssignment';
import { connectDatabase, disconnectDatabase } from '../utils/database';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const target = process.argv
  .find((argument) => argument.startsWith('--target='))
  ?.slice('--target='.length)
  .trim();
const BACKUP_DIRECTORY = path.resolve(process.cwd(), 'backups', 'user-removal');

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const findOneTargetUser = async (value: string) => {
  const exactPattern = new RegExp(`^${escapeRegex(value)}$`, 'i');
  let users = await User.find({
    $or: [{ name: exactPattern }, { email: exactPattern }]
  }).select('+password').lean();
  let matchMode = 'exact name or email';

  if (users.length === 0) {
    users = await User.find({ name: new RegExp(escapeRegex(value), 'i') })
      .select('+password')
      .lean();
    matchMode = 'partial name';
  }

  if (users.length !== 1) {
    const candidates = users.map((user) => `${user.name} <${user.email}>`).join(', ') || 'none';
    throw new Error(`Expected exactly one CRM user for "${value}"; found ${users.length}: ${candidates}`);
  }

  const user = users[0]!;
  if (user.email === 'system@leadmanager.com' || user.email === 'owner@leadmanager.com') {
    throw new Error(`Refusing to remove protected CRM account ${user.email}`);
  }

  return { user, matchMode };
};

const run = async (): Promise<void> => {
  if (!target) throw new Error('Pass the CRM user name or email with --target=<value>');

  await connectDatabase();
  const { user, matchMode } = await findOneTargetUser(target);
  const userId = user._id;

  const [
    assignedLeads,
    leadsAssignedByUser,
    reminders,
    zoomAssignments,
    attendance,
    ownedLeaves,
    approvedLeaves,
    employeeDocuments,
    employeeDocumentReferences,
    salaries,
    salaryReferences,
    leaveBalances,
    totalLeadCountBefore
  ] = await Promise.all([
    Lead.find({ assignedTo: userId }).lean(),
    Lead.find({ assignedBy: userId }).lean(),
    Reminder.find({ user: userId }).lean(),
    ZoomPhoneNumberAssignment.find({ crmUser: userId }).lean(),
    Attendance.find({ user: userId }).lean(),
    Leave.find({ user: userId }).lean(),
    Leave.find({ approvedBy: userId }).lean(),
    EmployeeDocument.find({ user: userId }).lean(),
    EmployeeDocument.find({
      $or: [
        { 'employmentDetails.reportingTo': userId },
        { 'documents.verifiedBy': userId },
        { 'employmentDetails.employmentHistory.verifiedBy': userId },
        { 'bankDetails.verifiedBy': userId }
      ]
    }).lean(),
    Salary.find({ user: userId }).lean(),
    Salary.find({
      $or: [{ updatedBy: userId }, { 'revisionHistory.updatedBy': userId }]
    }).lean(),
    EmployeeLeaveBalance.find({ user: userId }).lean(),
    Lead.countDocuments()
  ]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(BACKUP_DIRECTORY, `crm-user-${String(user._id)}-${timestamp}.json`);
  const audit: Record<string, unknown> = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    target,
    matchMode,
    action: 'Unassign leads, delete user-owned reminders and Zoom mappings, then delete the CRM user. HR/history records are retained.',
    user,
    counts: {
      assignedLeads: assignedLeads.length,
      leadsAssignedByUser: leadsAssignedByUser.length,
      remindersToDelete: reminders.length,
      zoomAssignmentsToDelete: zoomAssignments.length,
      retainedAttendance: attendance.length,
      retainedOwnedLeaves: ownedLeaves.length,
      retainedApprovedLeaves: approvedLeaves.length,
      retainedEmployeeDocuments: employeeDocuments.length,
      retainedEmployeeDocumentReferences: employeeDocumentReferences.length,
      retainedSalaries: salaries.length,
      retainedSalaryReferences: salaryReferences.length,
      retainedLeaveBalances: leaveBalances.length,
      totalLeadCountBefore
    },
    backup: {
      assignedLeads,
      leadsAssignedByUser,
      reminders,
      zoomAssignments,
      retainedHrAndHistoricalRecords: {
        attendance,
        ownedLeaves,
        approvedLeaves,
        employeeDocuments,
        employeeDocumentReferences,
        salaries,
        salaryReferences,
        leaveBalances
      }
    },
    result: { status: APPLY ? 'pending' : 'not-applied' }
  };

  await mkdir(BACKUP_DIRECTORY, { recursive: true });
  await writeFile(backupPath, `${JSON.stringify(audit, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });

  const persistedAudit = JSON.parse(await readFile(backupPath, 'utf8')) as Record<string, any>;
  if (
    String(persistedAudit.user?._id) !== String(userId) ||
    persistedAudit.counts?.assignedLeads !== assignedLeads.length
  ) {
    throw new Error('Backup validation failed; no database changes were made');
  }

  console.log(`Matched ${user.name} <${user.email}> (${user._id}) by ${matchMode}.`);
  console.log(`Assigned leads to unassign: ${assignedLeads.length}.`);
  console.log(`User reminders to delete: ${reminders.length}.`);
  console.log(`Zoom mappings to delete: ${zoomAssignments.length}.`);
  console.log(`Backup and audit: ${backupPath}`);

  if (!APPLY) {
    console.log('Dry run only. Re-run with --apply after validating this backup.');
    return;
  }

  const session = await mongoose.startSession();
  let unassignedLeadCount = 0;
  let deletedReminderCount = 0;
  let deletedZoomAssignmentCount = 0;
  let deletedUserCount = 0;
  try {
    await session.withTransaction(async () => {
      const leadResult = await Lead.updateMany(
        { assignedTo: userId },
        { $unset: { assignedTo: 1 } },
        { session }
      );
      const reminderResult = await Reminder.deleteMany({ user: userId }, { session });
      const zoomResult = await ZoomPhoneNumberAssignment.deleteMany({ crmUser: userId }, { session });
      const userResult = await User.deleteOne({ _id: userId }, { session });

      unassignedLeadCount = leadResult.modifiedCount;
      deletedReminderCount = reminderResult.deletedCount;
      deletedZoomAssignmentCount = zoomResult.deletedCount;
      deletedUserCount = userResult.deletedCount;

      if (deletedUserCount !== 1) throw new Error('The target CRM user was not deleted');
    });
  } finally {
    await session.endSession();
  }

  const [remainingUserCount, remainingAssignedLeadCount, remainingReminderCount, remainingZoomCount, totalLeadCountAfter] =
    await Promise.all([
      User.countDocuments({ _id: userId }),
      Lead.countDocuments({ assignedTo: userId }),
      Reminder.countDocuments({ user: userId }),
      ZoomPhoneNumberAssignment.countDocuments({ crmUser: userId }),
      Lead.countDocuments()
    ]);

  const verified =
    remainingUserCount === 0 &&
    remainingAssignedLeadCount === 0 &&
    remainingReminderCount === 0 &&
    remainingZoomCount === 0 &&
    totalLeadCountAfter === totalLeadCountBefore;

  audit.result = {
    status: verified ? 'completed' : 'verification-failed',
    completedAt: new Date().toISOString(),
    unassignedLeadCount,
    deletedReminderCount,
    deletedZoomAssignmentCount,
    deletedUserCount,
    totalLeadCountAfter,
    remainingUserCount,
    remainingAssignedLeadCount,
    remainingReminderCount,
    remainingZoomCount
  };
  await writeFile(backupPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');

  if (!verified) throw new Error('Post-removal verification failed; inspect the backup audit result');
  console.log(`Removed ${user.email} and unassigned ${unassignedLeadCount} leads; verification passed.`);
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

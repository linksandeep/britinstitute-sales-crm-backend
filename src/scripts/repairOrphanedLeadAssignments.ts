import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import User from '../models/User';
import connectDatabase from '../utils/database';

dotenv.config();

const repairOrphanedLeadAssignments = async () => {
  try {
    await connectDatabase();

    const existingUserIds = await User.distinct('_id');
    const result = await Lead.updateMany(
      {
        assignedTo: {
          $exists: true,
          $ne: null,
          $nin: existingUserIds
        }
      },
      { $unset: { assignedTo: 1 } }
    );

    console.log(`Unassigned ${result.modifiedCount} leads that referenced deleted users.`);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
};

repairOrphanedLeadAssignments().catch((error: unknown) => {
  console.error('Failed to repair orphaned lead assignments:', error);
  process.exitCode = 1;
});

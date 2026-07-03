import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User';
import { connectDatabase, disconnectDatabase } from '../utils/database';

dotenv.config();

const RAVIKANT_USER_ID = '69e5faadee0e9f8ca40ba3e7';
const RAVIKANT_EMAIL = 'ravikant@britinstitute.uk';
const RAVIKANT_PHONE = '+44 7447 177947';

const run = async () => {
  await connectDatabase();

  const result = await User.findOneAndUpdate(
    {
      _id: new mongoose.Types.ObjectId(RAVIKANT_USER_ID),
      email: RAVIKANT_EMAIL
    },
    {
      $set: {
        phone: RAVIKANT_PHONE
      }
    },
    {
      new: true,
      runValidators: true
    }
  ).select('name email phone');

  if (!result) {
    throw new Error('Ravikant user was not found with the expected ID and email');
  }

  console.log(`Updated ${result.email} phone to ${result.phone}`);
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

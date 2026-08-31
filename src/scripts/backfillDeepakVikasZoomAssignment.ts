import dotenv from 'dotenv';
import User from '../models/User';
import ZoomPhoneNumberAssignment from '../models/ZoomPhoneNumberAssignment';
import { zoomPhoneService, normalizePhoneNumber, type ZoomPhoneInventoryResponse, type ZoomPhoneUser } from '../service/zoomPhone.service';
import { connectDatabase, disconnectDatabase } from '../utils/database';

dotenv.config();

const PREVIOUS_USER_EMAIL = 'deepak@britinstitute.uk';
const CURRENT_USER_EMAILS = ['vikas@britinstitute.uk', 'vikash@britinstitute.uk'];
const HANDOVER_AT = new Date('2026-07-26T00:00:00.000Z');

const findUserByEmail = async (emails: string[]) => {
  const normalizedEmails = emails.map((email) => email.toLowerCase());
  return User.findOne({ email: { $in: normalizedEmails } }).select('_id name email phone createdAt').lean();
};

const getInventoryNumberDetails = (phoneUser: ZoomPhoneUser, inventory: ZoomPhoneInventoryResponse) => {
  const directNumbers = (phoneUser.phone_numbers || []).map((phoneNumber) => ({
    displayNumber: phoneNumber.display_number || phoneNumber.number || '',
    zoomNumberId: phoneNumber.id
  }));
  const assignedNumbers = inventory.phone_numbers
    .filter((phoneNumber) => {
      const assignee = phoneNumber.assignee;
      if (!assignee) return false;
      return (
        assignee.id === phoneUser.id ||
        assignee.id === phoneUser.phone_user_id ||
        assignee.extension_number === phoneUser.extension_number ||
        assignee.name === phoneUser.name
      );
    })
    .map((phoneNumber) => ({
      displayNumber: phoneNumber.display_number || phoneNumber.number || '',
      zoomNumberId: phoneNumber.id
    }));

  const byNumber = new Map<string, { normalizedNumber: string; displayNumber: string; zoomNumberId?: string }>();
  [...directNumbers, ...assignedNumbers].forEach((item) => {
    const normalizedNumber = normalizePhoneNumber(item.displayNumber);
    if (!normalizedNumber || byNumber.has(normalizedNumber)) return;
    const detail: { normalizedNumber: string; displayNumber: string; zoomNumberId?: string } = {
      normalizedNumber,
      displayNumber: item.displayNumber
    };
    if (item.zoomNumberId) detail.zoomNumberId = item.zoomNumberId;
    byNumber.set(normalizedNumber, detail);
  });

  return Array.from(byNumber.values());
};

const findCurrentZoomNumbers = async (currentEmail: string, currentUserPhone?: string) => {
  const inventory = await zoomPhoneService.getAccountInventory({ pageSize: 300, maxPages: 5 });
  const phoneUser = inventory.users.find((user) => user.email?.toLowerCase() === currentEmail.toLowerCase());
  const zoomNumbers = phoneUser ? getInventoryNumberDetails(phoneUser, inventory) : [];
  const fallbackNumber = normalizePhoneNumber(currentUserPhone);

  if (zoomNumbers.length > 0 || !fallbackNumber) return zoomNumbers;

  return [
    {
      normalizedNumber: fallbackNumber,
      displayNumber: currentUserPhone || fallbackNumber
    }
  ];
};

const run = async () => {
  await connectDatabase();

  const [previousUser, currentUser] = await Promise.all([
    findUserByEmail([PREVIOUS_USER_EMAIL]),
    findUserByEmail(CURRENT_USER_EMAILS)
  ]);

  if (!previousUser) {
    throw new Error(`CRM user not found for ${PREVIOUS_USER_EMAIL}`);
  }

  if (!currentUser) {
    throw new Error(`CRM user not found for ${CURRENT_USER_EMAILS.join(' or ')}`);
  }

  const numbers = await findCurrentZoomNumbers(currentUser.email, currentUser.phone);
  if (numbers.length === 0) {
    throw new Error(`No Zoom/CRM phone number found for ${currentUser.email}`);
  }

  const previousAssignedAt =
    previousUser.createdAt && previousUser.createdAt < HANDOVER_AT
      ? previousUser.createdAt
      : new Date('2020-01-01T00:00:00.000Z');

  for (const number of numbers) {
    await ZoomPhoneNumberAssignment.updateMany(
      {
        normalizedNumber: number.normalizedNumber,
        crmUser: { $nin: [previousUser._id, currentUser._id] },
        releasedAt: { $exists: false }
      },
      { $set: { releasedAt: HANDOVER_AT } }
    );

    await ZoomPhoneNumberAssignment.findOneAndUpdate(
      {
        normalizedNumber: number.normalizedNumber,
        crmUser: previousUser._id,
        releasedAt: HANDOVER_AT
      },
      {
        $setOnInsert: {
          normalizedNumber: number.normalizedNumber,
          assignedAt: previousAssignedAt,
          releasedAt: HANDOVER_AT,
          source: 'crm_backfill'
        },
        $set: {
          displayNumber: number.displayNumber,
          zoomNumberId: number.zoomNumberId,
          crmUserEmail: previousUser.email.toLowerCase(),
          crmUserName: previousUser.name
        }
      },
      { upsert: true, new: true }
    );

    await ZoomPhoneNumberAssignment.updateMany(
      {
        normalizedNumber: number.normalizedNumber,
        crmUser: previousUser._id,
        releasedAt: { $exists: false }
      },
      { $set: { releasedAt: HANDOVER_AT } }
    );

    await ZoomPhoneNumberAssignment.findOneAndUpdate(
      {
        normalizedNumber: number.normalizedNumber,
        crmUser: currentUser._id,
        releasedAt: { $exists: false }
      },
      {
        $setOnInsert: {
          normalizedNumber: number.normalizedNumber,
          source: 'zoom_inventory'
        },
        $set: {
          displayNumber: number.displayNumber,
          zoomNumberId: number.zoomNumberId,
          crmUserEmail: currentUser.email.toLowerCase(),
          crmUserName: currentUser.name,
          assignedAt: HANDOVER_AT
        },
        $unset: {
          releasedAt: ''
        }
      },
      { upsert: true, new: true }
    );

    console.log(
      `Updated ${number.displayNumber}: ${previousUser.email} before ${HANDOVER_AT.toISOString()}, ${currentUser.email} from ${HANDOVER_AT.toISOString()}`
    );
  }
};

run()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });

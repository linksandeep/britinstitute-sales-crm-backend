import mongoose from 'mongoose';
import Lead from '../models/Lead';
import User from '../models/User';
import type { ILead, MakeMetaLeadInput, MetaFeedbackPayload } from '../types';

export type MakeMetaUpsertOutcome = 'created' | 'linked' | 'duplicate';

export interface MakeMetaUpsertResult {
  outcome: MakeMetaUpsertOutcome;
  lead: ILead;
}

export interface MetaFeedbackResult {
  sent: boolean;
  skipped: boolean;
  error?: string;
}

const stringValue = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';

const getFieldDataValue = (body: Record<string, unknown>, candidates: string[]): string => {
  const fieldData = body.fieldData || body.field_data;
  if (!Array.isArray(fieldData)) return '';

  const candidateSet = new Set(candidates.map((candidate) => candidate.toLowerCase()));
  for (const item of fieldData) {
    if (!item || typeof item !== 'object') continue;
    const field = item as Record<string, unknown>;
    if (!candidateSet.has(stringValue(field.name).toLowerCase())) continue;

    if (Array.isArray(field.values)) {
      const matchedValue = field.values.map(stringValue).find(Boolean);
      if (matchedValue) return matchedValue;
    }

    const value = stringValue(field.value);
    if (value) return value;
  }

  return '';
};

const firstValue = (body: Record<string, unknown>, candidates: string[]): string => {
  for (const candidate of candidates) {
    const value = stringValue(body[candidate]);
    if (value) return value;
  }
  return getFieldDataValue(body, candidates);
};

const optionalString = (value: string): string | undefined => value || undefined;

const normalizePhone = (value: string): string =>
  value.replace(/[^\d+\-().\s]/g, '').replace(/\s+/g, ' ').trim();

const parseMetaCreatedTime = (value: string): Date | undefined => {
  if (!value) return undefined;

  const numericValue = Number(value);
  const parsed = Number.isFinite(numericValue)
    ? new Date(numericValue < 10_000_000_000 ? numericValue * 1000 : numericValue)
    : new Date(value);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const normalizeMakeMetaLeadInput = (body: Record<string, unknown>): MakeMetaLeadInput => {
  const firstName = firstValue(body, ['firstName', 'first_name']);
  const lastName = firstValue(body, ['lastName', 'last_name']);
  const suppliedName = firstValue(body, ['name', 'fullName', 'full_name']);

  const result: MakeMetaLeadInput = {
    metaLeadId: firstValue(body, ['metaLeadId', 'leadId', 'lead_id', 'leadgenId', 'leadgen_id', 'id']),
    name: suppliedName || [firstName, lastName].filter(Boolean).join(' '),
    email: firstValue(body, ['email']).toLowerCase(),
    phone: normalizePhone(firstValue(body, ['phone', 'phoneNumber', 'phone_number'])),
  };

  const optionalValues: Array<[keyof MakeMetaLeadInput, string | undefined]> = [
    ['whatsapp', optionalString(normalizePhone(firstValue(body, ['whatsapp', 'whatsApp'])))],
    ['position', optionalString(firstValue(body, ['position', 'jobTitle', 'job_title']))],
    ['folder', optionalString(firstValue(body, ['folder']))],
    ['campaignName', optionalString(firstValue(body, ['campaignName', 'campaign_name']))],
    ['adsetName', optionalString(firstValue(body, ['adsetName', 'adSetName', 'adset_name']))],
    ['adName', optionalString(firstValue(body, ['adName', 'ad_name']))],
    ['formId', optionalString(firstValue(body, ['formId', 'form_id']))],
    ['pageId', optionalString(firstValue(body, ['pageId', 'page_id']))],
    ['adId', optionalString(firstValue(body, ['adId', 'ad_id']))],
    ['createdTime', optionalString(firstValue(body, ['createdTime', 'created_time']))],
  ];

  optionalValues.forEach(([key, value]) => {
    if (value !== undefined) {
      (result as unknown as Record<string, unknown>)[key] = value;
    }
  });

  return result;
};

const getSystemUserId = async (): Promise<mongoose.Types.ObjectId | undefined> => {
  const systemUser = await User.findOne({ email: 'system@leadmanager.com' }).select('_id');
  return systemUser?._id ? new mongoose.Types.ObjectId(String(systemUser._id)) : undefined;
};

const buildAuditNote = (leadData: MakeMetaLeadInput): string => [
  'Meta lead received through Make.',
  `Lead ID: ${leadData.metaLeadId}`,
  leadData.formId ? `Form ID: ${leadData.formId}` : '',
  leadData.pageId ? `Page ID: ${leadData.pageId}` : '',
  leadData.adId ? `Ad ID: ${leadData.adId}` : '',
  leadData.createdTime ? `Meta created: ${leadData.createdTime}` : '',
].filter(Boolean).join(' ');

const applyMetaData = (lead: ILead, leadData: MakeMetaLeadInput): void => {
  lead.metaLeadId = leadData.metaLeadId;
  lead.source = 'Meta';
  lead.folder = lead.folder || leadData.folder || 'Meta Lead Ads';
  lead.campaignName = leadData.campaignName || lead.campaignName || '';
  lead.adsetName = leadData.adsetName || lead.adsetName || '';
  lead.adName = leadData.adName || lead.adName || '';
  lead.metaFormId = leadData.formId || lead.metaFormId || '';
  lead.metaPageId = leadData.pageId || lead.metaPageId || '';
  lead.metaAdId = leadData.adId || lead.metaAdId || '';

  const metaCreatedTime = parseMetaCreatedTime(leadData.createdTime || '');
  if (metaCreatedTime) lead.metaCreatedTime = metaCreatedTime;
};

export const upsertMakeMetaLead = async (leadData: MakeMetaLeadInput): Promise<MakeMetaUpsertResult> => {
  const existingByMetaId = await Lead.findOne({ metaLeadId: leadData.metaLeadId });
  if (existingByMetaId) {
    return { outcome: 'duplicate', lead: existingByMetaId };
  }

  const existingByContact = await Lead.findOne({
    $or: [{ email: leadData.email }, { phone: leadData.phone }],
  });
  const systemUserId = await getSystemUserId();

  if (existingByContact) {
    applyMetaData(existingByContact, leadData);

    if (systemUserId) {
      existingByContact.notes.push({
        id: new mongoose.Types.ObjectId().toString(),
        content: buildAuditNote(leadData),
        createdBy: systemUserId,
        createdAt: new Date(),
      });
    }

    await existingByContact.save({ validateModifiedOnly: true });
    return { outcome: 'linked', lead: existingByContact };
  }

  const lead = new Lead({
    name: leadData.name,
    email: leadData.email,
    phone: leadData.phone,
    whatsapp: leadData.whatsapp || leadData.phone,
    position: leadData.position || '',
    folder: leadData.folder || 'Meta Lead Ads',
    source: 'Meta',
    status: 'New',
    priority: 'Medium',
    campaignName: leadData.campaignName || '',
    adsetName: leadData.adsetName || '',
    adName: leadData.adName || '',
    metaLeadId: leadData.metaLeadId,
    metaFormId: leadData.formId || '',
    metaPageId: leadData.pageId || '',
    metaAdId: leadData.adId || '',
    metaCreatedTime: parseMetaCreatedTime(leadData.createdTime || ''),
    assignedBy: systemUserId,
  });

  if (systemUserId) {
    lead.notes.push({
      id: new mongoose.Types.ObjectId().toString(),
      content: buildAuditNote(leadData),
      createdBy: systemUserId,
      createdAt: new Date(),
    });
  }

  await lead.save();
  return { outcome: 'created', lead };
};

export const buildMetaFeedbackPayload = (
  lead: ILead,
  previousStatus?: string,
  eventTime: Date = new Date()
): MetaFeedbackPayload => {
  const payload: MetaFeedbackPayload = {
    eventName: lead.status,
    eventTime: Math.floor(eventTime.getTime() / 1000),
    leadId: lead.metaLeadId || '',
    email: lead.email,
    phoneNumber: lead.phone.replace(/\D/g, ''),
    leadEventSource: process.env.MAKE_META_LEAD_EVENT_SOURCE || 'Lead Manager CRM',
    crmLeadId: String(lead._id),
    status: lead.status,
  };

  if (previousStatus) payload.previousStatus = previousStatus;
  if (lead.campaignName) payload.campaignName = lead.campaignName;
  if (lead.adsetName) payload.adsetName = lead.adsetName;
  if (lead.adName) payload.adName = lead.adName;

  return payload;
};

const saveFeedbackResult = async (lead: ILead, error?: string): Promise<void> => {
  const sentAt = new Date();
  const update = error
    ? { metaFeedbackLastError: error }
    : {
        metaFeedbackLastStatus: lead.status,
        metaFeedbackLastSentAt: sentAt,
        metaFeedbackLastError: '',
      };

  await Lead.updateOne({ _id: lead._id }, { $set: update });

  if (error) {
    lead.metaFeedbackLastError = error;
  } else {
    lead.metaFeedbackLastStatus = lead.status;
    lead.metaFeedbackLastSentAt = sentAt;
    lead.metaFeedbackLastError = '';
  }
};

export const sendMetaStatusFeedback = async (
  lead: ILead,
  previousStatus?: string,
  eventTime?: Date
): Promise<MetaFeedbackResult> => {
  if (!lead.metaLeadId) return { sent: false, skipped: true };

  const webhookUrl = process.env.MAKE_META_FEEDBACK_WEBHOOK_URL?.trim();
  if (!webhookUrl) return { sent: false, skipped: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const webhookApiKey = process.env.MAKE_META_FEEDBACK_API_KEY?.trim();
    if (webhookApiKey) headers['x-make-apikey'] = webhookApiKey;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildMetaFeedbackPayload(lead, previousStatus, eventTime)),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Make feedback webhook returned HTTP ${response.status}`);
    }

    await saveFeedbackResult(lead);
    return { sent: true, skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Make feedback webhook error';
    console.error('Meta feedback delivery failed:', message);
    await saveFeedbackResult(lead, message).catch((saveError) => {
      console.error('Meta feedback error state could not be saved:', saveError);
    });
    return { sent: false, skipped: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
};

import type { Request, Response } from 'express';
import Lead from '../models/Lead';
import {
  normalizeMakeMetaLeadInput,
  sendMetaStatusFeedback,
  upsertMakeMetaLead,
} from '../service/makeMeta.service';

export const receiveMakeMetaLead = async (req: Request, res: Response): Promise<void> => {
  try {
    const leadData = normalizeMakeMetaLeadInput(req.body as Record<string, unknown>);
    const errors: string[] = [];

    if (!leadData.metaLeadId) errors.push('metaLeadId is required');

    if (errors.length > 0) {
      res.status(422).json({
        success: false,
        message: 'Invalid Meta lead payload',
        errors,
      });
      return;
    }

    const result = await upsertMakeMetaLead(leadData);
    const shouldSendFeedback = result.outcome !== 'duplicate';
    const initialEventTime = result.lead.metaCreatedTime || result.lead.createdAt;
    const feedback = shouldSendFeedback
      ? await sendMetaStatusFeedback(result.lead, undefined, initialEventTime)
      : { sent: false, skipped: true };

    res.status(result.outcome === 'created' ? 201 : 200).json({
      success: true,
      message: result.outcome === 'created'
        ? 'Meta lead created successfully'
        : result.outcome === 'linked'
          ? 'Meta lead linked to an existing CRM lead'
          : 'Meta lead was already processed',
      data: {
        outcome: result.outcome,
        lead: result.lead,
        feedback,
      },
    });
  } catch (error: unknown) {
    const mongoError = error as { code?: number; keyValue?: Record<string, unknown> };
    if (mongoError.code === 11000) {
      const leadData = normalizeMakeMetaLeadInput(req.body as Record<string, unknown>);
      const existingLead = await Lead.findOne({
        $or: [
          { metaLeadId: leadData.metaLeadId },
          { email: leadData.email },
          { phone: leadData.phone },
        ],
      });

      res.status(200).json({
        success: true,
        message: 'Meta lead was already processed',
        data: {
          outcome: 'duplicate',
          lead: existingLead,
          feedback: { sent: false, skipped: true },
        },
      });
      return;
    }

    console.error('Make Meta lead ingestion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process Meta lead',
      errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
    });
  }
};

import assert from 'node:assert/strict';
import test from 'node:test';
import type { ILead } from '../types';
import { buildMetaFeedbackPayload, normalizeMakeMetaLeadInput } from './makeMeta.service';

test('normalizes Make and Meta aliases into the CRM lead contract', () => {
  const lead = normalizeMakeMetaLeadInput({
    lead_id: 123456789012345,
    full_name: '  Test Person  ',
    email: ' TEST@EXAMPLE.COM ',
    phone_number: '+91 98765 43210',
    campaign_name: 'Summer Campaign',
    adset_name: 'Analytics Audience',
    ad_name: 'Video 1',
    created_time: 1787270400,
  });

  assert.equal(lead.metaLeadId, '123456789012345');
  assert.equal(lead.name, 'Test Person');
  assert.equal(lead.email, 'test@example.com');
  assert.equal(lead.phone, '+91 98765 43210');
  assert.equal(lead.campaignName, 'Summer Campaign');
  assert.equal(lead.createdTime, '1787270400');
});

test('reads contact answers from Meta field_data arrays', () => {
  const lead = normalizeMakeMetaLeadInput({
    id: '123456789012345',
    field_data: [
      { name: 'full_name', values: ['Test Person'] },
      { name: 'email', values: ['test@example.com'] },
      { name: 'phone_number', values: ['919876543210'] },
    ],
  });

  assert.equal(lead.name, 'Test Person');
  assert.equal(lead.email, 'test@example.com');
  assert.equal(lead.phone, '919876543210');
});

test('builds the Make feedback payload expected by the CRM conversions module', () => {
  const lead = {
    _id: '507f1f77bcf86cd799439011',
    status: 'Qualified',
    metaLeadId: '123456789012345',
    email: 'test@example.com',
    phone: '+91 98765-43210',
    campaignName: 'Summer Campaign',
  } as unknown as ILead;

  const payload = buildMetaFeedbackPayload(lead, 'Contacted', new Date('2026-08-21T10:00:00.000Z'));

  assert.equal(payload.eventName, 'Qualified');
  assert.equal(payload.eventTime, 1787306400);
  assert.equal(payload.leadId, '123456789012345');
  assert.equal(payload.phoneNumber, '919876543210');
  assert.equal(payload.previousStatus, 'Contacted');
  assert.equal(payload.campaignName, 'Summer Campaign');
});

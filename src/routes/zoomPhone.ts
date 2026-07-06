import { Router } from 'express';
import {
  getAccountZoomAnalytics,
  getAccountZoomCallLogs,
  getAccountZoomInventory,
  getAccountZoomLiveStatus,
  getAccountZoomRecordings,
  getLeadCallLogRecordings,
  getLeadZoomCalls,
  getLeadZoomRecordings,
  getZoomPhoneStatus,
  streamAccountZoomRecording,
  streamLeadZoomRecording
} from '../controllers/zoomPhoneController';
import { authenticateToken, requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

router.use(authenticateToken, requireAuth);

router.get('/status', getZoomPhoneStatus);
router.get('/account/analytics', requireAdmin, getAccountZoomAnalytics);
router.get('/account/call-logs', requireAdmin, getAccountZoomCallLogs);
router.get('/account/inventory', requireAdmin, getAccountZoomInventory);
router.get('/account/live', requireAdmin, getAccountZoomLiveStatus);
router.get('/account/recordings', requireAdmin, getAccountZoomRecordings);
router.get('/account/recordings/:recordingId/audio', requireAdmin, streamAccountZoomRecording);
router.get('/leads/:leadId/calls', getLeadZoomCalls);
router.get('/leads/:leadId/recordings', getLeadZoomRecordings);
router.get('/leads/:leadId/call-logs/:callLogId/recordings', getLeadCallLogRecordings);
router.get('/leads/:leadId/recordings/:recordingId/audio', streamLeadZoomRecording);

export default router;

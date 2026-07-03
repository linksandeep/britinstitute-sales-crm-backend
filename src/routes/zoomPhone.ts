import { Router } from 'express';
import {
  getAccountZoomCallLogs,
  getLeadCallLogRecordings,
  getLeadZoomCalls,
  getLeadZoomRecordings,
  getZoomPhoneStatus,
  streamLeadZoomRecording
} from '../controllers/zoomPhoneController';
import { authenticateToken, requireAdmin, requireAuth } from '../middleware/auth';

const router = Router();

router.use(authenticateToken, requireAuth);

router.get('/status', getZoomPhoneStatus);
router.get('/account/call-logs', requireAdmin, getAccountZoomCallLogs);
router.get('/leads/:leadId/calls', getLeadZoomCalls);
router.get('/leads/:leadId/recordings', getLeadZoomRecordings);
router.get('/leads/:leadId/call-logs/:callLogId/recordings', getLeadCallLogRecordings);
router.get('/leads/:leadId/recordings/:recordingId/audio', streamLeadZoomRecording);

export default router;

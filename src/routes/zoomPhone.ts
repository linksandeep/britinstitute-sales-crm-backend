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

// Apply standard auth to all routes
router.use(authenticateToken, requireAuth);

// Public status check (no auth needed, but it's behind auth in your original)
router.get('/status', getZoomPhoneStatus);

// Admin routes with standard auth
router.get('/account/analytics', requireAdmin, getAccountZoomAnalytics);
router.get('/account/call-logs', requireAdmin, getAccountZoomCallLogs);
router.get('/account/inventory', requireAdmin, getAccountZoomInventory);
router.get('/account/live', requireAdmin, getAccountZoomLiveStatus);
router.get('/account/recordings', requireAdmin, getAccountZoomRecordings);

// Audio streaming route - uses the same authenticateToken but with query param support
// The middleware now checks both header and query param
router.get('/account/recordings/:recordingId/audio', requireAdmin, streamAccountZoomRecording);

// Lead routes
router.get('/leads/:leadId/calls', getLeadZoomCalls);
router.get('/leads/:leadId/recordings', getLeadZoomRecordings);
router.get('/leads/:leadId/call-logs/:callLogId/recordings', getLeadCallLogRecordings);
router.get('/leads/:leadId/recordings/:recordingId/audio', streamLeadZoomRecording);

export default router;

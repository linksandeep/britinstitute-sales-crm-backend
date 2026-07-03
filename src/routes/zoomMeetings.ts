import { Router } from 'express';
import {
  cancelZoomMeeting,
  createZoomMeeting,
  getZoomMeetingById,
  getZoomMeetingsStatus,
  listZoomMeetings
} from '../controllers/zoomMeetingsController';
import { authenticateToken, requireAuth } from '../middleware/auth';

const router = Router();

router.use(authenticateToken, requireAuth);

router.get('/status', getZoomMeetingsStatus);
router.get('/', listZoomMeetings);
router.post('/', createZoomMeeting);
router.get('/:id', getZoomMeetingById);
router.delete('/:id', cancelZoomMeeting);

export default router;

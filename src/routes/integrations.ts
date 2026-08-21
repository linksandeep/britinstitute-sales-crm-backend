import { Router } from 'express';
import { receiveMakeMetaLead } from '../controllers/makeMetaController';
import { authenticateMakeIntegration } from '../middleware/integrationAuth';

const router = Router();

router.post('/meta/leads', authenticateMakeIntegration, receiveMakeMetaLead);

export default router;

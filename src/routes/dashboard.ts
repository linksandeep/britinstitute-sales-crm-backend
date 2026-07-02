import { Router } from 'express';
import { 
  getDashboardStats,
  getAdminDashboardStats,
  getLeadsByStatus,
  getLeadsBySource,
  getRecentActivity,
  getLeadMetrics,
  getPeriodLeadStats
} from '../controllers/dashboardController';
import { authenticateToken, requireAuth, requireAdmin } from '../middleware/auth';

const router = Router();

// All dashboard routes require authentication
router.use(authenticateToken, requireAuth);

// User dashboard stats
router.get('/stats', getDashboardStats);

// Admin dashboard stats
router.get('/admin-stats', requireAdmin, getAdminDashboardStats);

// Analytics endpoints
router.get('/leads/by-status', getLeadsByStatus);
router.get('/leads/by-source', getLeadsBySource);
router.get('/recent-activity', getRecentActivity);
router.get('/metrics', getLeadMetrics);
router.get('/period-stats', getPeriodLeadStats);

export default router;

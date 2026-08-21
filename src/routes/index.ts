import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import leadRoutes from './leads';
import dashboardRoutes from './dashboard';
import statusRoutes from './status';
import zoomPhoneRoutes from './zoomPhone';
import remindersRouter from './reminders.route'
import ChatRouter from './chat.route'
import attendanceRouter from './attendance.routes'
import performanceRouter from './performance.route'
import hrRoute from './hr.routes'
import SalaryRouter from './salary.routes'
import integrationRoutes from './integrations';
const router = Router();
// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/leads', leadRoutes);
router.use('/integrations', integrationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/statuses', statusRoutes);
router.use('/zoom-phone', zoomPhoneRoutes);
router.use('/reminders', remindersRouter);
router.use("/chat",ChatRouter)
router.use("/attendance",attendanceRouter);
router.use('/performance',performanceRouter)
router.use('/hr',hrRoute)
router.use('',SalaryRouter)
// Health check for API
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;

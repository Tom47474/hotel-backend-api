// 管理员端：/api/admin/*
import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

router.get('/hotels/list', adminController.getHotelsList);
router.get('/hotel/edit/:id', adminController.getHotelEdit);
router.get('/hotel/:id', adminController.getHotelDetail);
router.post('/hotel/:id/audit', adminController.auditHotel);
router.post('/hotel/edit/:id/audit', adminController.auditHotelEdit);

export default router;
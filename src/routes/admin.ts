// 管理员端：/api/admin/*
import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { requireAdmin } from '../middleware/auth.js';
import * as commonController from '../controllers/commonController.js';

const router = Router();

router.use(requireAdmin);

router.get('/hotels/list', adminController.getHotelsList);
router.get('/hotel/edit/:id', adminController.getHotelEdit);
router.get('/hotel/:id', adminController.getHotelDetail);
router.post('/hotel/:id/audit', adminController.auditHotel);
router.post('/hotel/edit/:id/audit', adminController.auditHotelEdit);
router.post('/hotel/:id/offline', adminController.offlineHotel);
router.post('/hotel/:id/online', adminController.onlineHotel);

// 公共：/api/admin/sync-holiday 管理员刷表：从公开 API 同步节假日
router.post('/sync-holiday', commonController.syncHoliday);


/**
 * GET /api/holiday_calendar：读表返回节假日列表，给前端用。
 * POST /api/admin/sync-holiday：刷表：调用 commonService.syncHolidayFromPublicApi(year)，
 * 可通过定时任务或 POST /api/admin/sync-holiday（body 可选 { "year": 2026 }）触发。
 */

export default router;
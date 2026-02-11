// 公共：/api/holiday_calendar, /api/hotel/:id/poi


import { Router } from 'express';
import * as commonController from '../controllers/commonController.js';

const router = Router();

router.get('/holiday_calendar', commonController.getHolidayCalendar);
router.get('/hotel/:id/poi', commonController.getHotelPoi);

export default router;
// 公共：/api/holiday_calendar, /api/hotel/:id/poi


import { Router } from 'express';
import * as commonController from '../controllers/commonController.js';

const router = Router();

router.get('/holiday_calendar', commonController.getHolidayCalendar);
router.get('/hotel/:id/poi', commonController.getHotelPoi);
router.get('/banners', commonController.getBanners);
router.get('/facilities', commonController.getHotelFcilities);
router.get('/getGeoLocation', commonController.getGeoLocation);

export default router;
// 公共：/api/holiday_calendar, /api/hotel/:id/poi


import { Router } from 'express';
import * as commonController from '../controllers/commonController.js';
import multer from 'multer';
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('只允许上传图片'));
    },
});

const router = Router();

router.get('/holiday_calendar', commonController.getHolidayCalendar);
router.get('/hotel/:id/poi', commonController.getHotelPoi);
router.get('/banners', commonController.getBanners);
router.get('/facilities', commonController.getHotelFcilities);
router.get('/getGeoLocation', commonController.getGeoLocation);
router.get('/getCurrentLocation', commonController.getCurrentLocation);
router.post('/merchant/hotel/images/upload', upload.array('files', 20), commonController.uploadHotelImages);
router.get('/roomLabels', commonController.getRoomLabels);

export default router;
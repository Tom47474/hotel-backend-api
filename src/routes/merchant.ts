// 商户端：/api/merchant/*

import { Router } from 'express';
import * as merchantController from '../controllers/merchantController.js';
import { requireMerchant } from '../middleware/auth.js';

const router = Router();

router.use(requireMerchant);

router.post('/hotel', merchantController.createHotel);
router.get('/hotel/:id', merchantController.getHotelDetail);
router.post('/hotel/:id/edit', merchantController.submitHotelEdit);
router.post('/hotel/:id/room', merchantController.createRoom);
router.post('/hotel/:id/promotion', merchantController.createPromotion);


export default router;
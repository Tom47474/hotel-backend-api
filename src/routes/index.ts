// 汇总所有路由，挂到 /api

import { Router } from 'express';
import authRoutes from './auth.js';
import merchantRoutes from './merchant.js'
import adminRoutes from './admin.js';
import commonRoutes from './common.js';
import * as hotelController from '../controllers/hotelController.js';

const router = Router();
router.use('/auth', authRoutes);
router.use('/merchant', merchantRoutes)
router.use('/admin', adminRoutes);
router.get('/hotels', hotelController.getHotelList);
router.get('/hotel/:id', hotelController.getHotelDetail);
router.use('/', commonRoutes);


export default router;
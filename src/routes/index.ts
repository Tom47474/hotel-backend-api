// 汇总所有路由，挂到 /api

import { Router } from 'express';
import authRoutes from './auth.js';
import merchantRoutes from './merchant.js'
import adminRoutes from './admin.js';


const router = Router();
router.use('/auth', authRoutes);
router.use('/merchant', merchantRoutes)
router.use('/admin', adminRoutes);


export default router;
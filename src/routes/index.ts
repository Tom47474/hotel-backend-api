// 汇总所有路由，挂到 /api

import { Router } from 'express';
import authRoutes from './auth.js';


const router = Router();
router.use('/auth', authRoutes);


export default router;
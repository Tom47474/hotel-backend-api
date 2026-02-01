import { Router } from 'express';
import * as authController from '../controllers/authController.js';

// routes只做路由转发

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);

export default router;
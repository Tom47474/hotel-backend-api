// 校验 token，区分 merchant / admin

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-change-in-production';

export interface AuthPayload {
  id: number;
  username: string;
  role: string;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ code: 401, message: '请先登录', data: null });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    (req as any).user = payload;
    next();
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期或无效', data: null });
  }
}

export function requireMerchant(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if ((req as any).user?.role !== 'merchant') {
      return res.status(403).json({ code: 403, message: '仅商户可操作', data: null });
    }
    next();
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if ((req as any).user?.role !== 'admin') {
      return res.status(403).json({ code: 403, message: '仅管理员可操作', data: null });
    }
    next();
  });
}
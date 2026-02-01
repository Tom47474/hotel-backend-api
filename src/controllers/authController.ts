import { Request, Response } from 'express';
import * as authService from '../services/authService.js';

// controller做简单的校验，不操作数据库，调用service去处理业务逻辑，按统一格式返回 { code, message, data }


export async function register(req: Request, res: Response) {
  try {
    const { username, password, role = 'merchant' } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空', data: null });
    }
    const result = await authService.register({ username: username.trim(), password, role });
    return res.status(200).json({ code: 200, message: '注册成功', data: result });
  } catch (e: any) {
    if (e.code === 'DUPLICATE_USERNAME') {
      return res.status(400).json({ code: 400, message: '用户名已存在', data: null });
    }
    return res.status(500).json({ code: 500, message: e.message || '注册失败', data: null });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { username, password } = req.body;
    if (!username?.trim() || !password) {
      return res.status(400).json({ code: 400, message: '用户名和密码不能为空', data: null });
    }
    const result = await authService.login(username.trim(), password);
    return res.status(200).json({ code: 200, message: '登录成功', data: result });
  } catch (e: any) {
    if (e.code === 'INVALID_CREDENTIALS') {
      return res.status(401).json({ code: 401, message: '用户名或密码错误', data: null });
    }
    if (e.code === 'USER_DISABLED') {
      return res.status(403).json({ code: 403, message: '账号已禁用', data: null });
    }
    return res.status(500).json({ code: 500, message: e.message || '登录失败', data: null });
  }
}
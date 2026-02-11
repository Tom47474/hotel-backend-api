import { Request, Response } from 'express';
import * as hotelService from '../services/hotelService.js';

/** GET /api/hotels — 用户端酒店列表（仅数据，筛选与排序由前端完成） */
export async function getHotelList(_req: Request, res: Response) {
  try {
    const data = await hotelService.getUserHotelList();
    return res.status(200).json({ code: 200, message: '成功', data });
  } catch (e: any) {
    return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
  }
}

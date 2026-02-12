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

/** GET /api/hotel/:id — 用户端酒店详情（需 check_in、check_out 查询参数） */
export async function getHotelDetail(req: Request, res: Response) {
  try {
    const hotelId = Number(req.params.id);
    if (!hotelId || Number.isNaN(hotelId)) {
      return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
    }
    const check_in = (req.query.check_in as string)?.trim();
    const check_out = (req.query.check_out as string)?.trim();
    if (!check_in || !check_out) {
      return res.status(400).json({ code: 400, message: 'check_in 与 check_out 必填', data: null });
    }
    const data = await hotelService.getUserHotelDetail(hotelId, check_in, check_out);
    if (!data) {
      return res.status(404).json({ code: 404, message: '酒店不存在或未上线', data: null });
    }
    return res.status(200).json({ code: 200, message: '成功', data });
  } catch (e: any) {
    return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
  }
}

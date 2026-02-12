import { Request, Response } from 'express';
import * as hotelService from '../services/hotelService.js';

/** GET /api/hotels — 用户端酒店列表（后端筛选+排序，hotel_type 默认 domestic） */
export async function getHotelList(req: Request, res: Response) {
  try {
    const hotel_type = ((req.query.hotel_type as string) || 'domestic').toLowerCase();
    const city = (req.query.city as string)?.trim();
    const keyword = (req.query.keyword as string)?.trim();
    const star_min = req.query.star_min != null ? Number(req.query.star_min) : undefined;
    const star_max = req.query.star_max != null ? Number(req.query.star_max) : undefined;
    const price_min = req.query.price_min != null ? Number(req.query.price_min) : undefined;
    const price_max = req.query.price_max != null ? Number(req.query.price_max) : undefined;
    let facility_ids: number[] | undefined;
    if (req.query.facility_ids != null) {
      const raw = req.query.facility_ids;
      facility_ids = Array.isArray(raw)
        ? raw.map((x) => Number(x)).filter((n) => !Number.isNaN(n))
        : [Number(raw)].filter((n) => !Number.isNaN(n));
    }
    const sort = (req.query.sort as 'price_asc' | 'price_desc' | 'rating_desc') || 'price_asc';

    const data = await hotelService.getUserHotelList({
      hotel_type: hotel_type as 'domestic' | 'overseas' | 'hourly' | 'guesthouse',
      city,
      keyword,
      star_min,
      star_max,
      price_min,
      price_max,
      facility_ids: facility_ids?.length ? facility_ids : undefined,
      sort,
    });
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

import { Request, Response } from 'express';
import * as commonService from '../services/commonService.js';

/** GET /api/holiday_calendar — 节假日列表（给前端用） */
export async function getHolidayCalendar(_req: Request, res: Response) {
  try {
    const data = await commonService.getHolidayCalendar();
    return res.status(200).json({ code: 200, message: '成功', data });
  } catch (e: any) {
    return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
  }
}

/** POST /api/admin/sync-holiday — 刷表：从公开 API 同步节假日 */
export async function syncHoliday(req: Request, res: Response) {
  try {
    const year = req.body.year ? Number(req.body.year) : undefined;
    const { count } = await commonService.syncHolidayFromPublicApi(year);
    return res.status(200).json({ code: 200, message: '同步成功', data: { count } });
  } catch (e: any) {
    return res.status(500).json({ code: 500, message: e.message || '同步失败', data: null });
  }
}



/** GET /api/hotel/:id/poi — 酒店周边兴趣点（数据库 + 高德） */
export async function getHotelPoi(req: Request, res: Response) {
    try {
      const hotelId = Number(req.params.id);
      if (!hotelId || Number.isNaN(hotelId)) {
        return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
      }
      const data = await commonService.getHotelPoi(hotelId);
      return res.status(200).json({ code: 200, message: '成功', data });
    } catch (e: any) {
      return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
    }
  }


/** GET /api/banners — 首页 Banner 列表（用户端） */
export async function getBanners(_req: Request, res: Response) {
  try {
    const data = await commonService.getHomeBanners();
    return res.status(200).json({ code: 200, message: '成功', data });
  } catch (e: any) {
    return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
  }
}

/** GET /api/hotel_facilities — 酒店设施列表 */
export async function getHotelFcilities(_req: Request, res: Response) {
  try {
    const data = await commonService.getHotelFcilities();
    return res.status(200).json({ code: 200, message: "成功", data });
  } catch (e: any) {
    return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
  }
}
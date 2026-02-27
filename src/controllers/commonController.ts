import { Request, Response } from 'express';
import * as commonService from '../services/commonService.js';
import console from 'console';

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

/** GET /api/geoLocation 根据地址获取经纬度 */
export async function getGeoLocation(req: Request, res: Response) {
  try {
    const address = String(req.query.address ?? '');
    const city = String(req.query.city ?? '');
    const data = await commonService.getGeoLocation(address, city);
    return res.status(200).json({ code: 200, message: "成功", data });
  } catch (err) {
    return res.status(500).json({ code: 500, message: err.message || '查询失败', data: null });
  }
}

/** 根据经纬度获取地址 */
export async function getCurrentLocation(req: Request, res: Response) {
  try {
    const lng = String(req.query.lng ?? '');
    const lat = String(req.query.lat ?? '');
    const data = await commonService.getCurrentLocation(lng, lat);
    return res.status(200).json({ code: 200, message: "成功", data });
  } catch (err) {
    return res.status(500).json({ code: 500, message: err.message || '查询失败', data: null });
  }
}

/** POST /api/merchant/hotel/images/upload — 上传酒店图片 */
export async function uploadHotelImages(req: Request, res: Response) {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files?.length) {
      return res.status(400).json({ code: 400, message: '未收到图片', data: null });
    }
    const urls = await commonService.uploadImages(files);
    return res.status(200).json({ code: 200, message: '上传成功', data: { urls } });
  } catch (e: any) {
    return res.status(500).json({ code: 500, message: e.message || '上传失败', data: null });
  }
}
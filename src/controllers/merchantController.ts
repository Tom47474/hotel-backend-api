import { Request, Response } from 'express';
import * as hotelService from '../services/hotelService.js';
import type { AuthPayload } from '../middleware/auth.js';
import * as promotionService from '../services/promotionService.js'

/** POST /api/merchant/hotel — 商户创建酒店，提交后直接 pending */
export async function createHotel(req: Request, res: Response) {
    try {
        const user = (req as any).user as AuthPayload;
        const merchantId = user.id;

        const { name, star, city, address, latitude, longitude, description, opening_date, hotel_type, contacts, facilities, images, rooms } =
            req.body;
        if (!name?.trim()) {
            return res.status(400).json({ code: 400, message: '酒店名称不能为空', data: null });
        }
        if (!city?.trim()) {
            return res.status(400).json({ code: 400, message: '城市不能为空', data: null });
        }
        if (!address?.trim()) {
            return res.status(400).json({ code: 400, message: '地址不能为空', data: null });
        }

        const result = await hotelService.createHotel(merchantId, {
            name: name.trim(),
            star,
            city: city.trim(),
            address: address.trim(),
            latitude,
            longitude,
            description,
            opening_date: opening_date ?? undefined,
            hotel_type: hotel_type as hotelService.HotelType,
            contacts: Array.isArray(contacts) ? contacts : undefined,
            facilities: Array.isArray(facilities) ? facilities : undefined,
            images: Array.isArray(images) ? images : undefined,
            rooms: Array.isArray(rooms) ? rooms : undefined,
        });
        return res.status(200).json({ code: 200, message: '酒店创建成功', data: result });
    } catch (e: any) {
        return res.status(500).json({ code: 500, message: e.message || '酒店创建失败', data: null });
    }
}

/** GET /api/merchant/hotels — 商户获取自己的酒店列表（分页） */
export async function getHotelsList(req: Request, res: Response) {
    try {
        const user = (req as any).user as AuthPayload;
        const merchantId = user.id;
        const page = Number(req.query.page) || 1;
        const size = Number(req.query.size) || 10;

        const { list, total } = await hotelService.getMerchantHotelsList(merchantId, page, size);
        return res.status(200).json({
            code: 200,
            message: '成功',
            data: { list, total, page, size },
        });
    } catch (e: any) {
        return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
    }
}

/** GET /api/merchant/hotel/:id/edit/latest — 获取该酒店最近一条修改记录（含驳回原因与提交内容） */
export async function getHotelEditLatest(req: Request, res: Response) {
    try {
        const user = (req as any).user as AuthPayload;
        const merchantId = user.id;
        const hotelId = Number(req.params.id);
        if (!hotelId || Number.isNaN(hotelId)) {
            return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
        }
        const data = await hotelService.getMerchantHotelEditLatest(hotelId, merchantId);
        if (!data) {
            return res.status(404).json({ code: 404, message: '无修改记录或无权查看', data: null });
        }
        return res.status(200).json({ code: 200, message: '成功', data });
    } catch (e: any) {
        return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
    }
}

/** GET /api/merchant/hotel/:id — 获取当前商户的酒店详情（用于编辑页回填） */
export async function getHotelDetail(req: Request, res: Response) {
    try {
        const user = (req as any).user as AuthPayload;
        const merchantId = user.id;
        const hotelId = Number(req.params.id);
        if (!hotelId || Number.isNaN(hotelId)) {
            return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
        }

        const data = await hotelService.getHotelByMerchant(hotelId, merchantId);
        if (!data) {
            return res.status(404).json({ code: 404, message: '酒店不存在或无权查看', data: null });
        }
        return res.status(200).json({ code: 200, message: '成功', data });
    } catch (e: any) {
        return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
    }
}

/** POST /api/merchant/hotel/:id/edit — 提交酒店信息修改（待管理员审核） */
export async function submitHotelEdit(req: Request, res: Response) {
  try {
    const user = (req as any).user as AuthPayload;
    const merchantId = user.id;
    const hotelId = Number(req.params.id);
    if (!hotelId || Number.isNaN(hotelId)) {
      return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
    }

    const { name, star, city, address, latitude, longitude, description, opening_date, contacts, facilities, images } =
      req.body;

    const result = await hotelService.submitHotelEdit(hotelId, merchantId, {
      name: name?.trim(),
      star,
      city: city?.trim(),
      address: address?.trim(),
      latitude,
      longitude,
      description: description?.trim(),
      opening_date: opening_date ?? undefined,
      contacts: Array.isArray(contacts) ? contacts : undefined,
      facilities: Array.isArray(facilities) ? facilities : undefined,
      images: Array.isArray(images) ? images : undefined,
    });
    return res.status(200).json({
      code: 200,
      message: '修改已提交，等待管理员审核',
      data: result,
    });
  } catch (e: any) {
    if ((e as any).code === 'HOTEL_NOT_FOUND') {
      return res.status(403).json({ code: 403, message: '酒店不存在或无权操作', data: null });
    }
    if ((e as any).code === 'HOTEL_NOT_APPROVED') {
      return res.status(400).json({ code: 400, message: '仅已上线的酒店可提交修改', data: null });
    }
    if ((e as any).code === 'EDIT_PENDING_EXISTS') {
      return res.status(400).json({ code: 400, message: '已有待审核修改，请等待审核结果', data: null });
    }
    return res.status(500).json({ code: 500, message: e.message || '提交失败', data: null });
  }
}

/** POST /api/merchant/hotel/:id/room — 商户新增房型 */
export async function createRoom(req: Request, res: Response) {
    try {
        const user = (req as any).user as AuthPayload;
        const merchantId = user.id;
        const hotelId = Number(req.params.id);
        if (!hotelId || Number.isNaN(hotelId)) {
            return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
        }

        const { name, area, bed_type, max_guest, base_price, stock, images, tag_ids } = req.body;

        const result = await hotelService.createRoom(hotelId, merchantId, {
            name: name?.trim(),
            area,
            bed_type: bed_type?.trim(),
            max_guest,
            base_price,
            stock,
            images: Array.isArray(images) ? images : undefined,
            tag_ids: Array.isArray(tag_ids) ? tag_ids : undefined,
        });
        return res.status(200).json({ code: 200, message: '房型创建成功', data: result });
    } catch (e: any) {
        if ((e as any).code === 'HOTEL_NOT_FOUND') {
            return res.status(403).json({ code: 403, message: '酒店不存在或无权操作', data: null });
        }
        return res.status(500).json({ code: 500, message: e.message || '房型创建失败', data: null });
    }
}


/** POST /api/merchant/hotel/:id/promotion — 商户创建优惠 */
export async function createPromotion(req: Request, res: Response) {
    try {
        const user = (req as any).user as AuthPayload;
        const merchantId = user.id;
        const hotelId = Number(req.params.id);
        if (!hotelId || Number.isNaN(hotelId)) {
            return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
        }

        const { type, discount, minus, description, start_time, end_time, scenes } = req.body;
        if (!type || !['discount', 'minus', 'bundle'].includes(type)) {
            return res.status(400).json({ code: 400, message: '优惠类型无效', data: null });
        }
        if (!start_time || !end_time) {
            return res.status(400).json({ code: 400, message: '开始时间、结束时间不能为空', data: null });
        }

        const result = await promotionService.createPromotion(merchantId, hotelId, {
            type,
            discount: discount ?? null,
            minus: minus ?? null,
            description: description?.trim(),
            start_time,
            end_time,
            scenes: Array.isArray(scenes) ? scenes : undefined,
        });
        return res.status(200).json({ code: 200, message: '优惠创建成功', data: result });
    } catch (e: any) {
        if ((e as any).code === 'HOTEL_NOT_FOUND') {
            return res.status(403).json({ code: 403, message: '酒店不存在或无权操作', data: null });
        }
        return res.status(500).json({ code: 500, message: e.message || '优惠创建失败', data: null });
    }
}
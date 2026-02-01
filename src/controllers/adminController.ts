import { Request, Response } from 'express';
import * as adminService from '../services/adminService.js';
import * as hotelService from '../services/hotelService.js';


/** GET /api/admin/hotels/list — 管理员获取酒店/修改统一列表（带 type 标签，分页） */
export async function getHotelsList(req: Request, res: Response) {
    try {
        const page = Number(req.query.page) || 1;
        const size = Number(req.query.size) || 10;
        const { list, total } = await adminService.getAdminHotelsList(page, size);
        return res.status(200).json({
            code: 200,
            message: '成功',
            data: { list, total, page, size },
        });
    } catch (e: any) {
        return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
    }
}

/** POST /api/admin/hotel/:id/audit — 管理员审核新酒店 */
export async function auditHotel(req: Request, res: Response) {
    try {
        const adminId = (req as any).user?.id;
        if (!adminId) return res.status(401).json({ code: 401, message: '未登录', data: null });

        const hotelId = Number(req.params.id);
        if (!hotelId || Number.isNaN(hotelId)) {
            return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
        }
        const { result, reason } = req.body;
        if (!result || !['approved', 'rejected'].includes(result)) {
            return res.status(400).json({ code: 400, message: 'result 须为 approved 或 rejected', data: null });
        }

        await adminService.auditHotel(hotelId, adminId, result, reason);
        return res.status(200).json({ code: 200, message: '审核成功', data: null });
    } catch (e: any) {
        if ((e as any).code === 'HOTEL_NOT_FOUND') {
            return res.status(404).json({ code: 404, message: '酒店不存在', data: null });
        }
        if ((e as any).code === 'HOTEL_NOT_PENDING') {
            return res.status(400).json({ code: 400, message: '该酒店不是待审核状态', data: null });
        }
        return res.status(500).json({ code: 500, message: e.message || '审核失败', data: null });
    }
}

/** POST /api/admin/hotel/edit/:id/audit — 管理员审核酒店信息修改 */
export async function auditHotelEdit(req: Request, res: Response) {
    try {
        const adminId = (req as any).user?.id;
        if (!adminId) return res.status(401).json({ code: 401, message: '未登录', data: null });

        const hotelEditId = Number(req.params.id);
        if (!hotelEditId || Number.isNaN(hotelEditId)) {
            return res.status(400).json({ code: 400, message: '修改记录ID无效', data: null });
        }
        const { result, reason } = req.body;
        if (!result || !['approved', 'rejected'].includes(result)) {
            return res.status(400).json({ code: 400, message: 'result 须为 approved 或 rejected', data: null });
        }

        await adminService.auditHotelEdit(hotelEditId, adminId, result, reason);
        return res.status(200).json({ code: 200, message: '审核成功', data: null });
    } catch (e: any) {
        if ((e as any).code === 'HOTEL_EDIT_NOT_FOUND') {
            return res.status(404).json({ code: 404, message: '修改记录不存在或已审核', data: null });
        }
        return res.status(500).json({ code: 500, message: e.message || '审核失败', data: null });
    }
}

/** GET /api/admin/hotel/edit/:id — 管理员获取单条 hotel_edit（用于审核页对比） */
export async function getHotelEdit(req: Request, res: Response) {
    try {
        const hotelEditId = Number(req.params.id);
        if (!hotelEditId || Number.isNaN(hotelEditId)) {
            return res.status(400).json({ code: 400, message: '修改记录ID无效', data: null });
        }

        const data = await adminService.getHotelEditById(hotelEditId);
        if (!data) {
            return res.status(404).json({ code: 404, message: '修改记录不存在', data: null });
        }
        return res.status(200).json({ code: 200, message: '成功', data });
    } catch (e: any) {
        return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
    }
}

/** GET /api/admin/hotel/:id — 管理员获取任意酒店详情（来自 hotel 表） */
export async function getHotelDetail(req: Request, res: Response) {
    try {
        const hotelId = Number(req.params.id);
        if (!hotelId || Number.isNaN(hotelId)) {
            return res.status(400).json({ code: 400, message: '酒店ID无效', data: null });
        }
        const data = await hotelService.getHotelById(hotelId);
        if (!data) {
            return res.status(404).json({ code: 404, message: '酒店不存在', data: null });
        }
        return res.status(200).json({ code: 200, message: '成功', data });
    } catch (e: any) {
        return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null });
    }
}
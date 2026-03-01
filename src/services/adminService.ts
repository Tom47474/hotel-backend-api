import pool from '../config/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

/** 管理员列表项（统一结构，带 type 标签供前端筛选） */
export interface AdminHotelListItem {
    type: string;
    hotel_id: number;
    hotel_edit_id: number | null;
    name: string;
    merchant_id: number | null;
    status: string;
    created_at: string;
}

/**
 * 管理员：获取酒店/修改统一列表（全部酒店 + 待审核/已驳回的 hotel_edit），每条带 type 标签，分页
 * type: hotel_pending | hotel_approved | hotel_offline | hotel_rejected | hotel_draft | hotel_editing | hotel_edit_pending | hotel_edit_rejected
 */
export async function getAdminHotelsList(
    page: number = 1,
    size: number = 10
): Promise<{ list: AdminHotelListItem[]; total: number }> {
    const pageNum = Math.max(1, page);
    const sizeNum = Math.min(100, Math.max(1, size));

    const [hotelRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id AS hotel_id, name, merchant_id, status, created_at
       FROM hotel
       ORDER BY created_at DESC`
    );
    const hotelItems: AdminHotelListItem[] = (hotelRows || []).map((r) => ({
        type: 'hotel_' + r.status,
        hotel_id: r.hotel_id,
        hotel_edit_id: null,
        name: r.name || '',
        merchant_id: r.merchant_id ?? null,
        status: r.status,
        created_at: r.created_at ? String(r.created_at) : '',
    }));

    const [editRows] = await pool.execute<RowDataPacket[]>(
        `SELECT e.id AS hotel_edit_id, e.hotel_id, h.name AS name, h.merchant_id, e.edit_status, e.created_at
       FROM hotel_edit e
       LEFT JOIN hotel h ON h.id = e.hotel_id
       WHERE e.edit_status IN ('pending', 'rejected')
       ORDER BY e.created_at DESC`
    );
    const editItems: AdminHotelListItem[] = (editRows || []).map((r) => ({
        type: r.edit_status === 'rejected' ? 'hotel_edit_rejected' : 'hotel_edit_pending',
        hotel_id: r.hotel_id,
        hotel_edit_id: r.hotel_edit_id,
        name: r.name || '',
        merchant_id: r.merchant_id ?? null,
        status: r.edit_status,
        created_at: r.created_at ? String(r.created_at) : '',
    }));

    const merged = [...hotelItems, ...editItems].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const total = merged.length;
    const list = merged.slice((pageNum - 1) * sizeNum, pageNum * sizeNum);

    return { list, total };
}


/**
 * 管理员：审核新酒店（通过/驳回）
 * 通过：INSERT hotel_audit，UPDATE hotel.status = 'approved'
 * 驳回：INSERT hotel_audit，UPDATE hotel.status = 'rejected'
 */
export async function auditHotel(
    hotelId: number,
    adminId: number,
    result: 'approved' | 'rejected',
    reason?: string
): Promise<void> {
    const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, status FROM hotel WHERE id = ? LIMIT 1',
        [hotelId]
    );
    if (!rows?.length) {
        const err = new Error('酒店不存在');
        (err as any).code = 'HOTEL_NOT_FOUND';
        throw err;
    }
    if (rows[0].status !== 'pending') {
        const err = new Error('该酒店不是待审核状态');
        (err as any).code = 'HOTEL_NOT_PENDING';
        throw err;
    }

    await pool.execute<ResultSetHeader>(
        'INSERT INTO hotel_audit (hotel_id, admin_id, result, reason) VALUES (?, ?, ?, ?)',
        [hotelId, adminId, result, reason ?? null]
    );
    await pool.execute('UPDATE hotel SET status = ? WHERE id = ?', [result, hotelId]);
}

/**
 * 管理员：审核酒店信息修改（通过/驳回）
 * 通过：UPDATE hotel_edit，并把 hotel_edit 非空字段写回 hotel（及 contact/facility/image）
 * 驳回：UPDATE hotel_edit SET edit_status='rejected', reject_reason, reviewed_at
 * 
 * 这里需要改，将hotel_edit全量覆盖hotel，而不是只更新非空的字段，房型哪些信息也要上传到数据库
 */
export async function auditHotelEdit(
    hotelEditId: number,
    adminId: number,
    result: 'approved' | 'rejected',
    reason?: string
): Promise<void> {
    const [editRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, hotel_id, name, hotel_type, star, city, address, latitude, longitude, description, opening_date,
              contacts_edit, facilities_edit, images_edit, rooms_edit
       FROM hotel_edit WHERE id = ? AND edit_status = 'pending' LIMIT 1`,
        [hotelEditId]
    );
    if (!editRows?.length) {
        const err = new Error('修改记录不存在或已审核');
        (err as any).code = 'HOTEL_EDIT_NOT_FOUND';
        throw err;
    }

    const e = editRows[0];
    const hotelId = e.hotel_id;

    await pool.execute(
        `UPDATE hotel_edit SET edit_status = ?, reject_reason = ?, reviewed_at = NOW() WHERE id = ?`,
        [result, result === 'rejected' ? (reason ?? null) : null, hotelEditId]
    );

    if (result !== 'approved') return;

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. 全量覆盖 hotel 基本字段（不判断 null，直接写）
        await conn.execute(
            `UPDATE hotel SET name = ?, hotel_type = ?, star = ?, city = ?, address = ?,
                latitude = ?, longitude = ?, description = ?, opening_date = ?
             WHERE id = ?`,
            [
                e.name,
                e.hotel_type,
                e.star,
                e.city,
                e.address,
                e.latitude,
                e.longitude,
                e.description,
                e.opening_date,
                hotelId,
            ]
        );

        // 2. 全量覆盖联系方式
        const contacts = e.contacts_edit != null
            ? (typeof e.contacts_edit === 'string' ? JSON.parse(e.contacts_edit) : e.contacts_edit)
            : [];
        await conn.execute('DELETE FROM hotel_contact WHERE hotel_id = ?', [hotelId]);
        for (const c of contacts) {
            await conn.execute(
                'INSERT INTO hotel_contact (hotel_id, contact_type, contact_value, is_primary, remark) VALUES (?, ?, ?, ?, ?)',
                [hotelId, c.type, c.value, c.is_primary ? 1 : 0, c.remark ?? null]
            );
        }

        // 3. 全量覆盖设施
        const facilities = e.facilities_edit != null
            ? (typeof e.facilities_edit === 'string' ? JSON.parse(e.facilities_edit) : e.facilities_edit)
            : [];
        await conn.execute('DELETE FROM hotel_facility WHERE hotel_id = ?', [hotelId]);
        for (const fid of facilities) {
            await conn.execute('INSERT INTO hotel_facility (hotel_id, facility_id) VALUES (?, ?)', [hotelId, fid]);
        }

        // 4. 全量覆盖酒店图片
        const images = e.images_edit != null
            ? (typeof e.images_edit === 'string' ? JSON.parse(e.images_edit) : e.images_edit)
            : [];
        await conn.execute('DELETE FROM hotel_image WHERE hotel_id = ?', [hotelId]);
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            await conn.execute(
                'INSERT INTO hotel_image (hotel_id, image_url, type, sort) VALUES (?, ?, ?, ?)',
                [hotelId, img.url, img.type || 'detail', i]
            );
        }

        // 5. 全量覆盖房型
        const rooms = e.rooms_edit != null
            ? (typeof e.rooms_edit === 'string' ? JSON.parse(e.rooms_edit) : e.rooms_edit)
            : [];

        if (rooms.length > 0) {
            // 获取现有房型 id，用于删除图片和标签
            const [existingRooms] = await conn.execute<RowDataPacket[]>(
                'SELECT id FROM hotel_room WHERE hotel_id = ?',
                [hotelId]
            );
            const existingRoomIds = (existingRooms as any[]).map((r) => r.id);

            if (existingRoomIds.length > 0) {
                const ph = existingRoomIds.map(() => '?').join(',');
                await conn.execute(`DELETE FROM room_image WHERE room_id IN (${ph})`, existingRoomIds);
                await conn.execute(`DELETE FROM hotel_room_tag WHERE room_id IN (${ph})`, existingRoomIds);
            }
            await conn.execute('DELETE FROM hotel_room WHERE hotel_id = ?', [hotelId]);

            // 插入新房型
            for (const room of rooms) {
                const [rResult] = await conn.execute<ResultSetHeader>(
                    `INSERT INTO hotel_room (hotel_id, name, area, bed_type, max_guest, base_price, stock)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        hotelId,
                        room.name ?? null,
                        room.area ?? null,
                        room.bed_type ?? null,
                        room.max_guest ?? null,
                        room.base_price ?? null,
                        room.stock ?? null,
                    ]
                );
                const roomId = Number(rResult.insertId);

                if (Array.isArray(room.images)) {
                    for (let i = 0; i < room.images.length; i++) {
                        const img = room.images[i];
                        await conn.execute(
                            'INSERT INTO room_image (room_id, image_url, type, sort) VALUES (?, ?, ?, ?)',
                            [roomId, img.url, img.type || 'detail', i]
                        );
                    }
                }

                if (Array.isArray(room.tag_ids)) {
                    for (const tagId of room.tag_ids) {
                        await conn.execute(
                            'INSERT INTO hotel_room_tag (room_id, tag_id) VALUES (?, ?)',
                            [roomId, tagId]
                        );
                    }
                }
            }
        }

        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}


/** 单条 hotel_edit 返回结构（含 JSON 列解析后的 contacts/facilities/images） */
export interface HotelEditDetail {
    id: number;
    hotel_id: number;
    name: string | null;
    star: number | null;
    city: string | null;
    address: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    description: string | null;
    opening_date: string | null;
    edit_status: string;
    reject_reason: string | null;
    created_at: string;
    reviewed_at: string | null;
    contacts_edit: unknown;
    facilities_edit: unknown;
    images_edit: unknown;
    facilities_edit_with_names ?: Array<{ id: number; name: string }>;
}

/**
 * 管理员：根据 hotel_edit_id 获取单条 hotel_edit
 */
export async function getHotelEditById(hotelEditId: number): Promise<HotelEditDetail | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, hotel_id, name, star, city, address, latitude, longitude, description, opening_date,
            edit_status, reject_reason, created_at, reviewed_at, contacts_edit, facilities_edit, images_edit
     FROM hotel_edit WHERE id = ? LIMIT 1`,
        [hotelEditId]
    );
    if (!rows?.length) return null;

    const r = rows[0];
    const facilitiesEdit = r.facilities_edit !== null ? 
             (typeof r.facilities_edit === 'string' ? JSON.parse(r.facilities_edit) 
             : r.facilities_edit) : null;

    let facilitiesEditWithNames: Array<{ id: number; name: string }> | undefined;
    if (Array.isArray(facilitiesEdit) && facilitiesEdit.length > 0) {
        const placeholders = facilitiesEdit.map(() => '?').join(',');
        const [fRows] = await pool.execute<RowDataPacket[]>(
            `SELECT id, name FROM facility WHERE id IN (${placeholders})`,
            facilitiesEdit
        );
        facilitiesEditWithNames = (fRows || []).map((row: any) => ({ id: row.id, name: row.name || '' }));
    }



    return {
        id: r.id,
        hotel_id: r.hotel_id,
        name: r.name,
        star: r.star,
        city: r.city,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        description: r.description,
        opening_date: r.opening_date ? String(r.opening_date) : null,
        edit_status: r.edit_status,
        reject_reason: r.reject_reason,
        created_at: String(r.created_at),
        reviewed_at: r.reviewed_at ? String(r.reviewed_at) : null,
        contacts_edit: r.contacts_edit != null ? (typeof r.contacts_edit === 'string' ? JSON.parse(r.contacts_edit) : r.contacts_edit) : null,
        facilities_edit: facilitiesEdit,
        facilities_edit_with_names: facilitiesEditWithNames,
        images_edit: r.images_edit != null ? (typeof r.images_edit === 'string' ? JSON.parse(r.images_edit) : r.images_edit) : null,
    };
}

/** 管理员：下线酒店 */
export async function offlineHotel(hotelId: number): Promise<void> {
    const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, status FROM hotel WHERE id = ? LIMIT 1',
        [hotelId]
    );
    if (!rows?.length) {
        const err = new Error('酒店不存在');
        (err as any).code = 'HOTEL_NOT_FOUND';
        throw err;
    }
    if (rows[0].status !== 'approved') {
        const err = new Error('仅已上线的酒店可下线');
        (err as any).code = 'HOTEL_NOT_APPROVED';
        throw err;
    }
    await pool.execute('UPDATE hotel SET status = ? WHERE id = ?', ['offline', hotelId]);
}

/** 管理员：重新上线酒店 */
export async function onlineHotel(hotelId: number): Promise<void> {
    const [rows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, status FROM hotel WHERE id = ? LIMIT 1',
        [hotelId]
    );
    if (!rows?.length) {
        const err = new Error('酒店不存在');
        (err as any).code = 'HOTEL_NOT_FOUND';
        throw err;
    }
    if (rows[0].status !== 'offline') {
        const err = new Error('仅已下线的酒店可重新上线');
        (err as any).code = 'HOTEL_NOT_OFFLINE';
        throw err;
    }
    await pool.execute('UPDATE hotel SET status = ? WHERE id = ?', ['approved', hotelId]);
}
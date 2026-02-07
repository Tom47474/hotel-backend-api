import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2'

// 创建酒店
export interface CreateHotelParams {
    name: string;
    star?: number;
    city: string;
    address: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    opening_date?: string | null;
    contacts?: Array<{
        type: 'phone' | 'email' | 'fax' | 'wechat';
        value: string;
        is_primary?: boolean;
        remark?: string;
    }>;
    facilities?: number[];
    images?: Array<{ url: string; type: 'cover' | 'detail' }>;
}

/** 商户创建酒店，创建后状态直接为 pending（待审核） */
export async function createHotel(
    merchantId: number,
    params: CreateHotelParams
): Promise<{ hotel_id: number }> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [hResult] = await conn.execute<ResultSetHeader>(
            `INSERT INTO hotel (
            name, star, city, address, latitude, longitude, description, opening_date,
            merchant_id, status, rating, review_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0)`,
            [
                params.name,
                params.star ?? null,
                params.city,
                params.address,
                params.latitude ?? null,
                params.longitude ?? null,
                params.description ?? null,
                params.opening_date ?? null,
                merchantId,
            ]
        );
        const hotelId = Number(hResult.insertId);

        if (Array.isArray(params.contacts) && params.contacts.length > 0) {
            for (const c of params.contacts) {
                await conn.execute<ResultSetHeader>(
                    `INSERT INTO hotel_contact (hotel_id, contact_type, contact_value, is_primary, remark)
           VALUES (?, ?, ?, ?, ?)`,
                    [hotelId, c.type, c.value, c.is_primary ? 1 : 0, c.remark ?? null]
                );
            }
        }

        if (Array.isArray(params.images) && params.images.length > 0) {
            await Promise.all(
                params.images.map((img, index) =>
                    conn.execute(
                        `INSERT INTO hotel_image (hotel_id, image_url, type, sort) VALUES (?, ?, ?, ?)`,
                        [hotelId, img.url, img.type, index]
                    )
                )
            );
        }

        if (Array.isArray(params.facilities) && params.facilities.length > 0) {
            for (const fid of params.facilities) {
                await conn.execute(`INSERT INTO hotel_facility (hotel_id, facility_id) VALUES (?, ?)`, [
                    hotelId,
                    fid,
                ]);
            }
        }

        await conn.commit();
        return { hotel_id: hotelId };
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

/** 商户获取酒店详情（用于编辑页回填）返回结构 */
export interface MerchantHotelDetail {
    hotel_id: number;
    name: string;
    star: number | null;
    city: string;
    address: string;
    latitude: number | string | null;
    longitude: number | string | null;
    description: string | null;
    opening_date: string | null;
    status: string;
    contacts: Array<{ type: string; value: string; is_primary: number; remark: string | null }>;
    images: Array<{ url: string; type: string; sort: number }>;
    facilities: number[];
}

/** 商户酒店列表项（含最新修改状态，便于展示「修改已驳回」） */
export interface MerchantHotelListItem {
    hotel_id: number;
    name: string;
    status: string;
    created_at: string;
    latest_edit?: {
        edit_status: string;
        reject_reason: string | null;
        reviewed_at: string | null;
    };
}

/** 商户获取「该酒店最近一条修改记录」的返回结构（含驳回原因与提交内容） */
export interface MerchantHotelEditLatest {
    hotel_edit_id: number;
    hotel_id: number;
    edit_status: string;
    reject_reason: string | null;
    reviewed_at: string | null;
    created_at: string;
    name: string | null;
    star: number | null;
    city: string | null;
    address: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    description: string | null;
    opening_date: string | null;
    contacts_edit: unknown;
    facilities_edit: unknown;
    images_edit: unknown;
}

/**
 * 商户：获取本商户的酒店列表（分页），含最新一条 hotel_edit 状态
 */
export async function getMerchantHotelsList(
    merchantId: number,
    page: number = 1,
    size: number = 10
): Promise<{ list: MerchantHotelListItem[]; total: number }> {
    const pageNum = Math.max(1, page);
    const sizeNum = Math.min(100, Math.max(1, size));
    const offset = (pageNum - 1) * sizeNum;

    const [countRows] = await pool.execute<RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM hotel WHERE merchant_id = ?',
        [merchantId]
    );
    const total = Number((countRows as any)?.[0]?.total ?? 0);

    const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id AS hotel_id, name, status, created_at
         FROM hotel WHERE merchant_id = ?
         ORDER BY created_at DESC LIMIT ${sizeNum} OFFSET ${offset}`,
        [merchantId]
    );
    const list: MerchantHotelListItem[] = (rows || []).map((r) => ({
        hotel_id: r.hotel_id,
        name: r.name || '',
        status: r.status || '',
        created_at: r.created_at ? String(r.created_at) : '',
    }));

    if (list.length === 0) return { list, total };

    const hotelIds = list.map((h) => h.hotel_id);
    const placeholders = hotelIds.map(() => '?').join(',');
    const [editRows] = await pool.execute<RowDataPacket[]>(
        `SELECT hotel_id, edit_status, reject_reason, reviewed_at
         FROM hotel_edit
         WHERE hotel_id IN (${placeholders})
         ORDER BY id DESC`,
        hotelIds
    );
    const latestByHotel: Record<number, { edit_status: string; reject_reason: string | null; reviewed_at: string | null }> = {};
    for (const e of editRows || []) {
        if (latestByHotel[e.hotel_id] == null) {
            latestByHotel[e.hotel_id] = {
                edit_status: e.edit_status || '',
                reject_reason: e.reject_reason ?? null,
                reviewed_at: e.reviewed_at ? String(e.reviewed_at) : null,
            };
        }
    }
    list.forEach((h) => {
        const latest = latestByHotel[h.hotel_id];
        if (latest) h.latest_edit = latest;
    });

    return { list, total };
}

/**
 * 商户：获取本商户某酒店的最近一条 hotel_edit（用于详情页展示驳回原因与当时提交内容）
 * 先校验酒店归属，再按 id 倒序取一条
 */
export async function getMerchantHotelEditLatest(
    hotelId: number,
    merchantId: number
): Promise<MerchantHotelEditLatest | null> {
    const [hRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM hotel WHERE id = ? AND merchant_id = ? LIMIT 1',
        [hotelId, merchantId]
    );
    if (!hRows?.length) return null;

    const [rows] = await pool.execute<RowDataPacket[]>(
        `SELECT id, hotel_id, name, star, city, address, latitude, longitude, description, opening_date,
            edit_status, reject_reason, created_at, reviewed_at, contacts_edit, facilities_edit, images_edit
         FROM hotel_edit WHERE hotel_id = ? ORDER BY id DESC LIMIT 1`,
        [hotelId]
    );
    if (!rows?.length) return null;

    const r = rows[0];
    return {
        hotel_edit_id: r.id,
        hotel_id: r.hotel_id,
        edit_status: r.edit_status || '',
        reject_reason: r.reject_reason ?? null,
        reviewed_at: r.reviewed_at ? String(r.reviewed_at) : null,
        created_at: String(r.created_at),
        name: r.name,
        star: r.star,
        city: r.city,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        description: r.description,
        opening_date: r.opening_date ? String(r.opening_date) : null,
        contacts_edit: r.contacts_edit != null ? (typeof r.contacts_edit === 'string' ? JSON.parse(r.contacts_edit) : r.contacts_edit) : null,
        facilities_edit: r.facilities_edit != null ? (typeof r.facilities_edit === 'string' ? JSON.parse(r.facilities_edit) : r.facilities_edit) : null,
        images_edit: r.images_edit != null ? (typeof r.images_edit === 'string' ? JSON.parse(r.images_edit) : r.images_edit) : null,
    };
}



/** 商户新增房型 */
export interface CreateRoomParams {
    name?: string;
    area?: number;
    bed_type?: string;
    max_guest?: number;
    base_price?: number;
    stock?: number;
}

/**
 * 商户新增房型：校验酒店归属后插入 hotel_room
 */
export async function createRoom(
    hotelId: number,
    merhcantId: number,
    params: CreateRoomParams
): Promise<{ room_id: number }> {
    const [rows] = await pool.execute<any[]>(
        'SELECT id FROM hotel WHERE id = ? AND merchant_id = ? LIMIT 1',
        [hotelId, merhcantId]
    )
    if (!rows || rows.length === 0) {
        const err = new Error('酒店不存在或无权操作');
        (err as any).code = 'HOTEL_NOT_FOUND';
        throw err;
    }
    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO hotel_room (hotel_id, name, area, bed_type, max_guest, base_price, stock)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            hotelId,
            params.name ?? null,
            params.area ?? null,
            params.bed_type ?? null,
            params.max_guest ?? null,
            params.base_price ?? null,
            params.stock ?? null,
        ]
    );
    return { room_id: Number(result.insertId) };
}

/**
 * 获取当前商户的酒店详情（仅限本商户），用于编辑页回填
 */
export async function getHotelByMerchant(
    hotelId: number,
    merchantId: number
): Promise<MerchantHotelDetail | null> {
    const [hRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id AS hotel_id, name, star, city, address, latitude, longitude, description, opening_date, status
       FROM hotel WHERE id = ? AND merchant_id = ? LIMIT 1`,
        [hotelId, merchantId]
    );
    if (!hRows?.length) return null;

    const h = hRows[0];
    const [cRows] = await pool.execute<RowDataPacket[]>(
        'SELECT contact_type AS type, contact_value AS value, is_primary, remark FROM hotel_contact WHERE hotel_id = ? ORDER BY is_primary DESC',
        [hotelId]
    );
    const [iRows] = await pool.execute<RowDataPacket[]>(
        'SELECT image_url AS url, type, sort FROM hotel_image WHERE hotel_id = ? ORDER BY sort ASC',
        [hotelId]
    );
    const [fRows] = await pool.execute<RowDataPacket[]>(
        'SELECT facility_id FROM hotel_facility WHERE hotel_id = ?',
        [hotelId]
    );

    return {
        hotel_id: h.hotel_id,
        name: h.name,
        star: h.star,
        city: h.city,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        description: h.description,
        opening_date: h.opening_date ? String(h.opening_date) : null,
        status: h.status,
        contacts: (cRows || []).map((r) => ({
            type: r.type,
            value: r.value,
            is_primary: r.is_primary,
            remark: r.remark,
        })),
        images: (iRows || []).map((r) => ({ url: r.url, type: r.type, sort: r.sort })),
        facilities: (fRows || []).map((r) => r.facility_id),
    };
}

/** 商户提交酒店信息修改：仅需修改的字段（含 contacts/facilities/images，存 hotel_edit JSON 列） */
export interface SubmitHotelEditParams {
    name?: string;
    star?: number;
    city?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    description?: string;
    opening_date?: string | null;
    contacts?: Array<{
        type: 'phone' | 'email' | 'fax' | 'wechat';
        value: string;
        is_primary?: boolean;
        remark?: string;
    }>;
    facilities?: number[];
    images?: Array<{ url: string; type: 'cover' | 'detail' }>;
}

/**
 * 商户提交酒店信息修改（写入 hotel_edit，edit_status = pending）
 * 仅允许对本商户且 status = approved 的酒店提交；若已有 pending 修改则返回错误码
 * contacts/facilities/images 写入 contacts_edit/facilities_edit/images_edit（JSON）
 */
export async function submitHotelEdit(
    hotelId: number,
    merchantId: number,
    params: SubmitHotelEditParams
): Promise<{ hotel_edit_id: number }> {
    const [hRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id, status FROM hotel WHERE id = ? AND merchant_id = ? LIMIT 1',
        [hotelId, merchantId]
    );
    if (!hRows?.length) {
        const err = new Error('酒店不存在或无权操作');
        (err as any).code = 'HOTEL_NOT_FOUND';
        throw err;
    }
    if (hRows[0].status !== 'approved') {
        const err = new Error('仅已上线的酒店可提交修改');
        (err as any).code = 'HOTEL_NOT_APPROVED';
        throw err;
    }

    const [pendingRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM hotel_edit WHERE hotel_id = ? AND edit_status = ? LIMIT 1',
        [hotelId, 'pending']
    );
    if (pendingRows?.length) {
        const err = new Error('已有待审核修改，请等待审核结果');
        (err as any).code = 'EDIT_PENDING_EXISTS';
        throw err;
    }

    const contactsJson = Array.isArray(params.contacts) && params.contacts.length > 0
        ? JSON.stringify(params.contacts)
        : null;
    const facilitiesJson = Array.isArray(params.facilities) && params.facilities.length > 0
        ? JSON.stringify(params.facilities)
        : null;
    const imagesJson = Array.isArray(params.images) && params.images.length > 0
        ? JSON.stringify(params.images)
        : null;

    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO hotel_edit (hotel_id, name, star, city, address, latitude, longitude, description, opening_date, edit_status, contacts_edit, facilities_edit, images_edit)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
        [
            hotelId,
            params.name ?? null,
            params.star ?? null,
            params.city ?? null,
            params.address ?? null,
            params.latitude ?? null,
            params.longitude ?? null,
            params.description ?? null,
            params.opening_date ?? null,
            contactsJson,
            facilitiesJson,
            imagesJson,
        ]
    );
    return { hotel_edit_id: Number(result.insertId) };
}


/**
 * 按酒店 ID 获取详情（不校验归属），供管理端使用
 */
export async function getHotelById(hotelId: number): Promise<MerchantHotelDetail | null> {
    const [hRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id AS hotel_id, name, star, city, address, latitude, longitude, description, opening_date, status
         FROM hotel WHERE id = ? LIMIT 1`,
        [hotelId]
    );
    if (!hRows?.length) return null;

    const h = hRows[0];
    const [cRows] = await pool.execute<RowDataPacket[]>(
        'SELECT contact_type AS type, contact_value AS value, is_primary, remark FROM hotel_contact WHERE hotel_id = ? ORDER BY is_primary DESC',
        [hotelId]
    );
    const [iRows] = await pool.execute<RowDataPacket[]>(
        'SELECT image_url AS url, type, sort FROM hotel_image WHERE hotel_id = ? ORDER BY sort ASC',
        [hotelId]
    );
    const [fRows] = await pool.execute<RowDataPacket[]>(
        'SELECT facility_id FROM hotel_facility WHERE hotel_id = ?',
        [hotelId]
    );

    return {
        hotel_id: h.hotel_id,
        name: h.name,
        star: h.star,
        city: h.city,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        description: h.description,
        opening_date: h.opening_date ? String(h.opening_date) : null,
        status: h.status,
        contacts: (cRows || []).map((r) => ({
            type: r.type,
            value: r.value,
            is_primary: r.is_primary,
            remark: r.remark,
        })),
        images: (iRows || []).map((r) => ({ url: r.url, type: r.type, sort: r.sort })),
        facilities: (fRows || []).map((r) => r.facility_id),
    };
}



import pool from '../config/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2'

/** 将日期值格式化为 YYYY-MM-DD，避免返回 "Tue Jun 01" 等短格式 */
function toYYYYMMDD(val: any): string | null {
    if (val == null || val === '') return null;
    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

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
    rooms?: CreateHotelRoomItem[];
    hotel_type?: 'domestic' | 'overseas' | 'hourly' | 'guesthouse';
}

/** 商户创建酒店，创建后状态直接为 pending（待审核） */
export async function createHotel(
    merchantId: number,
    params: CreateHotelParams
): Promise<{ hotel_id: number }> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const hotelType = params.hotel_type && ['domestic', 'overseas', 'hourly', 'guesthouse'].includes(params.hotel_type)
            ? params.hotel_type
            : 'domestic';

        const [hResult] = await conn.execute<ResultSetHeader>(
            `INSERT INTO hotel (
            name, star, city, address, latitude, longitude, description, opening_date,
            hotel_type, merchant_id, status, rating, review_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0)`,
            [
                params.name,
                params.star ?? null,
                params.city,
                params.address,
                params.latitude ?? null,
                params.longitude ?? null,
                params.description ?? null,
                params.opening_date ?? null,
                hotelType,
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

        if (Array.isArray(params.rooms) && params.rooms.length > 0) {
            for (const room of params.rooms) {
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
                if (Array.isArray(room.images) && room.images.length > 0) {
                    for (let idx = 0; idx < room.images.length; idx++) {
                        const img = room.images[idx];
                        await conn.execute(
                            `INSERT INTO room_image (room_id, image_url, type, sort) VALUES (?, ?, ?, ?)`,
                            [roomId, img.url, img.type || 'detail', idx]
                        );
                    }
                }
                if (Array.isArray(room.tag_ids) && room.tag_ids.length > 0) {
                    for (const tagId of room.tag_ids) {
                        await conn.execute(`INSERT INTO hotel_room_tag (room_id, tag_id) VALUES (?, ?)`, [roomId, tagId]);
                    }
                }
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
    rooms?: Array<{
        room_id: number;
        name: string | null;
        area: number | null;
        bed_type: string | null;
        max_guest: number | null;
        base_price: number | null;
        stock: number | null;
        images: Array<{ url: string; type: string; sort: number }>;
        tag_ids: number[];
    }>;
}

/** 房型详情项（含图片、标签名） */
export interface RoomDetailItem {
    room_id: number;
    name: string | null;
    area: number | null;
    bed_type: string | null;
    max_guest: number | null;
    base_price: number | null;
    stock: number | null;
    images: Array<{ url: string; type: string; sort: number }>;
    tags: Array<{ id: number; name: string }>;
}
/** 管理端酒店详情（含房型列表、设施带名称） */
export interface AdminHotelDetail {
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
    facilities: Array<{ id: number; name: string }>;
    rooms: RoomDetailItem[];
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
    hotel_type: string | null;
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
    rooms_edit: unknown; 
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
        `SELECT id, hotel_id, name, hotel_type, star, city, address, latitude, longitude, 
                description, opening_date, edit_status, reject_reason, created_at, reviewed_at,
                contacts_edit, facilities_edit, images_edit, rooms_edit
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
        hotel_type: r.hotel_type ?? null,
        star: r.star,
        city: r.city,
        address: r.address,
        latitude: r.latitude,
        longitude: r.longitude,
        description: r.description,
        opening_date: toYYYYMMDD(r.opening_date),
        contacts_edit: r.contacts_edit != null ? (typeof r.contacts_edit === 'string' ? JSON.parse(r.contacts_edit) : r.contacts_edit) : null,
        facilities_edit: r.facilities_edit != null ? (typeof r.facilities_edit === 'string' ? JSON.parse(r.facilities_edit) : r.facilities_edit) : null,
        images_edit: r.images_edit != null ? (typeof r.images_edit === 'string' ? JSON.parse(r.images_edit) : r.images_edit) : null,
        rooms_edit: r.rooms_edit != null
        ? (typeof r.rooms_edit === 'string' ? JSON.parse(r.rooms_edit) : r.rooms_edit)
        : null,
    };
}

export type HotelType = 'domestic' | 'overseas' | 'hourly' | 'guesthouse';
export interface UserHotelListParams {
    hotel_type?: HotelType;
    city?: string;
    keyword?: string;
    star_min?: number;
    star_max?: number;
    price_min?: number;
    price_max?: number;
    facility_ids?: number[];
    sort?: 'price_asc' | 'price_desc' | 'rating_desc';
}
/** 用户端酒店列表项（酒店列表查询） */
export interface UserHotelListItem {
    hotel_id: number;
    name: string;
    star: number | null;
    rating: number;
    review_count: number;
    address: string;
    opening_date: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    cover_image: string | null;
    lowest_price: number | null;
    facilities: string[];
}

// 创建酒店时的每个房型项（图片、标签、id）
export interface CreateHotelRoomItem {
    name?: string;
    area?: number;
    bed_type?: string;
    max_guest?: number;
    base_price?: number;
    stock?: number;
    images?: Array<{ url: string; type: 'cover' | 'detail' }>;
    tag_ids?: number[];
}

/** 商户新增房型 */
export interface CreateRoomParams {
    name?: string;
    area?: number;
    bed_type?: string;
    max_guest?: number;
    base_price?: number;
    stock?: number;
    images?: Array<{ url: string; type: 'cover' | 'detail' }>;
    tag_ids?: number[];
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
    const roomId = Number(result.insertId);
    if (Array.isArray(params.images) && params.images.length > 0) {
        for (let idx = 0; idx < params.images.length; idx++) {
            const img = params.images[idx];
            await pool.execute(
                `INSERT INTO room_image (room_id, image_url, type, sort) VALUES (?, ?, ?, ?)`,
                [roomId, img.url, img.type || 'detail', idx]
            );
        }
    }
    if (Array.isArray(params.tag_ids) && params.tag_ids.length > 0) {
        for (const tagId of params.tag_ids) {
            await pool.execute(`INSERT INTO hotel_room_tag (room_id, tag_id) VALUES (?, ?)`, [roomId, tagId]);
        }
    }
    return { room_id: roomId };
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

    const [roomRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id AS room_id, name, area, bed_type, max_guest, base_price, stock FROM hotel_room WHERE hotel_id = ? ORDER BY id',
        [hotelId]
    );
    const roomsForMerchant: NonNullable<MerchantHotelDetail['rooms']> = [];
    if (roomRows?.length) {
        const roomIds = (roomRows as any[]).map((r) => r.room_id);
        const placeholders = roomIds.map(() => '?').join(',');
        const [roomImgRows] = await pool.execute<RowDataPacket[]>(
            `SELECT room_id, image_url AS url, type, sort FROM room_image WHERE room_id IN (${placeholders}) ORDER BY room_id, sort`,
            roomIds
        );
        const [roomTagRows] = await pool.execute<RowDataPacket[]>(
            `SELECT room_id, tag_id FROM hotel_room_tag WHERE room_id IN (${placeholders})`,
            roomIds
        );
        const imagesByRoom: Record<number, Array<{ url: string; type: string; sort: number }>> = {};
        const tagIdsByRoom: Record<number, number[]> = {};
        for (const r of roomImgRows || []) {
            const rid = r.room_id;
            if (!imagesByRoom[rid]) imagesByRoom[rid] = [];
            imagesByRoom[rid].push({ url: r.url, type: r.type || 'detail', sort: r.sort ?? 0 });
        }
        for (const r of roomTagRows || []) {
            const rid = r.room_id;
            if (!tagIdsByRoom[rid]) tagIdsByRoom[rid] = [];
            tagIdsByRoom[rid].push(r.tag_id);
        }
        for (const r of roomRows as any[]) {
            roomsForMerchant.push({
                room_id: r.room_id,
                name: r.name,
                area: r.area != null ? Number(r.area) : null,
                bed_type: r.bed_type,
                max_guest: r.max_guest != null ? Number(r.max_guest) : null,
                base_price: r.base_price != null ? Number(r.base_price) : null,
                stock: r.stock != null ? Number(r.stock) : null,
                images: imagesByRoom[r.room_id] || [],
                tag_ids: tagIdsByRoom[r.room_id] || [],
            });
        }
    }

    return {
        hotel_id: h.hotel_id,
        name: h.name,
        star: h.star,
        city: h.city,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        description: h.description,
        opening_date: toYYYYMMDD(h.opening_date),
        status: h.status,
        contacts: (cRows || []).map((r) => ({
            type: r.type,
            value: r.value,
            is_primary: r.is_primary,
            remark: r.remark,
        })),
        images: (iRows || []).map((r) => ({ url: r.url, type: r.type, sort: r.sort })),
        facilities: (fRows || []).map((r) => r.facility_id),
        rooms: roomsForMerchant,
    };
}

/** 商户提交酒店信息修改：仅需修改的字段（含 contacts/facilities/images，存 hotel_edit JSON 列） */
export interface SubmitHotelEditParams {
    name?: string;
    star?: number;
    hotel_type?: string;
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
    rooms?: Array<{
        room_id?: number;
        name?: string;
        area?: number;
        bed_type?: string;
        max_guest?: number;
        base_price?: number;
        stock?: number;
        images?: Array<{ url: string; type: 'cover' | 'detail' }>;
        tag_ids?: number[];
    }>
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

    const contactsJson = JSON.stringify(params.contacts ?? []);
    const facilitiesJson = JSON.stringify(params.facilities ?? []);
    const imagesJson = JSON.stringify(params.images ?? []);
    const roomsJson = JSON.stringify(params.rooms ?? []);

    const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO hotel_edit (
            hotel_id, name, star, hotel_type, city, address, latitude, longitude,
            description, opening_date, edit_status,
            contacts_edit, facilities_edit, images_edit, rooms_edit
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
        [
            hotelId,
            params.name ?? null,
            params.star ?? null,
            params.hotel_type ?? null,
            params.city ?? null,
            params.address ?? null,
            params.latitude ?? null,
            params.longitude ?? null,
            params.description ?? null,
            params.opening_date ?? null,
            contactsJson,
            facilitiesJson,
            imagesJson,
            roomsJson,
        ]
    );
    return { hotel_edit_id: Number(result.insertId) };
}


/**
 * 按酒店 ID 获取详情（不校验归属），供管理端使用
 */
export async function getHotelById(hotelId: number): Promise<AdminHotelDetail | null> {
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
        `SELECT f.id, f.name FROM hotel_facility hf INNER JOIN facility f ON hf.facility_id = f.id WHERE hf.hotel_id = ? ORDER BY f.name`,
        [hotelId]
    );
    const [roomRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id AS room_id, name, area, bed_type, max_guest, base_price, stock FROM hotel_room WHERE hotel_id = ? ORDER BY id',
        [hotelId]
    );

    const rooms: RoomDetailItem[] = [];

    if (roomRows?.length) {
        const roomIds = (roomRows as any[]).map((r) => r.room_id);
        const placeholders = roomIds.map(() => '?').join(',');
        const [imgRows] = await pool.execute<RowDataPacket[]>(
            `SELECT room_id, image_url AS url, type, sort FROM room_image WHERE room_id IN (${placeholders}) ORDER BY room_id, sort`,
            roomIds
        );
        const [tagRows] = await pool.execute<RowDataPacket[]>(
            `SELECT hrt.room_id, rt.id AS tag_id, rt.name AS tag_name FROM hotel_room_tag hrt INNER JOIN room_tag rt ON hrt.tag_id = rt.id WHERE hrt.room_id IN (${placeholders})`,
            roomIds
        );
        const imagesByRoom: Record<number, Array<{ url: string; type: string; sort: number }>> = {};
        const tagsByRoom: Record<number, Array<{ id: number; name: string }>> = {};
        for (const r of imgRows || []) {
            const rid = r.room_id;
            if (!imagesByRoom[rid]) imagesByRoom[rid] = [];
            imagesByRoom[rid].push({ url: r.url, type: r.type || 'detail', sort: r.sort ?? 0 });
        }
        for (const r of tagRows || []) {
            const rid = r.room_id;
            if (!tagsByRoom[rid]) tagsByRoom[rid] = [];
            tagsByRoom[rid].push({ id: r.tag_id, name: r.tag_name || '' });
        }
        for (const r of roomRows as any[]) {
            rooms.push({
                room_id: r.room_id,
                name: r.name,
                area: r.area != null ? Number(r.area) : null,
                bed_type: r.bed_type,
                max_guest: r.max_guest != null ? Number(r.max_guest) : null,
                base_price: r.base_price != null ? Number(r.base_price) : null,
                stock: r.stock != null ? Number(r.stock) : null,
                images: imagesByRoom[r.room_id] || [],
                tags: tagsByRoom[r.room_id] || [],
            });
        }
    }

    return {
        hotel_id: h.hotel_id,
        name: h.name,
        star: h.star,
        city: h.city,
        address: h.address,
        latitude: h.latitude,
        longitude: h.longitude,
        description: h.description,
        opening_date: toYYYYMMDD(h.opening_date),
        status: h.status,
        contacts: (cRows || []).map((r) => ({
            type: r.type,
            value: r.value,
            is_primary: r.is_primary,
            remark: r.remark,
        })),
        images: (iRows || []).map((r) => ({ url: r.url, type: r.type, sort: r.sort })),
        facilities: (fRows || []).map((r) => ({ id: r.id, name: r.name || '' })),
        rooms,
    };
}


/** 用户端酒店详情返回结构 */
export interface UserHotelDetail {
    hotel_id: number;
    name: string;
    star: number | null;
    rating: number;
    review_count: number;
    address: string;
    opening_date: string | null;
    description: string | null;
    contacts: Array<{ type: string; value: string; is_primary: number; remark: string | null }>;
    images: Array<{ url: string; type: string }>;
    facilities: string[];
    rooms: Array<{
        room_id: number;
        name: string;
        area: number | null;
        bed_type: string | null;
        max_guest: number | null;
        price_detail: Array<{ date: string; price: number; stock: number }>;
    }>;
    promotions: Array<{ promotion_id: number; source: string; type: string; discount: number | null; minus: number | null; description: string | null }>;
}

/**
 * 用户端：获取酒店详情（仅已上线），含房型价格日历、优惠
 * check_in、check_out 用于生成 price_detail
 */
export async function getUserHotelDetail(
    hotelId: number,
    checkIn: string,
    checkOut: string
): Promise<UserHotelDetail | null> {
    const [hRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id AS hotel_id, name, star, rating, review_count, city, address, latitude, longitude,
                description, opening_date
         FROM hotel WHERE id = ? AND status = 'approved' LIMIT 1`,
        [hotelId]
    );
    if (!hRows?.length) return null;

    const h = hRows[0];
    const [cRows] = await pool.execute<RowDataPacket[]>(
        'SELECT contact_type AS type, contact_value AS value, is_primary, remark FROM hotel_contact WHERE hotel_id = ? ORDER BY is_primary DESC',
        [hotelId]
    );
    const [iRows] = await pool.execute<RowDataPacket[]>(
        'SELECT image_url AS url, type FROM hotel_image WHERE hotel_id = ? ORDER BY sort ASC',
        [hotelId]
    );
    const [fRows] = await pool.execute<RowDataPacket[]>(
        `SELECT f.name FROM hotel_facility hf INNER JOIN facility f ON hf.facility_id = f.id WHERE hf.hotel_id = ? ORDER BY f.name`,
        [hotelId]
    );
    const facilities = (fRows || []).map((r: any) => r.name || '');

    const [roomRows] = await pool.execute<RowDataPacket[]>(
        'SELECT id AS room_id, name, area, bed_type, max_guest, base_price, stock FROM hotel_room WHERE hotel_id = ? ORDER BY id',
        [hotelId]
    );
    const rooms: UserHotelDetail['rooms'] = [];

    const startDate = new Date(checkIn + 'T00:00:00');
    const endDate = new Date(checkOut + 'T00:00:00');
    const dates: string[] = [];
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${day}`);
    }

    if (roomRows?.length && dates.length > 0) {
        const roomIds = (roomRows as any[]).map((r) => r.room_id);
        const placeholders = roomIds.map(() => '?').join(',');
        const datePlaceholders = dates.map(() => '?').join(',');
        const [calRows] = await pool.execute<RowDataPacket[]>(
            `SELECT room_id, date, price, stock FROM room_price_calendar
             WHERE room_id IN (${placeholders}) AND date IN (${datePlaceholders})`,
            [...roomIds, ...dates]
        );
        const calByRoomDate: Record<string, { price: number; stock: number }> = {};
        for (const r of calRows || []) {
            calByRoomDate[`${r.room_id}_${String(r.date).slice(0, 10)}`] = {
                price: Number(r.price) || 0,
                stock: Number(r.stock) || 0,
            };
        }

        for (const r of roomRows as any[]) {
            const priceDetail = dates.map((date) => {
                const key = `${r.room_id}_${date}`;
                const cal = calByRoomDate[key];
                const price = cal ? cal.price : (r.base_price != null ? Number(r.base_price) : 0);
                const stock = cal ? cal.stock : (r.stock != null ? Number(r.stock) : 0);
                return { date, price, stock };
            });
            rooms.push({
                room_id: r.room_id,
                name: r.name || '',
                area: r.area != null ? Number(r.area) : null,
                bed_type: r.bed_type ?? null,
                max_guest: r.max_guest != null ? Number(r.max_guest) : null,
                price_detail: priceDetail,
            });
        }
    } else {
        for (const r of roomRows || []) {
            const priceDetail = dates.map((date) => ({
                date,
                price: r.base_price != null ? Number(r.base_price) : 0,
                stock: r.stock != null ? Number(r.stock) : 0,
            }));
            rooms.push({
                room_id: r.room_id,
                name: r.name || '',
                area: r.area != null ? Number(r.area) : null,
                bed_type: r.bed_type ?? null,
                max_guest: r.max_guest != null ? Number(r.max_guest) : null,
                price_detail: priceDetail,
            });
        }
    }

    const [promoRows] = await pool.execute<RowDataPacket[]>(
        `SELECT id AS promotion_id, source, type, discount, minus, description
         FROM promotion
         WHERE hotel_id = ? AND start_time <= ? AND end_time >= ?`,
        [hotelId, checkOut + ' 23:59:59', checkIn + ' 00:00:00']
    );
    const promotions = (promoRows || []).map((p: any) => ({
        promotion_id: p.promotion_id,
        source: p.source || '',
        type: p.type || '',
        discount: p.discount != null ? Number(p.discount) : null,
        minus: p.minus != null ? Number(p.minus) : null,
        description: p.description ?? null,
    }));

    return {
        hotel_id: h.hotel_id,
        name: h.name || '',
        star: h.star ?? null,
        rating: Number(h.rating) || 0,
        review_count: Number(h.review_count) || 0,
        address: h.address || '',
        opening_date: toYYYYMMDD(h.opening_date),
        description: h.description ?? null,
        contacts: (cRows || []).map((r: any) => ({
            type: r.type,
            value: r.value,
            is_primary: r.is_primary,
            remark: r.remark,
        })),
        images: (iRows || []).map((r: any) => ({ url: r.url, type: r.type })),
        facilities,
        rooms,
        promotions,
    };
}

/**
 * 用户端：获取已上线酒店列表（仅提供数据，筛选与排序由前端完成）
 * lowest_price 取该酒店所有房型 base_price 的最小值
 */
/**
 * 用户端：获取酒店列表（仅已上线），按类型/城市/关键字/星级/价格/设施筛选，后端排序
 * hotel_type 默认 domestic（国内）
 */
export async function getUserHotelList(params: UserHotelListParams = {}): Promise<UserHotelListItem[]> {
    const {
        hotel_type = 'domestic',
        city,
        keyword,
        star_min,
        star_max,
        price_min,
        price_max,
        facility_ids,
        sort = 'price_asc',
    } = params;

    const conditions: string[] = ["h.status = 'approved'", "h.hotel_type = ?"];
    const values: any[] = [hotel_type];

    if (city?.trim()) {
        conditions.push('h.city LIKE ?');
        values.push(`%${city.trim()}%`);
    }
    if (keyword?.trim()) {
        conditions.push('(h.name LIKE ? OR h.address LIKE ?)');
        const k = `%${keyword.trim()}%`;
        values.push(k, k);
    }
    if (star_min != null && !Number.isNaN(star_min)) {
        conditions.push('h.star >= ?');
        values.push(star_min);
    }
    if (star_max != null && !Number.isNaN(star_max)) {
        conditions.push('h.star <= ?');
        values.push(star_max);
    }

    let facilitySubquery = '';
    if (Array.isArray(facility_ids) && facility_ids.length > 0) {
        const placeholders = facility_ids.map(() => '?').join(',');
        facilitySubquery = ` AND h.id IN (
        SELECT hotel_id FROM hotel_facility WHERE facility_id IN (${placeholders})
        GROUP BY hotel_id HAVING COUNT(DISTINCT facility_id) = ?
      )`;
        values.push(...facility_ids, facility_ids.length);
    }

    const sql = `
      SELECT h.id AS hotel_id, h.name, h.star, h.rating, h.review_count, h.city, h.address,
             h.latitude, h.longitude, h.opening_date,
             (SELECT MIN(hr.base_price) FROM hotel_room hr WHERE hr.hotel_id = h.id) AS lowest_price
      FROM hotel h
      WHERE ${conditions.join(' AND ')} ${facilitySubquery}
    `;
    const [rows] = await pool.execute<RowDataPacket[]>(sql, values);

    let list: (UserHotelListItem & { lowest_price: number | null })[] = (rows || []).map((r) => ({
        hotel_id: r.hotel_id,
        name: r.name || '',
        star: r.star ?? null,
        rating: Number(r.rating) || 0,
        review_count: Number(r.review_count) || 0,
        address: r.address || '',
        opening_date: toYYYYMMDD(r.opening_date),
        latitude: r.latitude,
        longitude: r.longitude,
        cover_image: null as string | null,
        lowest_price: r.lowest_price != null ? Number(r.lowest_price) : null,
        facilities: [] as string[],
    }));

    if (price_min != null && !Number.isNaN(price_min)) {
        list = list.filter((h) => h.lowest_price != null && h.lowest_price >= price_min);
    }
    if (price_max != null && !Number.isNaN(price_max)) {
        list = list.filter((h) => h.lowest_price != null && h.lowest_price <= price_max);
    }

    const sortKey = sort === 'rating_desc' ? 'rating' : 'lowest_price';
    const desc = sort === 'price_desc' || sort === 'rating_desc';
    list.sort((a, b) => {
        const aVal = a[sortKey as keyof typeof a] ?? (desc ? -Infinity : Infinity);
        const bVal = b[sortKey as keyof typeof b] ?? (desc ? -Infinity : Infinity);
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return desc ? bVal - aVal : aVal - bVal;
        }
        return 0;
    });

    if (list.length === 0) return list.map(({ lowest_price, ...rest }) => ({ ...rest, lowest_price }));

    const hotelIds = list.map((h) => h.hotel_id);
    const placeholders = hotelIds.map(() => '?').join(',');

    const [coverRows] = await pool.execute<RowDataPacket[]>(
        `SELECT hotel_id, image_url FROM hotel_image
       WHERE hotel_id IN (${placeholders}) AND type = 'cover' ORDER BY sort ASC`,
        hotelIds
    );
    const coverByHotel: Record<number, string> = {};
    for (const r of coverRows || []) {
        if (coverByHotel[r.hotel_id] == null) coverByHotel[r.hotel_id] = r.image_url || '';
    }

    const [facRows] = await pool.execute<RowDataPacket[]>(
        `SELECT hf.hotel_id, f.name AS facility_name
       FROM hotel_facility hf INNER JOIN facility f ON hf.facility_id = f.id
       WHERE hf.hotel_id IN (${placeholders})
       ORDER BY hf.hotel_id, f.name`,
        hotelIds
    );
    const facilitiesByHotel: Record<number, string[]> = {};
    for (const r of facRows || []) {
        if (!facilitiesByHotel[r.hotel_id]) facilitiesByHotel[r.hotel_id] = [];
        facilitiesByHotel[r.hotel_id].push(r.facility_name || '');
    }

    return list.map(({ lowest_price, ...rest }) => ({
        ...rest,
        cover_image: coverByHotel[rest.hotel_id] ?? null,
        lowest_price,
        facilities: facilitiesByHotel[rest.hotel_id] ?? [],
    }));
}
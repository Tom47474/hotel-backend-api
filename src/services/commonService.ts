import pool from '../config/db.js';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bucketSDK = require('../lib/bucketSDK.js');

const HOLIDAY_API = 'https://holiday.ailcc.com/api/holiday/year';

export interface HolidayItem {
    date: string;
    name: string | null;
    type: string;
}

export interface BannerItem {
    id: number;
    image_url: string;
    hotel_id: number;
    title: string | null;
}

export interface FacilityItem {
    id: number;
    name: string;
}

export interface GeolocationItem {
    lng: number,
    lat: number
}

export interface RoomLabelItem {
    id: number;
    name: string;
}

/** 根据 API 返回的 name、date、holiday 推断 type */
function inferHolidayType(dateStr: string, name: string, isHoliday: boolean): string {
    const n = (name || '').trim();
    if (/调休|补班|补休/.test(n)) return 'adjusted_weekend';
    if (isHoliday) {
        if (/元旦|春节|清明|劳动|端午|中秋|国庆/.test(n)) return 'legal';
        const d = new Date(dateStr);
        const day = d.getDay();
        if (day === 0 || day === 6) return 'normal_weekend';
        return 'legal';
    }
    return 'festival';
}

/** 从公开 API 拉取某年数据并刷表 */
export async function syncHolidayFromPublicApi(year?: number): Promise<{ count: number }> {
    const y = year ?? new Date().getFullYear();
    const res = await fetch(`${HOLIDAY_API}/${y}`);
    const json = await res.json();
    if (json.code !== 0 || !json.holiday || typeof json.holiday !== 'object') {
        throw new Error('公开 API 返回异常');
    }
    let count = 0;
    for (const key of Object.keys(json.holiday)) {
        const item = json.holiday[key];
        const date = item.date;
        const name = item.name ?? null;
        const isHoliday = item.holiday === true ? 1 : 0;
        const isWorkday = isHoliday === 1 ? 0 : 1;
        const type = inferHolidayType(date, name || '', item.holiday === true);
        await pool.execute(
            `INSERT INTO holiday_calendar (date, name, type, is_holiday, is_workday, source)
       VALUES (?, ?, ?, ?, ?, 'api')
       ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type),
       is_holiday = VALUES(is_holiday), is_workday = VALUES(is_workday), source = 'api'`,
            [date, name, type, isHoliday, isWorkday]
        );
        count++;
    }
    return { count };
}

/** 供前端调用的节假日列表（读表） */
export async function getHolidayCalendar(): Promise<HolidayItem[]> {
    const [rows] = await pool.execute<any[]>(
        `SELECT date, name, type FROM holiday_calendar WHERE is_holiday = 1 ORDER BY date ASC`
    );
    return (rows || []).map((r) => ({
        date: r.date ? String(r.date).slice(0, 10) : '',
        name: r.name ?? null,
        type: r.type ?? 'legal',
    }));
}


// ========== 酒店周边 POI（数据库 + 高德） ==========

export interface PoiItem {
    poi_id: number;
    name: string | null;
    type: string;
    distance: number;
}

/** 高德 type 字符串映射为 scenic | traffic | mall */
function mapAmapType(amapType: string): string {
    if (!amapType) return 'scenic';
    if (/地铁|公交|交通|火车站|机场|地铁站|公交站/.test(amapType)) return 'traffic';
    if (/商场|购物|商业|超市|便利店/.test(amapType)) return 'mall';
    return 'scenic';
}

/** 从数据库读取该酒店已关联的 POI */
async function getHotelPoiFromDb(hotelId: number): Promise<PoiItem[]> {
    const [rows] = await pool.execute<any[]>(
        `SELECT p.id AS poi_id, p.name, p.type, hp.distance
       FROM hotel_poi hp
       INNER JOIN poi p ON hp.poi_id = p.id
       WHERE hp.hotel_id = ?
       ORDER BY hp.distance ASC`,
        [hotelId]
    );
    return (rows || []).map((r) => ({
        poi_id: Number(r.poi_id),
        name: r.name ?? '',
        type: r.type ?? 'scenic',
        distance: Number(r.distance) || 0,
    }));
}

/** 调用高德周边搜索，并写入 poi + hotel_poi */
async function fetchAndSaveHotelPoiFromAmap(hotelId: number, lng: number, lat: number): Promise<PoiItem[]> {
    const key = process.env.AMAP_POI_KEY;
    if (!key) return [];
    const url = `https://restapi.amap.com/v3/place/around?key=${encodeURIComponent(key)}&location=${lng},${lat}&radius=5000&types=110000|150000|120300`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== '1' || !Array.isArray(json.pois)) return [];

    const results: PoiItem[] = [];
    for (const p of json.pois.slice(0, 20)) {
        const name = p.name ?? '';
        const type = mapAmapType(p.type ?? '');
        const distance = parseInt(p.distance, 10) || 0;
        const [lonStr, latStr] = (p.location || '').split(',');
        const longitude = lonStr ? parseFloat(lonStr) : null;
        const latitude = latStr ? parseFloat(latStr) : null;
        const address = p.address ?? null;

        const [insertResult] = await pool.execute<any>(
            `INSERT INTO poi (name, type, address, latitude, longitude, source, updated_at)
         VALUES (?, ?, ?, ?, ?, 'gaode', NOW())`,
            [name, type, address, latitude, longitude]
        );
        const poiId = (insertResult as any).insertId;
        if (!poiId) continue;

        await pool.execute(
            `INSERT INTO hotel_poi (hotel_id, poi_id, distance) VALUES (?, ?, ?)`,
            [hotelId, poiId, distance]
        );
        results.push({ poi_id: poiId, name, type, distance });
    }
    return results;
}

/**
 * 酒店周边 POI：先查库，无数据则调高德并落库后返回（数据库 + 高德）
 */
export async function getHotelPoi(hotelId: number): Promise<PoiItem[]> {
    const fromDb = await getHotelPoiFromDb(hotelId);
    if (fromDb.length > 0) return fromDb;

    const [rows] = await pool.execute<any[]>(
        'SELECT latitude, longitude FROM hotel WHERE id = ? AND status = ? LIMIT 1',
        [hotelId, 'approved']
    );
    if (!rows?.length || rows[0].latitude == null || rows[0].longitude == null) {
        return [];
    }
    const lat = Number(rows[0].latitude);
    const lng = Number(rows[0].longitude);
    return fetchAndSaveHotelPoiFromAmap(hotelId, lng, lat);
}


export async function getHomeBanners(): Promise<BannerItem[]> {
    const [rows] = await pool.execute<any[]>(
        `SELECT id, image_url, hotel_id, title
       FROM banner
       WHERE status = 'active'
       ORDER BY sort_order ASC, id ASC`
    );
    return (rows || []).map((r) => ({
        id: Number(r.id),
        image_url: r.image_url || '',
        hotel_id: Number(r.hotel_id),
        title: r.title ?? null,
    }));
}

export async function getHotelFcilities(): Promise<FacilityItem[]> {
    const [rows] = await pool.execute<any[]>(
        `SELECT id, name FROM facility`
    );
    return (rows || []).map((r) => ({
        id: Number(r.id),
        name: r.name || '',
    }))
}

/** 高德地图地理编码，需要传入地址信息，返回经纬度（用户商户上传酒店地址，获取经纬度保存到数据库） */

export async function getGeoLocation(city: string, address: string): Promise<GeolocationItem> {
    const key = process.env.AMAP_POI_KEY;
    if (!key) return { lng: 0, lat: 0 };
    const url = `https://restapi.amap.com/v3/geocode/geo?address=${address}&city=${city}&count=1&output=JSON&key=${key}`
    const res = await fetch(url);
    const json = await res.json();
    // console.log("高德返回 --->", JSON.stringify(json));
    const location = json.geocodes?.[0]?.location;
    const [lng, lat] = location.split(",").map(Number);
    return { lng, lat };
}

/** 高德地图逆地理编码  需要传入经纬度，返回的是地址信息，用于用户的定位（显示用户的地址） */
export async function getCurrentLocation(lng: string, lat: string): Promise<string> {
    const key = process.env.AMAP_POI_KEY;
    if (!key) return "";
    const url = `https://restapi.amap.com/v3/geocode/regeo?output=JSON&location=${lng},${lat}&key=${key}&poitype=&radius=&extensions=all&roadlevel=0`;
    const res = await fetch(url);
    const json = await res.json();
    return json;

}

export async function uploadImages(files: Express.Multer.File[]): Promise<string[]> {
    const SecretId = process.env.COS_SECRET_ID;
    const SecretKey = process.env.COS_SECRET_KEY;
    const Bucket = process.env.COS_BUCKET;
    const Region = process.env.COS_REGION;

    if (!SecretId || !SecretKey || !Bucket || !Region) {
        throw new Error('COS 配置缺失，请检查环境变量');
    }

    const urls: string[] = [];

    for (const file of files) {
        const ext = path.extname(file.originalname) || '.jpg';
        const objectKey = `uploads/hotels/${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
        const contentType = file.mimetype || 'image/jpeg';
        const contentLength = file.buffer.length;

        const authorization = bucketSDK.getAuth({
            SecretId,
            SecretKey,
            Bucket,
            Region,
            Key: objectKey,
            method: 'put',
            Headers: {
                'Content-Type': contentType,
                'Content-Length': contentLength,
            },
        });

        const cosPutUrl = `https://${Bucket}.cos.${Region}.myqcloud.com/${encodeURIComponent(objectKey).replace(/%2F/g, '/')}`;

        const putRes = await fetch(cosPutUrl, {
            method: 'PUT',
            headers: {
                Authorization: authorization,
                'Content-Type': contentType,
                'Content-Length': String(contentLength),
            },
            body: file.buffer,
        });

        if (!putRes.ok) {
            const errText = await putRes.text();
            throw new Error(`COS 上传失败: ${putRes.status} ${errText}`);
        }

        urls.push(`https://${Bucket}.cos.${Region}.myqcloud.com/${objectKey}`);
    }

    return urls;
}

export async function getRoomLabels(): Promise<RoomLabelItem[]> {
    const [rows] = await pool.execute<any[]>(
        `SELECT id, name FROM room_tag`
    );
    return (rows || []).map((r) => ({
        id: Number(r.id),
        name: r.name || '',
    }))
}
import pool from '../config/db.js';
import type { ResultSetHeader } from 'mysql2';

/** 商户创建优惠：请求体 */
export interface CreatePromotionParams {
  type: 'discount' | 'minus' | 'bundle';
  discount?: number | null;
  minus?: number | null;
  description?: string;
  start_time: string; // 如 "2026-02-01T00:00:00"
  end_time: string;
  scenes?: Array<'holiday' | 'weekday' | 'weekend' | 'member'>;
}

/**
 * 商户为自家酒店创建优惠：校验酒店归属后插入 promotion + promotion_scene
 */
export async function createPromotion(
  merchantId: number,
  hotelId: number,
  params: CreatePromotionParams
): Promise<{ promotion_id: number }> {
  const [rows] = await pool.execute<any[]>(
    'SELECT id FROM hotel WHERE id = ? AND merchant_id = ? LIMIT 1',
    [hotelId, merchantId]
  );
  if (!rows || rows.length === 0) {
    const err = new Error('酒店不存在或无权操作');
    (err as any).code = 'HOTEL_NOT_FOUND';
    throw err;
  }

  const [result] = await pool.execute<ResultSetHeader>(
    `INSERT INTO promotion (source, hotel_id, type, discount, minus, description, start_time, end_time, created_by)
     VALUES ('merchant', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hotelId,
      params.type,
      params.discount ?? null,
      params.minus ?? null,
      params.description ?? null,
      params.start_time,
      params.end_time,
      merchantId,
    ]
  );
  const promotionId = Number(result.insertId);

  if (Array.isArray(params.scenes) && params.scenes.length > 0) {
    for (const scene of params.scenes) {
      await pool.execute(
        `INSERT INTO promotion_scene (promotion_id, scene_type) VALUES (?, ?)`,
        [promotionId, scene]
      );
    }
  }

  return { promotion_id: promotionId };
}
import pool from '../config/db.js';

const HOLIDAY_API = 'https://holiday.ailcc.com/api/holiday/year';

export interface HolidayItem {
  date: string;
  name: string | null;
  type: string;
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
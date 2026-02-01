import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';


// service处理业务逻辑：密码哈希、查库、校验密码、生成 JWT；用 pool.execute() 访问数据库

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-change-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

export async function register(params: {
  username: string;
  password: string;
  role: 'user' | 'merchant' | 'admin';
}) {
  const { username, password, role } = params;
  const hash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    const [result] = await pool.execute<import('mysql2').ResultSetHeader>(
      'INSERT INTO user (username, password, role, status) VALUES (?, ?, ?, 1)',
      [username, hash, role]
    );
    const userId = result.insertId;
    return { user_id: userId, username, role };
  } catch (err: any) {
    if (err.code === 'ER_DUP_ENTRY') throw Object.assign(new Error('用户名已存在'), { code: 'DUPLICATE_USERNAME' });
    throw err;
  }
}

export async function login(username: string, password: string) {
  const [rows] = await pool.execute<any[]>(
    'SELECT id, username, password, role, status FROM user WHERE username = ? LIMIT 1',
    [username]
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('用户名或密码错误'), { code: 'INVALID_CREDENTIALS' });
  if (user.status !== 1) throw Object.assign(new Error('账号已禁用'), { code: 'USER_DISABLED' });

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw Object.assign(new Error('用户名或密码错误'), { code: 'INVALID_CREDENTIALS' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET as jwt.Secret,
    { expiresIn: JWT_EXPIRES } as jwt.SignOptions
  );
  return {
    token,
    user_id: user.id,
    username: user.username,
    role: user.role,
  };
}
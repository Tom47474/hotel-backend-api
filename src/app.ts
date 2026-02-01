import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';

const app = express();
const PORT = process.env.PORT || 4090;

app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.use((_req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ code: 500, message: err.message || '服务器错误', data: null });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
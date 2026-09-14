import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as path from 'path';
import * as fs from 'fs';

// 로컬 전용 .env (프로덕션/Compose는 process.env 주입 — dotenv 패키지 불필요)
const localEnvPath = path.join(__dirname, '../dotenv/.env.local');
if (fs.existsSync(localEnvPath)) {
  try {
    // optional: local only
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('dotenv').config({ path: localEnvPath });
  } catch {
    /* dotenv not installed in prod image */
  }
}

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USER_NAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [path.join(__dirname, '/**/entities/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, '/migrations/*{.ts,.js}')],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  connectorPackage: 'mysql2',
});

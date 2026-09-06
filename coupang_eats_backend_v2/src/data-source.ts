import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as path from 'path';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// 로컬: dotenv/.env.local, ECS: Task Definition으로 주입된 process.env 우선
const localEnvPath = path.join(__dirname, '../dotenv/.env.local');
if (fs.existsSync(localEnvPath)) {
  dotenv.config({ path: localEnvPath });
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

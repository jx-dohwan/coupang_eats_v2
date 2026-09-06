import { config } from 'dotenv';
import * as path from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SeederOptions } from 'typeorm-extension';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

const configDataSource = async () => {
  console.log('NODE_ENV', process.env.NODE_ENV);
  const nodeEnv = process.env.NODE_ENV ?? 'local';
  config({ path: `./dotenv/.env.${nodeEnv}` });

  const isLocal = nodeEnv === 'local';

  const options: DataSourceOptions & SeederOptions = {
    type: 'mysql',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '', 10),
    username: process.env.DB_USER_NAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [path.join(__dirname + '/src/entities/*/*.entity.ts')],
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: isLocal, // local 환경이면 true, 아니면 false (배포 환경 실수 방지)
    logging: true,
    migrations: [__dirname + '/src/core/database/typeorm/migrations/*.ts'],
    migrationsRun: false,
    migrationsTableName: 'migrations',
    migrationsTransactionMode: 'each',
    seeds: [__dirname + '/src/core/database/typeorm/seeds/*.seeder.ts'],
    seedTracking: false,
    factories: [
      __dirname + '/src/core/database/typeorm/seeds/factories/**/*.ts',
    ],
  };

  return options;
};

export default configDataSource().then((opt) => new DataSource(opt));

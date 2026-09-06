export enum Env {
  test = 'test',
  local = 'local',
  dev = 'dev',
  prod = 'prod',
}

export interface AppConfig {
  PORT: string | number | null;
  BASE_URL: string;
  NODE_ENV: string;
  ENV: Env;
  NAME: string;
}

export interface RedisConfig {
  HOST: string;
  PORT: number | string;
}

export interface DBConfig {
  DB_HOST: string;
  DB_USER_NAME: string;
  DB_PASSWORD: string;
  DB_DATABASE: string;
  DB_PORT: number | string;
}

export interface JwtConfig {
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRATION: string;
  JWT_REFRESH_EXPIRATION: string;
}

export interface AwsConfig {
  REGION: string;
  S3_BUCKET_NAME: string;
  SES_SENDER_EMAIL: string;
  /** CloudFront URL (https://xxxx.cloudfront.net). 없으면 S3 직접 URL fallback */
  CDN_URL: string;
}

export interface Configurations {
  APP: AppConfig;
  DB: DBConfig;
  REDIS: RedisConfig;
  JWT: JwtConfig;
  AWS: AwsConfig;
}

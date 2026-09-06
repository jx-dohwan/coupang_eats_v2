import * as dotenv from 'dotenv';
import * as path from 'path';

// 1. JWT 비밀키 설정 (에러가 나던 원인 해결)
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-1234';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-1234';
process.env.JWT_ACCESS_EXPIRATION = '1h'; // 1시간
process.env.JWT_REFRESH_EXPIRATION = '7d'; // 7일
// 2. 데이터베이스 설정 (도커 mysql-test 컨테이너 정보와 일치시킴)
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3307';  // 중요: .env.local(3306) 대신 3307 사용
process.env.DB_USER_NAME = 'test';
process.env.DB_PASSWORD = 'admin';
process.env.DB_DATABASE = 'coupang_test'; // 중요: 테스트용 DB 이름

// 3. 기타 설정
process.env.NODE_ENV = 'test';
process.env.AWS_REGION = 'ap-northeast-2';
process.env.AWS_S3_BUCKET_NAME='coupang-eats-uploads-prod';
process.env.AWS_SES_SENDER_EMAIL='jx7789@naver.com';
process.env.BASE_URL='http://localhost:3000';

console.log('✅ [Test Setup] 환경변수가 강제로 설정되었습니다 (Memory)');
console.log(`   - JWT Secret: ${process.env.JWT_ACCESS_SECRET}`);
console.log(`   - DB Connection: ${process.env.DB_HOST}:${process.env.DB_PORT} / DB: ${process.env.DB_DATABASE}`);
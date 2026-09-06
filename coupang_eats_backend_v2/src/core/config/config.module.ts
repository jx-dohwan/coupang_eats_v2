import { Global, Module } from '@nestjs/common';
import { ConfigModule as ConModule } from '@nestjs/config';
import { configurations } from './configuration';
import { MoinConfigService } from './config.service';

@Global()
@Module({
  imports: [
    ConModule.forRoot({
      envFilePath: [`dotenv/.env.${process.env.NODE_ENV}`],
      load: [configurations],
    }),
  ],
  providers: [MoinConfigService],
  exports: [MoinConfigService],
})
export class ConfigModule {}

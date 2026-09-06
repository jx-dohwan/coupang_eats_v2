import { IsString } from 'class-validator';

export class RefreshBody {
  @IsString()
  refreshToken: string;
}

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { AccessTokenGuard } from '../../core/guard/accessToken.guard';
import { RolesGuard } from '../../core/guard/roles.guard';
import { Roles } from '../../core/decorator/roles.decorator';
import { Role } from '../../entities/user/user.interface';
import { CurrentUser } from '../../core/decorator/currentUser.decorator';
import { User } from '../../entities/user/user.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ApiTags } from '@nestjs/swagger';
import { ApiDocCreated } from '../../core/decorator/swagger.decorator';
import { PaymentEntity } from '../../entities/payment/payment.entity';

@ApiTags('Payment (결제)')
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiDocCreated('결제 내역 생성 (검증)', PaymentEntity)
  @Post()
  @UseGuards(AccessTokenGuard, RolesGuard)
  @Roles(Role.CLIENT)
  async createPayment(
    @CurrentUser() user: User,
    @Body() createPaymentDto: CreatePaymentDto,
  ) {
    return this.paymentService.processPayment(user, createPaymentDto);
  }
}

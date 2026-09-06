import { Module } from "@nestjs/common";
import { TypeOrmExModule } from "../../../../libs/common/typeorm.ex/typeorm-ex.module";
import { UserRepository } from "./user.repository";

@Module({
    imports: [TypeOrmExModule.forCustomRepository([UserRepository])],
    exports: [TypeOrmExModule.forCustomRepository([UserRepository])],
})

export class UserRepositoryModule {}
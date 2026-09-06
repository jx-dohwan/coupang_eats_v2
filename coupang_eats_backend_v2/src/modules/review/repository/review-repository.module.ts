import { Module } from "@nestjs/common";
import { TypeOrmExModule } from "../../../../libs/common/typeorm.ex/typeorm-ex.module";
import { ReviewRepository } from "./review.repository";

@Module({
    imports: [TypeOrmExModule.forCustomRepository([ReviewRepository])],
    exports: [TypeOrmExModule.forCustomRepository([ReviewRepository])],
})

export class ReviewRepositoryModule {}

import { CustomRepository } from "../../../../libs/common/typeorm.ex/typeorm-ex.decorator";
import { GenericTypeOrmRepository } from "../../../core/database/typeorm/generic-typeorm.repository";
import { User } from "../../../entities/user/user.entity";

@CustomRepository(User)
export class UserRepository extends GenericTypeOrmRepository<User> {}
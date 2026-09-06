import { PartialType } from "@nestjs/swagger";
import { CreateDishDto } from "./create-dish.dto";

// CreateDishDto의 모든 속성을 가져오되, 전부 선택 사항으로 변경
export class UpdateDishDto extends PartialType(CreateDishDto){}
import { ApiProperty } from '@nestjs/swagger';

// 1. 내부 선택지(choices)를 위한 클래스를 먼저 정의합니다.
export class DishChoice {
  @ApiProperty({ description: '선택지 이름', example: '매운맛' })
  name: string;

  @ApiProperty({ description: '선택 시 추가 금액', example: 500 })
  extra: number;
}

// 2. DishOption 클래스 정의
export class DishOption {
  @ApiProperty({ description: '옵션 그룹 이름', example: '맵기 선택' })
  name: string;

  @ApiProperty({ description: '기본 추가 금액', example: 0 })
  extra: number;

  @ApiProperty({
    description: '하위 선택지 목록 (Optional)',
    type: [DishChoice], // 👈 [중요] 위에서 만든 클래스의 배열임을 명시
    required: false,    // Optional 표시
  })
  choices?: DishChoice[];
}
import { Expose } from 'class-transformer';
import {
  BeforeInsert,
  CreateDateColumn,
  DeleteDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

export class BaseTimeEntity {
  @Expose() // API 응답 등으로 변환(transform)될 때 이 필드를 노출한다.
  @CreateDateColumn({ type: 'timestamp', update: false }) // 한 번 생성되면 다시는 이 컬럼이 업데이트되지 않도록 설정
  createdAt: Date;

  @Expose()
  @UpdateDateColumn({ type: 'timestamp' }) // 엔티티가 수정될 때마다 시간이 자동으로 갱신
  updatedAt: Date;

  @Expose()
  @DeleteDateColumn({ type: 'timestamp', nullable: true }) // 평소에는 Null값을 가질 수 있어야 한다. | 소프트 삭제
  deletedAt: Date | null;
}

export class UuidEntity extends BaseTimeEntity {
  @Expose()
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @BeforeInsert() // TypeOrm의 생명주기이다. INSERT 쿼리가 실행되기 직전에 이 메서드가 자동으로 호출된다.
  generateUuid() {
    if (!this.id) this.id = v4();
  }
}

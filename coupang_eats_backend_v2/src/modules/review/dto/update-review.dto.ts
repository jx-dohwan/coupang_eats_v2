import { PartialType, PickType } from '@nestjs/swagger';
import { CreateReviewDto } from './create-review.dto';

// CreateReviewDto에서 score, reviewText, reviewImg만 뽑아내고(Pick), 그것들을 전부 Optional로 만듦(Partial)
export class UpdateReviewDto extends PartialType(
  PickType(CreateReviewDto, ['score', 'reviewText', 'reviewImg'] as const),
) {}

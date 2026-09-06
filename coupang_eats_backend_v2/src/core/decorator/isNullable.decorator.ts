import { applyDecorators } from '@nestjs/common';
import { ValidateIf, ValidationOptions } from 'class-validator';

/**
 * 해당 필드에 null 값이 들어오는 것을 허용한다.
 * @param validationOptions 
 * @returns 
 */
export function IsNullable(validationOptions?: ValidationOptions) {
  return applyDecorators(
    // 값이 null이 아닐 때만 유효성 검사를 수행한다. 즉, null이면 통과
    ValidateIf((object, value) => value !== null, validationOptions),
  );
}

import { ApiProperty } from "@nestjs/swagger";
import { IsInt, Min } from "class-validator";

export class ExtendTokenDto {
    @ApiProperty({
      description: 'Number of days to extend',
      example: 30,
      minimum: 1,
    })
    @IsInt()
    @Min(1)
    additionalDays: number;
  }
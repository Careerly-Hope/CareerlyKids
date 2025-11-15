import { ApiProperty } from '@nestjs/swagger';

export class StartTestResponseDto {
  @ApiProperty({
    description: 'Unique session token for this test',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  sessionToken: string;

  @ApiProperty({
    description: 'Session expiration timestamp',
    example: '2024-01-16T12:00:00.000Z',
  })
  expiresAt: string;

  @ApiProperty({
    description: 'Array of 60 randomized RIASEC questions',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        text: { type: 'string', example: 'Build kitchen cabinets' },
        category: { type: 'string', example: 'R' },
      },
    },
  })
  questions: Array<{
    id: number;
    text: string;
    category: string;
  }>;
}

import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole, SelfRegistrationRole, RoleGroups } from '../../../../common/enums/user-role.enum';

export class RegisterDto {
  @ApiProperty({
    description: 'User role selection (only STUDENT and ADMIN allowed during self-registration)',
    enum: RoleGroups.SELF_REGISTRATION,
    example: UserRole.STUDENT,
    required: true,
  })
  @IsEnum(UserRole, { 
    message: `Role must be one of: ${RoleGroups.SELF_REGISTRATION.join(', ')}` 
  })
  @IsNotEmpty()
  role: SelfRegistrationRole; 

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @ApiProperty({
    description: 'First name',
    example: 'John',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiProperty({
    description: 'School name (required for STUDENT role)',
    example: 'Loyola Jesuit College',
    required: false,
  })
  @IsOptional()
  @IsString()
  school?: string;
}
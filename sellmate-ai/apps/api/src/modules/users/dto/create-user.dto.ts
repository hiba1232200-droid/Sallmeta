import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { IsStrongPassword } from '../../../common/security/password.decorator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsStrongPassword()
  password!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

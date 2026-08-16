import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/security/password.decorator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  storeName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsStrongPassword()
  password!: string;
}

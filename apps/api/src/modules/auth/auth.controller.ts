import { Controller, Post, Get, Patch, Body, UseGuards, Request, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto, @Ip() ip: string, @Headers('user-agent') ua: string) {
    return this.authService.login(dto, ip, ua);
  }

  @Post('login/mfa')
  verifyMfa(
    @Body() body: { tempToken: string; totp: string },
    @Ip() ip: string,
    @Headers('user-agent') ua: string,
  ) {
    return this.authService.verifyMfa(body.tempToken, body.totp, ip, ua);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  setupMfa(@Request() req: any) {
    return this.authService.setupMfa(req.user.sub);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enableMfa(@Request() req: any, @Body() body: { totp: string }) {
    return this.authService.enableMfa(req.user.sub, req.user.companyId, body.totp);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  disableMfa(@Request() req: any, @Body() body: { password: string }) {
    return this.authService.disableMfa(req.user.sub, req.user.companyId, body.password);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePassword(
    @Request() req: any,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.sub, req.user.companyId, body.oldPassword, body.newPassword);
  }
}

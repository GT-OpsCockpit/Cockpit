import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';
import { VerifyPasswordDto } from './dto/verify-password.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { SESSION_COOKIE_NAME } from '../common/guards/session-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Public()
  @Post('verify')
  verify(@Body() dto: VerifyDto, @Res({ passthrough: true }) res: Response) {
    return this.authService.verify(dto.email, dto.code, res);
  }

  @Post('verify-password')
  verifyPassword(
    @Body() dto: VerifyPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.authService.verifyPassword(user.id, dto.password);
  }

  @Public()
  @Post('logout')
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sessionId = (req.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE_NAME
    ];
    return this.authService.logout(sessionId, res);
  }
}

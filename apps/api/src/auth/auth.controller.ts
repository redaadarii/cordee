import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type AuthDto,
  type ChangePasswordInput,
  changePasswordSchema,
  type ForgotPasswordInput,
  forgotPasswordSchema,
  type LoginInput,
  loginSchema,
  type RegisterWithInviteInput,
  registerWithInviteSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@cordee/shared';
import type { Request, Response } from 'express';
import { Public, UserId } from '../common/auth.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { env } from '../config/env.js';
import { AuthService, type Session } from './auth.service.js';

const REFRESH_COOKIE = 'cordee_rt';
const COOKIE_PATH = '/api/v1/auth';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body(new ZodPipe(registerWithInviteSchema)) body: RegisterWithInviteInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthDto> {
    return this.respond(res, await this.auth.register(body));
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthDto> {
    return this.respond(res, await this.auth.login(body));
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthDto> {
    return this.respond(res, await this.auth.refresh(req.cookies?.[REFRESH_COOKIE]));
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, { path: COOKIE_PATH });
  }

  @Get('me')
  me(@UserId() userId: string) {
    return this.auth.me(userId);
  }

  @Patch('me')
  updateProfile(@UserId() userId: string, @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput) {
    return this.auth.updateProfile(userId, body.name);
  }

  @HttpCode(200)
  @Post('password')
  async changePassword(
    @UserId() userId: string,
    @Body(new ZodPipe(changePasswordSchema)) body: ChangePasswordInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthDto> {
    return this.respond(res, await this.auth.changePassword(userId, body));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(204)
  @Post('forgot-password')
  forgotPassword(@Body(new ZodPipe(forgotPasswordSchema)) body: ForgotPasswordInput) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(204)
  @Post('reset-password')
  resetPassword(@Body(new ZodPipe(resetPasswordSchema)) body: ResetPasswordInput) {
    return this.auth.resetPassword(body);
  }

  // Le jeton de rafraîchissement ne quitte jamais le cookie httpOnly :
  // le JavaScript du front ne voit que le jeton d'accès, de courte durée.
  private respond(res: Response, session: Session): AuthDto {
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      // Secure dès que l'application est servie en HTTPS ; en http local le navigateur refuserait le cookie.
      secure: env.WEB_ORIGIN.startsWith('https://'),
      sameSite: 'lax',
      path: COOKIE_PATH,
      expires: session.refreshExpiresAt,
    });
    return { accessToken: session.accessToken, user: session.user };
  }
}

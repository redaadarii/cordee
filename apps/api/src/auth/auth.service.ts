import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthDto,
  ChangePasswordInput,
  LoginInput,
  RegisterWithInviteInput,
  ResetPasswordInput,
  UserDto,
} from '@cordee/shared';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { type Database, InjectDb } from '../database/database.module.js';
import {
  invitations,
  memberships,
  passwordResets,
  refreshTokens,
  users,
  workspaces,
} from '../database/schema.js';
import { MailService } from '../mail/mail.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { createToken, sha256 } from './tokens.js';

export interface Session extends AuthDto {
  refreshToken: string;
  refreshExpiresAt: Date;
}

export function slugify(name: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${base || 'espace'}-${randomBytes(3).toString('hex')}`;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly jwt: JwtService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterWithInviteInput): Promise<Session> {
    const passwordHash = await hashPassword(input.password);

    const user = await this.db.transaction(async (tx) => {
      let invitation: typeof invitations.$inferSelect | undefined;
      if (input.invitationToken) {
        [invitation] = await tx
          .select()
          .from(invitations)
          .where(
            and(
              eq(invitations.tokenHash, sha256(input.invitationToken)),
              gt(invitations.expiresAt, new Date()),
            ),
          );
        // Le lien ne vaut que pour l'adresse invitée : un lien transféré ne donne pas accès.
        if (!invitation || invitation.email !== input.email) {
          throw new BadRequestException("Cette invitation n'est plus valable pour cette adresse");
        }
      }

      const [created] = await tx
        .insert(users)
        .values({ email: input.email, name: input.name, passwordHash })
        .onConflictDoNothing({ target: users.email })
        .returning();
      if (!created) throw new ConflictException('Un compte existe déjà avec cette adresse');

      if (invitation) {
        await tx
          .insert(memberships)
          .values({ userId: created.id, workspaceId: invitation.workspaceId, role: invitation.role });
        await tx.delete(invitations).where(eq(invitations.id, invitation.id));
        return created;
      }

      const workspaceName = `Espace de ${input.name.split(' ')[0]}`;
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: workspaceName, slug: slugify(workspaceName) })
        .returning();
      await tx
        .insert(memberships)
        .values({ userId: created.id, workspaceId: workspace!.id, role: 'OWNER' });
      return created;
    });

    return this.openSession(user, randomUUID());
  }

  async login(input: LoginInput): Promise<Session> {
    const [user] = await this.db.select().from(users).where(eq(users.email, input.email));
    // Même message dans les deux cas : on ne dit pas si l'adresse existe.
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Adresse ou mot de passe incorrect');
    }
    return this.openSession(user, randomUUID());
  }

  async refresh(refreshToken: string | undefined): Promise<Session> {
    if (!refreshToken) throw new UnauthorizedException();

    const [stored] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
    if (!stored) throw new UnauthorizedException();

    if (stored.revokedAt) {
      // Un jeton déjà tourné qui revient : il a probablement été volé.
      await this.revokeFamily(stored.family);
      throw new UnauthorizedException();
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException();

    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, stored.id));

    const [user] = await this.db.select().from(users).where(eq(users.id, stored.userId));
    if (!user) throw new UnauthorizedException();
    return this.openSession(user, stored.family);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const [stored] = await this.db
      .select({ family: refreshTokens.family })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, sha256(refreshToken)));
    if (stored) await this.revokeFamily(stored.family);
  }

  async me(userId: string): Promise<UserDto> {
    const [user] = await this.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, userId));
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async updateProfile(userId: string, name: string): Promise<UserDto> {
    const [user] = await this.db
      .update(users)
      .set({ name })
      .where(eq(users.id, userId))
      .returning({ id: users.id, name: users.name, email: users.email });
    return user!;
  }

  /** Change le mot de passe, ferme toutes les autres sessions et en rouvre une pour l'appareil courant. */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<Session> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId));
    if (!user || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new BadRequestException({
        message: 'Données invalides',
        errors: [{ path: 'currentPassword', message: 'Mot de passe actuel incorrect' }],
      });
    }
    await this.setPassword(userId, input.newPassword);
    return this.openSession(user, randomUUID());
  }

  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    // Réponse identique que le compte existe ou non.
    if (!user) return;

    const { token, tokenHash } = createToken();
    await this.db.insert(passwordResets).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60_000),
    });
    await this.mail.send({
      to: user.email,
      subject: 'Réinitialiser votre mot de passe Cordée',
      text: [
        `Bonjour ${user.name},`,
        '',
        'Pour choisir un nouveau mot de passe, ouvrez ce lien (valable une heure) :',
        `${env.WEB_ORIGIN}/reset-password?token=${token}`,
        '',
        "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
      ].join('\n'),
    });
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const [reset] = await this.db
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResets.tokenHash, sha256(input.token)),
          isNull(passwordResets.usedAt),
          gt(passwordResets.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResets.userId });
    if (!reset) throw new BadRequestException('Ce lien a expiré ou a déjà servi. Demandez-en un nouveau.');
    await this.setPassword(reset.userId, input.password);
  }

  private async setPassword(userId: string, password: string) {
    await this.db
      .update(users)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(users.id, userId));
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
  }

  private async openSession(user: typeof users.$inferSelect, family: string): Promise<Session> {
    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      family,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      user: { id: user.id, name: user.name, email: user.email },
      refreshToken,
      refreshExpiresAt,
    };
  }

  private async revokeFamily(family: string) {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.family, family));
  }
}

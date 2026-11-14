import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AddMemberInput,
  AddMemberResult,
  CreateWorkspaceInput,
  InvitationDto,
  InvitationPreviewDto,
  IssueDto,
  MemberDto,
  WorkspaceDto,
  WorkspaceRole,
} from '@cordee/shared';
import { and, asc, eq, gt, ilike, inArray, or, sql } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import { slugify } from '../auth/auth.service.js';
import { createToken, sha256 } from '../auth/tokens.js';
import { env } from '../config/env.js';
import { type Database, InjectDb } from '../database/database.module.js';
import { invitations, issues, memberships, projects, users, workspaces } from '../database/schema.js';
import { MailService } from '../mail/mail.service.js';
import { IssuesService } from '../issues/issues.service.js';

@Injectable()
export class WorkspacesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: AccessService,
    private readonly issuesService: IssuesService,
    private readonly mail: MailService,
  ) {}

  listMine(userId: string): Promise<WorkspaceDto[]> {
    return this.db
      .select({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(workspaces, eq(workspaces.id, memberships.workspaceId))
      .where(eq(memberships.userId, userId))
      .orderBy(asc(workspaces.createdAt));
  }

  async create(userId: string, input: CreateWorkspaceInput): Promise<WorkspaceDto> {
    return this.db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({ name: input.name, slug: slugify(input.name) })
        .returning();
      await tx.insert(memberships).values({ userId, workspaceId: workspace!.id, role: 'OWNER' });
      return { id: workspace!.id, name: workspace!.name, slug: workspace!.slug, role: 'OWNER' };
    });
  }

  async members(userId: string, workspaceId: string): Promise<MemberDto[]> {
    await this.access.workspace(userId, workspaceId);
    return this.listMembers(workspaceId);
  }

  async listMembers(workspaceId: string): Promise<MemberDto[]> {
    const rows = await this.db
      .select({ id: users.id, name: users.name, email: users.email, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, workspaceId))
      .orderBy(asc(users.name));
    return rows.map(({ role, ...user }) => ({ user, role }));
  }

  async rename(userId: string, workspaceId: string, name: string): Promise<WorkspaceDto> {
    const role = await this.access.workspace(userId, workspaceId, 'ADMIN');
    const [workspace] = await this.db
      .update(workspaces)
      .set({ name })
      .where(eq(workspaces.id, workspaceId))
      .returning();
    return { id: workspace!.id, name: workspace!.name, slug: workspace!.slug, role };
  }

  /** Un compte existant rejoint l'espace tout de suite ; sinon une invitation part par e-mail. */
  async addMember(userId: string, workspaceId: string, input: AddMemberInput): Promise<AddMemberResult> {
    await this.access.workspace(userId, workspaceId, 'ADMIN');

    const [existing] = await this.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.email, input.email));

    if (existing) {
      const [membership] = await this.db
        .insert(memberships)
        .values({ userId: existing.id, workspaceId, role: input.role })
        .onConflictDoNothing()
        .returning();
      if (!membership) throw new ConflictException("Cette personne fait déjà partie de l'espace");
      return { status: 'added', member: { user: existing, role: membership.role } };
    }

    const { token, tokenHash } = createToken();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000);
    // Réinviter la même adresse remplace l'invitation précédente et son lien.
    const [invitation] = await this.db
      .insert(invitations)
      .values({ workspaceId, email: input.email, role: input.role, tokenHash, invitedById: userId, expiresAt })
      .onConflictDoUpdate({
        target: [invitations.workspaceId, invitations.email],
        set: { role: input.role, tokenHash, invitedById: userId, expiresAt },
      })
      .returning();

    const [context] = await this.db
      .select({ workspaceName: workspaces.name, inviterName: users.name })
      .from(workspaces)
      .innerJoin(users, eq(users.id, userId))
      .where(eq(workspaces.id, workspaceId));
    await this.mail.send({
      to: input.email,
      subject: `${context!.inviterName} vous invite dans ${context!.workspaceName} sur Cordée`,
      text: [
        `${context!.inviterName} vous invite à rejoindre l'espace « ${context!.workspaceName} ».`,
        '',
        'Pour accepter, ouvrez ce lien (valable 7 jours) :',
        `${env.WEB_ORIGIN}/invite/${token}`,
      ].join('\n'),
    });
    return { status: 'invited', invitation: this.toInvitationDto(invitation!) };
  }

  async updateMember(userId: string, workspaceId: string, memberId: string, role: WorkspaceRole) {
    await this.access.workspace(userId, workspaceId, 'ADMIN');
    await this.assertEditable(userId, workspaceId, memberId);
    await this.db
      .update(memberships)
      .set({ role })
      .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, memberId)));
    return this.listMembers(workspaceId);
  }

  /** Retire un membre (ou soi-même). Ses tickets dans l'espace redeviennent non assignés. */
  async removeMember(userId: string, workspaceId: string, memberId: string): Promise<void> {
    const role = await this.access.workspace(userId, workspaceId, memberId === userId ? 'GUEST' : 'ADMIN');
    if (memberId === userId) {
      if (role === 'OWNER') throw new ForbiddenException("Le propriétaire ne peut pas quitter son espace");
    } else {
      await this.assertEditable(userId, workspaceId, memberId);
    }

    await this.db.transaction(async (tx) => {
      const workspaceProjects = tx
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.workspaceId, workspaceId));
      await tx
        .update(issues)
        .set({ assigneeId: null })
        .where(and(eq(issues.assigneeId, memberId), inArray(issues.projectId, workspaceProjects)));
      await tx
        .delete(memberships)
        .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, memberId)));
    });
  }

  async listInvitations(userId: string, workspaceId: string): Promise<InvitationDto[]> {
    await this.access.workspace(userId, workspaceId, 'ADMIN');
    const rows = await this.db
      .select()
      .from(invitations)
      .where(and(eq(invitations.workspaceId, workspaceId), gt(invitations.expiresAt, new Date())))
      .orderBy(asc(invitations.createdAt));
    return rows.map(this.toInvitationDto);
  }

  async revokeInvitation(userId: string, workspaceId: string, invitationId: string): Promise<void> {
    await this.access.workspace(userId, workspaceId, 'ADMIN');
    await this.db
      .delete(invitations)
      .where(and(eq(invitations.id, invitationId), eq(invitations.workspaceId, workspaceId)));
  }

  async previewInvitation(token: string): Promise<InvitationPreviewDto> {
    const invitation = await this.findInvitation(token);
    const [workspace] = await this.db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, invitation.workspaceId));
    const [account] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, invitation.email));
    return {
      workspaceName: workspace!.name,
      email: invitation.email,
      role: invitation.role,
      hasAccount: !!account,
    };
  }

  /** Pour un compte créé entre l'envoi de l'invitation et son ouverture. */
  async acceptInvitation(userId: string, token: string): Promise<WorkspaceDto> {
    const invitation = await this.findInvitation(token);
    const [user] = await this.db.select({ email: users.email }).from(users).where(eq(users.id, userId));
    if (user?.email !== invitation.email) {
      throw new ForbiddenException(`Cette invitation est destinée à ${invitation.email}`);
    }

    await this.db.transaction(async (tx) => {
      await tx
        .insert(memberships)
        .values({ userId, workspaceId: invitation.workspaceId, role: invitation.role })
        .onConflictDoNothing();
      await tx.delete(invitations).where(eq(invitations.id, invitation.id));
    });
    const mine = await this.listMine(userId);
    return mine.find((workspace) => workspace.id === invitation.workspaceId)!;
  }

  private async findInvitation(token: string) {
    const [invitation] = await this.db
      .select()
      .from(invitations)
      .where(and(eq(invitations.tokenHash, sha256(token)), gt(invitations.expiresAt, new Date())));
    if (!invitation) throw new NotFoundException("Cette invitation n'existe plus ou a expiré");
    return invitation;
  }

  // Personne ne modifie le propriétaire, et on ne change pas son propre rôle.
  private async assertEditable(userId: string, workspaceId: string, memberId: string) {
    if (memberId === userId) throw new BadRequestException('Vous ne pouvez pas modifier votre propre rôle');
    const [target] = await this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.workspaceId, workspaceId), eq(memberships.userId, memberId)));
    if (!target) throw new NotFoundException('Membre introuvable');
    if (target.role === 'OWNER') throw new ForbiddenException("Le propriétaire de l'espace ne peut pas être modifié");
  }

  private toInvitationDto(invitation: typeof invitations.$inferSelect): InvitationDto {
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async search(userId: string, workspaceId: string, q: string): Promise<IssueDto[]> {
    await this.access.workspace(userId, workspaceId);
    const term = q.trim();
    if (!term) return [];

    // « CRD-12 » ou « crd 12 » cherche d'abord par clé.
    const keyMatch = /^([a-z][a-z0-9]{1,5})[- ]?(\d+)$/i.exec(term);
    const pattern = `%${term.replace(/[%_\\]/g, '\\$&')}%`;

    const rows = await this.db
      .select({ id: issues.id })
      .from(issues)
      .innerJoin(projects, eq(projects.id, issues.projectId))
      .where(
        and(
          eq(projects.workspaceId, workspaceId),
          or(
            ilike(issues.title, pattern),
            keyMatch
              ? and(
                  eq(projects.key, keyMatch[1]!.toUpperCase()),
                  eq(issues.number, Number(keyMatch[2])),
                )
              : undefined,
          ),
        ),
      )
      .orderBy(sql`${issues.updatedAt} desc`)
      .limit(12);

    if (rows.length === 0) return [];
    return this.issuesService.findMany(
      inArray(
        issues.id,
        rows.map((row) => row.id),
      ),
    );
  }
}

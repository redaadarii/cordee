import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { hasRole, type WorkspaceRole } from '@cordee/shared';
import { and, eq } from 'drizzle-orm';
import { type Database, InjectDb } from '../database/database.module.js';
import { issues, memberships, projects } from '../database/schema.js';

/**
 * Point de passage unique des contrôles d'accès. Tout se décide au niveau de
 * l'espace de travail : un projet ou un ticket hérite du rôle du membre.
 * Une ressource hors de portée répond 404 pour ne pas révéler son existence.
 */
@Injectable()
export class AccessService {
  constructor(@InjectDb() private readonly db: Database) {}

  async workspace(userId: string, workspaceId: string, required: WorkspaceRole = 'GUEST') {
    const [membership] = await this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.workspaceId, workspaceId)));
    if (!membership) throw new NotFoundException('Espace de travail introuvable');
    this.assertRole(membership.role, required);
    return membership.role;
  }

  async project(userId: string, projectId: string, required: WorkspaceRole = 'GUEST') {
    const [row] = await this.db
      .select({ project: projects, role: memberships.role })
      .from(projects)
      .innerJoin(
        memberships,
        and(eq(memberships.workspaceId, projects.workspaceId), eq(memberships.userId, userId)),
      )
      .where(eq(projects.id, projectId));
    if (!row) throw new NotFoundException('Projet introuvable');
    this.assertRole(row.role, required);
    return row;
  }

  async issue(userId: string, issueId: string, required: WorkspaceRole = 'GUEST') {
    const [row] = await this.db
      .select({ issue: issues, project: projects, role: memberships.role })
      .from(issues)
      .innerJoin(projects, eq(projects.id, issues.projectId))
      .innerJoin(
        memberships,
        and(eq(memberships.workspaceId, projects.workspaceId), eq(memberships.userId, userId)),
      )
      .where(eq(issues.id, issueId));
    if (!row) throw new NotFoundException('Ticket introuvable');
    this.assertRole(row.role, required);
    return row;
  }

  private assertRole(actual: WorkspaceRole, required: WorkspaceRole) {
    if (!hasRole(actual, required)) {
      throw new ForbiddenException('Votre rôle ne permet pas cette action');
    }
  }
}

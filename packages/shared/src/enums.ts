export const WORKSPACE_ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'GUEST'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ISSUE_TYPES = ['EPIC', 'STORY', 'TASK', 'BUG'] as const;
export type IssueType = (typeof ISSUE_TYPES)[number];

export const ISSUE_PRIORITIES = ['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE'] as const;
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];

export const STATUS_CATEGORIES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'DONE', 'CANCELED'] as const;
export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

export const SPRINT_STATES = ['PLANNED', 'ACTIVE', 'COMPLETED'] as const;
export type SprintState = (typeof SPRINT_STATES)[number];

const ROLE_WEIGHT: Record<WorkspaceRole, number> = { GUEST: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 };

export function hasRole(actual: WorkspaceRole, required: WorkspaceRole): boolean {
  return ROLE_WEIGHT[actual] >= ROLE_WEIGHT[required];
}

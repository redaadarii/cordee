import type {
  IssuePriority,
  IssueType,
  SprintState,
  StatusCategory,
  WorkspaceRole,
} from './enums.js';

export interface UserDto {
  id: string;
  name: string;
  email: string;
}

export interface AuthDto {
  accessToken: string;
  user: UserDto;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
}

export interface MemberDto {
  user: UserDto;
  role: WorkspaceRole;
}

export interface InvitationDto {
  id: string;
  email: string;
  role: WorkspaceRole;
  expiresAt: string;
}

/** Ajouter un membre : soit le compte existe et rejoint l'espace, soit une invitation part par e-mail. */
export type AddMemberResult =
  | { status: 'added'; member: MemberDto }
  | { status: 'invited'; invitation: InvitationDto };

export interface InvitationPreviewDto {
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  hasAccount: boolean;
}

export interface StatusDto {
  id: string;
  name: string;
  category: StatusCategory;
  position: number;
  wipLimit: number | null;
}

export interface LabelDto {
  id: string;
  name: string;
  color: string;
}

export interface SprintDto {
  id: string;
  name: string;
  goal: string | null;
  state: SprintState;
  startDate: string | null;
  endDate: string | null;
}

export interface ProjectDto {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  color: string;
  archivedAt: string | null;
  openIssueCount: number;
}

export interface ProjectDetailDto extends ProjectDto {
  statuses: StatusDto[];
  labels: LabelDto[];
  sprints: SprintDto[];
  members: MemberDto[];
  role: WorkspaceRole;
}

export interface IssueDto {
  id: string;
  key: string;
  number: number;
  projectId: string;
  title: string;
  type: IssueType;
  priority: IssuePriority;
  statusId: string;
  sprintId: string | null;
  parentId: string | null;
  assignee: UserDto | null;
  rank: string;
  estimate: number | null;
  dueDate: string | null;
  labelIds: string[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploader: UserDto;
  createdAt: string;
}

export interface IssueDetailDto extends IssueDto {
  description: string | null;
  reporter: UserDto;
  attachments: AttachmentDto[];
  children: Pick<IssueDto, 'id' | 'key' | 'title' | 'statusId' | 'type'>[];
}

export interface CommentDto {
  id: string;
  body: string;
  author: UserDto;
  createdAt: string;
  editedAt: string | null;
}

export type ActivityType =
  | 'CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'PRIORITY_CHANGED'
  | 'SPRINT_CHANGED'
  | 'RENAMED';

export interface ActivityDto {
  id: string;
  type: ActivityType;
  actor: UserDto;
  from: string | null;
  to: string | null;
  createdAt: string;
}

export type NotificationType = 'ASSIGNED' | 'COMMENTED' | 'MENTIONED';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  actor: UserDto;
  issue: { id: string; key: string; title: string; projectId: string };
  readAt: string | null;
  createdAt: string;
}

export interface MyIssueDto extends IssueDto {
  project: { name: string; color: string };
  statusName: string;
  statusCategory: StatusCategory;
}

// Événements poussés par le serveur sur le canal `project:<id>`.
export type ProjectEvent =
  | { type: 'issue.created' | 'issue.updated' | 'issue.moved'; projectId: string; issue: IssueDto; actorId: string }
  | { type: 'issue.deleted'; projectId: string; issueId: string; actorId: string }
  | { type: 'comment.created' | 'issue.touched'; projectId: string; issueId: string; actorId: string }
  | { type: 'board.changed'; projectId: string; actorId: string };

export interface BurndownPoint {
  date: string;
  /** `null` pour les jours à venir. */
  remaining: number | null;
  ideal: number;
}

export interface ProjectReportDto {
  /** Sprint en cours : tickets restants jour par jour, face à la ligne idéale. */
  burndown: { sprintName: string; total: number; points: BurndownPoint[] } | null;
  /** Sprints terminés, du plus ancien au plus récent. */
  velocity: { sprintName: string; issues: number; points: number }[];
  byStatus: { statusId: string; name: string; category: StatusCategory; count: number }[];
  byAssignee: { user: UserDto | null; open: number; points: number }[];
  /** Jours entre création et clôture, sur les tickets terminés des 90 derniers jours. */
  cycleTime: { medianDays: number; sampleSize: number } | null;
}

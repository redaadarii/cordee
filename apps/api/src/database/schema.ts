import { relations } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  SPRINT_STATES,
  STATUS_CATEGORIES,
  WORKSPACE_ROLES,
} from '@cordee/shared';

export const workspaceRole = pgEnum('workspace_role', WORKSPACE_ROLES);
export const issueType = pgEnum('issue_type', ISSUE_TYPES);
export const issuePriority = pgEnum('issue_priority', ISSUE_PRIORITIES);
export const statusCategory = pgEnum('status_category', STATUS_CATEGORIES);
export const sprintState = pgEnum('sprint_state', SPRINT_STATES);
export const activityType = pgEnum('activity_type', [
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNED',
  'PRIORITY_CHANGED',
  'SPRINT_CHANGED',
  'RENAMED',
]);
export const notificationType = pgEnum('notification_type', ['ASSIGNED', 'COMMENTED', 'MENTIONED']);

// Les index fractionnaires se comparent octet par octet : sans collation "C",
// Postgres trierait "Zz" après "a0" et l'ordre des cartes serait faux.
const rankText = customType<{ data: string }>({
  dataType: () => 'text COLLATE "C"',
});

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const tz = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable('users', {
  id: id(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: createdAt(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Tous les jetons issus d'une même connexion partagent une famille :
    // rejouer un jeton déjà tourné révoque la famille entière.
    family: uuid('family').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: tz('expires_at').notNull(),
    revokedAt: tz('revoked_at'),
    createdAt: createdAt(),
  },
  (t) => [index('refresh_tokens_family_idx').on(t.family)],
);

export const workspaces = pgTable('workspaces', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: workspaceRole('role').notNull().default('MEMBER'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.workspaceId] }),
    index('memberships_workspace_idx').on(t.workspaceId),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    key: text('key').notNull(),
    description: text('description'),
    color: text('color').notNull().default('#3D4DB7'),
    // Dernier numéro de ticket attribué (CRD-12), incrémenté dans la transaction de création.
    issueCounter: integer('issue_counter').notNull().default(0),
    archivedAt: tz('archived_at'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('projects_workspace_key_idx').on(t.workspaceId, t.key)],
);

export const statuses = pgTable(
  'statuses',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: statusCategory('category').notNull(),
    position: integer('position').notNull(),
    wipLimit: integer('wip_limit'),
  },
  (t) => [index('statuses_project_idx').on(t.projectId, t.position)],
);

export const sprints = pgTable(
  'sprints',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    goal: text('goal'),
    state: sprintState('state').notNull().default('PLANNED'),
    startDate: tz('start_date'),
    endDate: tz('end_date'),
    completedAt: tz('completed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('sprints_project_idx').on(t.projectId, t.state)],
);

export const issues = pgTable(
  'issues',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    type: issueType('type').notNull().default('TASK'),
    priority: issuePriority('priority').notNull().default('NONE'),
    statusId: uuid('status_id')
      .notNull()
      .references(() => statuses.id),
    sprintId: uuid('sprint_id').references(() => sprints.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id'),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    reporterId: uuid('reporter_id')
      .notNull()
      .references(() => users.id),
    rank: rankText('rank').notNull(),
    estimate: integer('estimate'),
    dueDate: tz('due_date'),
    completedAt: tz('completed_at'),
    createdAt: createdAt(),
    updatedAt: tz('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex('issues_project_number_idx').on(t.projectId, t.number),
    index('issues_board_idx').on(t.projectId, t.statusId, t.rank),
    index('issues_assignee_idx').on(t.assigneeId),
    index('issues_sprint_idx').on(t.sprintId),
    index('issues_parent_idx').on(t.parentId),
  ],
);

export const labels = pgTable(
  'labels',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
  },
  (t) => [uniqueIndex('labels_project_name_idx').on(t.projectId, t.name)],
);

export const issueLabels = pgTable(
  'issue_labels',
  {
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    labelId: uuid('label_id')
      .notNull()
      .references(() => labels.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.labelId] })],
);

export const comments = pgTable(
  'comments',
  {
    id: id(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: createdAt(),
    editedAt: tz('edited_at'),
  },
  (t) => [index('comments_issue_idx').on(t.issueId, t.createdAt)],
);

export const activities = pgTable(
  'activities',
  {
    id: id(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    type: activityType('type').notNull(),
    from: text('from_value'),
    to: text('to_value'),
    createdAt: createdAt(),
  },
  (t) => [index('activities_issue_idx').on(t.issueId, t.createdAt)],
);

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    readAt: tz('read_at'),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_idx').on(t.userId, t.createdAt)],
);

// Jetons à usage unique : seule l'empreinte est stockée, comme pour les jetons de session.
export const passwordResets = pgTable('password_resets', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: tz('expires_at').notNull(),
  usedAt: tz('used_at'),
  createdAt: createdAt(),
});

export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: workspaceRole('role').notNull().default('MEMBER'),
    tokenHash: text('token_hash').notNull().unique(),
    invitedById: uuid('invited_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: tz('expires_at').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('invitations_workspace_email_idx').on(t.workspaceId, t.email)],
);

export const attachments = pgTable(
  'attachments',
  {
    id: id(),
    issueId: uuid('issue_id')
      .notNull()
      .references(() => issues.id, { onDelete: 'cascade' }),
    uploaderId: uuid('uploader_id')
      .notNull()
      .references(() => users.id),
    filename: text('filename').notNull(),
    mimeType: text('mime_type').notNull(),
    size: integer('size').notNull(),
    // Clé opaque dans le stockage (disque aujourd'hui, S3 demain) : jamais le nom d'origine.
    storageKey: text('storage_key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('attachments_issue_idx').on(t.issueId)],
);

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  uploader: one(users, { fields: [attachments.uploaderId], references: [users.id] }),
}));

export const issuesRelations = relations(issues, ({ one, many }) => ({
  project: one(projects, { fields: [issues.projectId], references: [projects.id] }),
  status: one(statuses, { fields: [issues.statusId], references: [statuses.id] }),
  assignee: one(users, { fields: [issues.assigneeId], references: [users.id], relationName: 'assignee' }),
  reporter: one(users, { fields: [issues.reporterId], references: [users.id], relationName: 'reporter' }),
  parent: one(issues, { fields: [issues.parentId], references: [issues.id], relationName: 'hierarchy' }),
  children: many(issues, { relationName: 'hierarchy' }),
  labels: many(issueLabels),
}));

export const issueLabelsRelations = relations(issueLabels, ({ one }) => ({
  issue: one(issues, { fields: [issueLabels.issueId], references: [issues.id] }),
  label: one(labels, { fields: [issueLabels.labelId], references: [labels.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  assignedIssues: many(issues, { relationName: 'assignee' }),
  reportedIssues: many(issues, { relationName: 'reporter' }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  actor: one(users, { fields: [activities.actorId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  actor: one(users, { fields: [notifications.actorId], references: [users.id] }),
  issue: one(issues, { fields: [notifications.issueId], references: [issues.id] }),
}));

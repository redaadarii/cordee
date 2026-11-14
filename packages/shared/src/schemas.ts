import { z } from 'zod';
import {
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  STATUS_CATEGORIES,
  WORKSPACE_ROLES,
} from './enums.js';

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale attendue');
const isoDate = z.iso.datetime({ offset: true });

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().toLowerCase(),
  password: z.string().min(10, '10 caractères minimum').max(128),
});
export type RegisterInput = z.infer<typeof registerSchema>;

// `invitationToken` : le compte rejoint l'espace qui l'a invité au lieu d'en créer un.
export const registerWithInviteSchema = registerSchema.extend({
  invitationToken: z.string().min(20).optional(),
});
export type RegisterWithInviteInput = z.infer<typeof registerWithInviteSchema>;

export const updateProfileSchema = z.object({ name: z.string().trim().min(2).max(80) });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, '10 caractères minimum').max(128),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const forgotPasswordSchema = z.object({ email: z.email().toLowerCase() });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(10, '10 caractères minimum').max(128),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2).max(60),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = createWorkspaceSchema;

export const updateMemberSchema = z.object({
  role: z.enum(WORKSPACE_ROLES).exclude(['OWNER']),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const addMemberSchema = z.object({
  email: z.email().toLowerCase(),
  role: z.enum(WORKSPACE_ROLES).exclude(['OWNER']).default('MEMBER'),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(80),
  key: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Clé de 2 à 6 caractères, lettres et chiffres'),
  description: z.string().max(2000).optional(),
  color: hexColor.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema.omit({ key: true }).partial().extend({
  archived: z.boolean().optional(),
});
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const createStatusSchema = z.object({
  name: z.string().trim().min(1).max(40),
  category: z.enum(STATUS_CATEGORIES),
  wipLimit: z.number().int().positive().max(99).nullable().optional(),
});
export type CreateStatusInput = z.infer<typeof createStatusSchema>;

export const updateStatusSchema = createStatusSchema.partial().extend({
  position: z.number().int().min(0).optional(),
});
export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;

export const createIssueSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().max(20000).optional(),
  type: z.enum(ISSUE_TYPES).default('TASK'),
  priority: z.enum(ISSUE_PRIORITIES).default('NONE'),
  statusId: z.uuid().optional(),
  assigneeId: z.uuid().nullable().optional(),
  parentId: z.uuid().nullable().optional(),
  sprintId: z.uuid().nullable().optional(),
  estimate: z.number().int().min(0).max(100).nullable().optional(),
  dueDate: isoDate.nullable().optional(),
  labelIds: z.array(z.uuid()).max(20).optional(),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const updateIssueSchema = createIssueSchema.partial();
export type UpdateIssueInput = z.infer<typeof updateIssueSchema>;

// Le client envoie les voisins de la carte déposée, le serveur calcule le rang.
export const moveIssueSchema = z.object({
  statusId: z.uuid(),
  afterIssueId: z.uuid().nullable().optional(),
  beforeIssueId: z.uuid().nullable().optional(),
});
export type MoveIssueInput = z.infer<typeof moveIssueSchema>;

export const issueFiltersSchema = z.object({
  statusId: z.uuid().optional(),
  assigneeId: z.uuid().optional(),
  sprintId: z.union([z.uuid(), z.literal('none')]).optional(),
  type: z.enum(ISSUE_TYPES).optional(),
  q: z.string().trim().max(120).optional(),
});
export type IssueFilters = z.infer<typeof issueFiltersSchema>;

export const createSprintSchema = z.object({
  name: z.string().trim().min(1).max(60),
  goal: z.string().max(500).optional(),
  startDate: isoDate.nullable().optional(),
  endDate: isoDate.nullable().optional(),
});
export type CreateSprintInput = z.infer<typeof createSprintSchema>;

export const updateSprintSchema = createSprintSchema.partial();
export type UpdateSprintInput = z.infer<typeof updateSprintSchema>;

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(10000),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = createCommentSchema;

export const updateLabelSchema = z.object({
  name: z.string().trim().min(1).max(30).optional(),
  color: hexColor.optional(),
});
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(30),
  color: hexColor,
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;

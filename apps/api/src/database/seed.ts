import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { hashPassword } from '../auth/password.js';
import { env } from '../config/env.js';
import { rankBetween } from '../issues/rank.js';
import * as schema from './schema.js';

const { users, workspaces, memberships, projects, statuses, sprints, labels, issues, issueLabels, comments, activities } =
  schema;

const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const db = drizzle(pool, { schema });

const DEMO_EMAIL = 'demo@cordee.dev';
const DEMO_PASSWORD = 'cordee-demo-2026';

const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_EMAIL));
if (existing) {
  console.log('Données de démonstration déjà présentes.');
  await pool.end();
  process.exit(0);
}

const passwordHash = await hashPassword(DEMO_PASSWORD);
const [salma, youssef, ines] = await db
  .insert(users)
  .values([
    { email: DEMO_EMAIL, name: 'Salma Bennani', passwordHash },
    { email: 'youssef@cordee.dev', name: 'Youssef El Amrani', passwordHash },
    { email: 'ines@cordee.dev', name: 'Inès Tazi', passwordHash },
  ])
  .returning();

const [workspace] = await db.insert(workspaces).values({ name: 'Atelier Atlas', slug: 'atelier-atlas' }).returning();
await db.insert(memberships).values([
  { userId: salma!.id, workspaceId: workspace!.id, role: 'OWNER' },
  { userId: youssef!.id, workspaceId: workspace!.id, role: 'MEMBER' },
  { userId: ines!.id, workspaceId: workspace!.id, role: 'MEMBER' },
]);

const [app, site] = await db
  .insert(projects)
  .values([
    {
      workspaceId: workspace!.id,
      name: 'Application mobile',
      key: 'APP',
      color: '#3D4DB7',
      description: 'Application de réservation pour iOS et Android.',
    },
    { workspaceId: workspace!.id, name: 'Site vitrine', key: 'WEB', color: '#2F7D5B' },
  ])
  .returning();

const columns = [
  { name: 'Backlog', category: 'BACKLOG' as const },
  { name: 'À faire', category: 'TODO' as const },
  { name: 'En cours', category: 'IN_PROGRESS' as const, wipLimit: 4 },
  { name: 'En revue', category: 'IN_PROGRESS' as const },
  { name: 'Terminé', category: 'DONE' as const },
];
const appStatuses = await db
  .insert(statuses)
  .values(columns.map((column, position) => ({ ...column, position, projectId: app!.id })))
  .returning();
await db.insert(statuses).values(columns.map((column, position) => ({ ...column, position, projectId: site!.id })));
const statusId = (name: string) => appStatuses.find((status) => status.name === name)!.id;

const now = Date.now();
const day = 86_400_000;
const [sprint] = await db
  .insert(sprints)
  .values([
    {
      projectId: app!.id,
      name: 'Sprint 7',
      goal: 'Paiement en ligne de bout en bout',
      state: 'ACTIVE',
      startDate: new Date(now - 6 * day),
      endDate: new Date(now + 8 * day),
    },
    { projectId: app!.id, name: 'Sprint 8', state: 'PLANNED' },
  ])
  .returning();
const pastSprints = await db
  .insert(sprints)
  .values(
    [5, 6].map((n, index) => ({
      projectId: app!.id,
      name: `Sprint ${n}`,
      state: 'COMPLETED' as const,
      startDate: new Date(now - (34 - index * 14) * day),
      endDate: new Date(now - (20 - index * 14) * day),
      completedAt: new Date(now - (20 - index * 14) * day),
    })),
  )
  .returning();

const [paiement, design, dette] = await db
  .insert(labels)
  .values([
    { projectId: app!.id, name: 'paiement', color: '#C8375B' },
    { projectId: app!.id, name: 'design', color: '#7A5AC2' },
    { projectId: app!.id, name: 'dette technique', color: '#B7791F' },
  ])
  .returning();

type Seed = {
  title: string;
  status: string;
  type?: (typeof schema.issueType.enumValues)[number];
  priority?: (typeof schema.issuePriority.enumValues)[number];
  assignee?: typeof salma;
  inSprint?: boolean;
  estimate?: number;
  dueInDays?: number;
  labels?: (typeof paiement)[];
  description?: string;
  pastSprint?: number;
  doneDaysAgo?: number;
};

const seeds: Seed[] = [
  {
    title: 'Paiement en ligne',
    status: 'En cours',
    type: 'EPIC',
    priority: 'HIGH',
    assignee: salma,
    inSprint: true,
    description: [
      'Permettre de régler une réservation **par carte** depuis l’application.',
      '',
      '## Critères d’acceptation',
      '- [x] Saisie de la carte dans un écran dédié',
      '- [ ] Confirmation reçue par webhook, avec rejeu',
      '- [ ] Reçu envoyé par e-mail',
      '',
      'Hors périmètre : paiement en plusieurs fois.',
    ].join('\n'),
  },
  { title: 'Écran de saisie de la carte bancaire', status: 'En revue', type: 'STORY', priority: 'HIGH', assignee: ines, inSprint: true, estimate: 5, labels: [paiement, design] },
  { title: 'Intégrer le webhook de confirmation de paiement', status: 'En cours', type: 'TASK', priority: 'URGENT', assignee: youssef, inSprint: true, estimate: 8, dueInDays: 2, labels: [paiement] },
  { title: "Le montant s'affiche sans décimales sur Android", status: 'En cours', type: 'BUG', priority: 'HIGH', assignee: salma, inSprint: true, estimate: 2, dueInDays: -1, labels: [paiement] },
  { title: 'Reçu de paiement par e-mail', status: 'À faire', type: 'STORY', priority: 'MEDIUM', assignee: youssef, inSprint: true, estimate: 3 },
  { title: 'Gérer le refus de la banque (3-D Secure)', status: 'À faire', type: 'TASK', priority: 'MEDIUM', inSprint: true, estimate: 5, labels: [paiement] },
  { title: 'Historique des réservations', status: 'Terminé', type: 'STORY', priority: 'MEDIUM', assignee: ines, inSprint: true, estimate: 5, doneDaysAgo: 4 },
  { title: 'Passer la navigation à React Navigation 7', status: 'Terminé', type: 'TASK', priority: 'LOW', assignee: salma, inSprint: true, estimate: 3, doneDaysAgo: 2, labels: [dette] },
  { title: 'Mode sombre', status: 'Backlog', type: 'STORY', priority: 'LOW', estimate: 8, labels: [design] },
  { title: 'Notifications push de rappel la veille', status: 'Backlog', type: 'STORY', priority: 'MEDIUM', estimate: 5 },
  { title: 'Le clavier masque le bouton « Réserver » sur petits écrans', status: 'Backlog', type: 'BUG', priority: 'HIGH', assignee: salma, estimate: 1 },
  { title: 'Supprimer les appels à l’ancienne API de géolocalisation', status: 'Backlog', type: 'TASK', priority: 'NONE', labels: [dette] },
  { title: 'Création de compte par e-mail', status: 'Terminé', type: 'STORY', assignee: youssef, estimate: 5, pastSprint: 0, doneDaysAgo: 24 },
  { title: 'Recherche de créneaux disponibles', status: 'Terminé', type: 'STORY', assignee: ines, estimate: 8, pastSprint: 0, doneDaysAgo: 22 },
  { title: 'Fiche d’un établissement', status: 'Terminé', type: 'STORY', assignee: salma, estimate: 5, pastSprint: 1, doneDaysAgo: 12 },
  { title: 'Réserver un créneau', status: 'Terminé', type: 'STORY', assignee: youssef, estimate: 8, pastSprint: 1, doneDaysAgo: 9 },
  { title: 'Annuler une réservation', status: 'Terminé', type: 'STORY', assignee: ines, estimate: 3, pastSprint: 1, doneDaysAgo: 8 },
  { title: 'Plantage au retour d’arrière-plan sur iOS 17', status: 'Terminé', type: 'BUG', priority: 'HIGH', assignee: salma, estimate: 2, pastSprint: 1, doneDaysAgo: 7 },
];

const lastRank = new Map<string, string>();
let number = 0;
const created: { id: string; title: string }[] = [];
for (const seed of seeds) {
  number += 1;
  const rank = rankBetween(lastRank.get(seed.status) ?? null, null);
  lastRank.set(seed.status, rank);
  const [issue] = await db
    .insert(issues)
    .values({
      projectId: app!.id,
      number,
      title: seed.title,
      description: seed.description,
      type: seed.type,
      priority: seed.priority,
      statusId: statusId(seed.status),
      sprintId: seed.inSprint ? sprint!.id : seed.pastSprint === undefined ? null : pastSprints[seed.pastSprint]!.id,
      parentId: number > 1 && number <= 6 ? created[0]!.id : null,
      assigneeId: seed.assignee?.id,
      reporterId: salma!.id,
      rank,
      estimate: seed.estimate,
      dueDate: seed.dueInDays === undefined ? null : new Date(now + seed.dueInDays * day),
      createdAt: seed.doneDaysAgo === undefined ? undefined : new Date(now - (seed.doneDaysAgo + 5) * day),
      completedAt: seed.doneDaysAgo === undefined ? null : new Date(now - seed.doneDaysAgo * day),
    })
    .returning({ id: issues.id, title: issues.title });
  created.push(issue!);
  await db.insert(activities).values({ issueId: issue!.id, actorId: salma!.id, type: 'CREATED' });
  if (seed.labels?.length) {
    await db.insert(issueLabels).values(seed.labels.map((label) => ({ issueId: issue!.id, labelId: label!.id })));
  }
}
await db.update(projects).set({ issueCounter: number }).where(eq(projects.id, app!.id));

await db.insert(comments).values([
  {
    issueId: created[2]!.id,
    authorId: youssef!.id,
    body: 'La signature du webhook est vérifiée. Il reste le rejeu en cas de timeout côté prestataire.',
  },
  {
    issueId: created[2]!.id,
    authorId: salma!.id,
    body: 'Parfait. On garde trois tentatives avec un délai croissant ? @Inès Tazi, tu peux prévoir l’écran d’erreur ?',
  },
]);

await pool.end();
console.log(`Démo prête : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

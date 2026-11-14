// Test de bout en bout : parcourt les flux principaux contre une API démarrée.
// L'API doit tourner avec NODE_ENV=test et le même MAIL_OUTBOX_FILE que ce script :
//   NODE_ENV=test MAIL_OUTBOX_FILE=/tmp/cordee-outbox.jsonl node dist/main.js
//   MAIL_OUTBOX_FILE=/tmp/cordee-outbox.jsonl node test/smoke.e2e.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { io } from 'socket.io-client';

const ORIGIN = process.env.API_URL ?? 'http://localhost:3000';
const API = `${ORIGIN}/api/v1`;
const OUTBOX = process.env.MAIL_OUTBOX_FILE ?? '/tmp/cordee-outbox.jsonl';
const suffix = Date.now().toString(36);

// Dernier e-mail « envoyé » à une adresse, et le jeton contenu dans son lien.
async function lastMailTo(address) {
  const lines = (await readFile(OUTBOX, 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
  const mail = lines.reverse().find((entry) => entry.to === address);
  assert.ok(mail, `aucun e-mail pour ${address}`);
  return { ...mail, token: /(?:token=|\/invite\/)([\w-]+)/.exec(mail.text)[1] };
}

function client() {
  let token;
  let cookie;
  const call = async (method, path, body) => {
    const res = await fetch(API + path, {
      method,
      headers: {
        ...(body && { 'content-type': 'application/json' }),
        ...(token && { authorization: `Bearer ${token}` }),
        ...(cookie && { cookie }),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return {
    call,
    get cookie() {
      return cookie;
    },
    set cookie(value) {
      cookie = value;
    },
    setToken: (value) => (token = value),
    token: () => token,
  };
}

async function step(name, fn) {
  try {
    await fn();
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`ÉCHEC ${name}`);
    throw error;
  }
}

const alice = client();
const bob = client();
let workspaceId, project, statusByName, issues, aliceId, bobId;

await step('santé', async () => {
  assert.equal((await alice.call('GET', '/health')).status, 200);
});

await step('routes protégées sans jeton', async () => {
  assert.equal((await alice.call('GET', '/workspaces')).status, 401);
});

await step('inscription et validation', async () => {
  const weak = await alice.call('POST', '/auth/register', { name: 'Al', email: 'pas-un-mail', password: 'court' });
  assert.equal(weak.status, 400);

  for (const [who, name] of [[alice, 'Alice Martin'], [bob, 'Bob Durand']]) {
    const res = await who.call('POST', '/auth/register', {
      name,
      email: `${name.split(' ')[0].toLowerCase()}-${suffix}@test.dev`,
      password: 'mot-de-passe-long',
    });
    assert.equal(res.status, 201);
    who.setToken(res.body.accessToken);
    assert.ok(who.cookie?.startsWith('cordee_rt='));
  }
  aliceId = (await alice.call('GET', '/auth/me')).body.id;
  bobId = (await bob.call('GET', '/auth/me')).body.id;

  const duplicate = await client().call('POST', '/auth/register', {
    name: 'Alice Martin',
    email: `alice-${suffix}@test.dev`,
    password: 'mot-de-passe-long',
  });
  assert.equal(duplicate.status, 409);
});

await step('connexion refusée avec un mauvais mot de passe', async () => {
  const res = await client().call('POST', '/auth/login', { email: `alice-${suffix}@test.dev`, password: 'faux' });
  assert.equal(res.status, 401);
});

await step('espace personnel et création de projet', async () => {
  const workspaces = (await alice.call('GET', '/workspaces')).body;
  assert.equal(workspaces.length, 1);
  assert.equal(workspaces[0].role, 'OWNER');
  workspaceId = workspaces[0].id;

  const created = await alice.call('POST', `/workspaces/${workspaceId}/projects`, { name: 'Refonte', key: 'ref' });
  assert.equal(created.status, 201);
  assert.equal(created.body.key, 'REF');
  assert.equal((await alice.call('POST', `/workspaces/${workspaceId}/projects`, { name: 'Autre', key: 'REF' })).status, 409);

  project = (await alice.call('GET', `/projects/${created.body.id}`)).body;
  assert.equal(project.statuses.length, 5);
  statusByName = Object.fromEntries(project.statuses.map((status) => [status.name, status.id]));
});

await step('cloisonnement entre espaces', async () => {
  assert.equal((await bob.call('GET', `/projects/${project.id}`)).status, 404);
  assert.equal((await bob.call('GET', `/workspaces/${workspaceId}/projects`)).status, 404);
  assert.equal((await bob.call('POST', `/projects/${project.id}/issues`, { title: 'Intrus' })).status, 404);
});

await step('tickets numérotés et ordonnés', async () => {
  issues = [];
  for (const title of ['Un', 'Deux', 'Trois']) {
    const res = await alice.call('POST', `/projects/${project.id}/issues`, { title, statusId: statusByName['À faire'] });
    assert.equal(res.status, 201);
    issues.push(res.body);
  }
  assert.deepEqual(issues.map((issue) => issue.key), ['REF-1', 'REF-2', 'REF-3']);

  const listed = (await alice.call('GET', `/projects/${project.id}/issues`)).body;
  assert.deepEqual(listed.map((issue) => issue.title), ['Un', 'Deux', 'Trois']);
});

await step('déplacement : haut de colonne, entre deux cartes, autre colonne', async () => {
  const order = async (statusId) =>
    (await alice.call('GET', `/projects/${project.id}/issues?statusId=${statusId}`)).body.map((issue) => issue.title);
  const todo = statusByName['À faire'];

  await alice.call('POST', `/issues/${issues[2].id}/move`, { statusId: todo, afterIssueId: null });
  assert.deepEqual(await order(todo), ['Trois', 'Un', 'Deux']);

  await alice.call('POST', `/issues/${issues[1].id}/move`, { statusId: todo, afterIssueId: issues[2].id });
  assert.deepEqual(await order(todo), ['Trois', 'Deux', 'Un']);

  const moved = await alice.call('POST', `/issues/${issues[0].id}/move`, { statusId: statusByName['Terminé'] });
  assert.equal(moved.status, 200);
  assert.deepEqual(await order(todo), ['Trois', 'Deux']);
  assert.deepEqual(await order(statusByName['Terminé']), ['Un']);

  const wrongNeighbour = await alice.call('POST', `/issues/${issues[1].id}/move`, {
    statusId: statusByName['En cours'],
    afterIssueId: issues[2].id,
  });
  assert.equal(wrongNeighbour.status, 400);

  const activity = (await alice.call('GET', `/issues/${issues[0].id}/activity`)).body;
  assert.deepEqual(activity.map((entry) => entry.type), ['STATUS_CHANGED', 'CREATED']);
});

await step('références étrangères au projet refusées', async () => {
  const res = await alice.call('PATCH', `/issues/${issues[1].id}`, { assigneeId: bobId });
  assert.equal(res.status, 400);
});

await step('invitation, rôles et notification en temps réel', async () => {
  const invited = await alice.call('POST', `/workspaces/${workspaceId}/members`, {
    email: `bob-${suffix}@test.dev`,
    role: 'GUEST',
  });
  assert.equal(invited.status, 201);

  assert.equal((await bob.call('GET', `/projects/${project.id}`)).status, 200);
  assert.equal((await bob.call('POST', `/projects/${project.id}/issues`, { title: 'Lecture seule' })).status, 403);
  assert.equal((await bob.call('POST', `/workspaces/${workspaceId}/projects`, { name: 'Projet pirate', key: 'XX' })).status, 403);

  const socket = io(ORIGIN, { auth: { token: bob.token() }, transports: ['websocket'] });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  const joined = await socket.emitWithAck('project:join', project.id);
  assert.equal(joined.ok, true);

  const projectEvent = new Promise((resolve) => socket.once('project:event', resolve));
  const notified = new Promise((resolve) => socket.once('notification', resolve));
  await alice.call('PATCH', `/issues/${issues[1].id}`, { assigneeId: bobId, priority: 'HIGH' });

  const event = await projectEvent;
  assert.equal(event.type, 'issue.updated');
  assert.equal(event.issue.assignee.id, bobId);
  await notified;
  socket.disconnect();

  const notifications = (await bob.call('GET', '/me/notifications')).body;
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].type, 'ASSIGNED');
  assert.equal(notifications[0].issue.key, 'REF-2');

  const mine = (await bob.call('GET', '/me/issues')).body;
  assert.deepEqual(mine.map((issue) => issue.key), ['REF-2']);
});

await step('temps réel refusé sans accès au projet', async () => {
  const stranger = client();
  const res = await stranger.call('POST', '/auth/register', {
    name: 'Carla Stranger',
    email: `carla-${suffix}@test.dev`,
    password: 'mot-de-passe-long',
  });
  const socket = io(ORIGIN, { auth: { token: res.body.accessToken }, transports: ['websocket'] });
  await new Promise((resolve) => socket.once('connect', resolve));
  assert.equal((await socket.emitWithAck('project:join', project.id)).ok, false);
  socket.disconnect();
});

await step('commentaires', async () => {
  const res = await alice.call('POST', `/issues/${issues[1].id}/comments`, { body: 'Un premier avis.' });
  assert.equal(res.status, 201);
  assert.equal(res.body.author.id, aliceId);
  const listed = (await alice.call('GET', `/projects/${project.id}/issues`)).body;
  assert.equal(listed.find((issue) => issue.id === issues[1].id).commentCount, 1);
});

await step('cycle de vie du sprint', async () => {
  const sprint = (await alice.call('POST', `/projects/${project.id}/sprints`, { name: 'Sprint 1' })).body;
  for (const issue of issues) {
    assert.equal((await alice.call('PATCH', `/issues/${issue.id}`, { sprintId: sprint.id })).status, 200);
  }
  assert.equal((await alice.call('POST', `/sprints/${sprint.id}/complete`)).status, 409);
  assert.equal((await alice.call('POST', `/sprints/${sprint.id}/start`)).body.state, 'ACTIVE');

  const second = (await alice.call('POST', `/projects/${project.id}/sprints`, { name: 'Sprint 2' })).body;
  assert.equal((await alice.call('POST', `/sprints/${second.id}/start`)).status, 409);

  assert.equal((await alice.call('POST', `/sprints/${sprint.id}/complete`)).body.state, 'COMPLETED');
  const inSprint = (await alice.call('GET', `/projects/${project.id}/issues?sprintId=${sprint.id}`)).body;
  assert.deepEqual(inSprint.map((issue) => issue.title), ['Un']);
  const backlog = (await alice.call('GET', `/projects/${project.id}/issues?sprintId=none`)).body;
  assert.equal(backlog.length, 2);
});

await step('colonnes : ajout, réordonnancement, suppression protégée', async () => {
  const created = await alice.call('POST', `/projects/${project.id}/statuses`, { name: 'Bloqué', category: 'IN_PROGRESS' });
  assert.equal(created.body.position, 5);
  const reordered = await alice.call('PATCH', `/projects/${project.id}/statuses/${created.body.id}`, { position: 2 });
  assert.deepEqual(reordered.body.map((status) => status.name), ['Backlog', 'À faire', 'Bloqué', 'En cours', 'En revue', 'Terminé']);
  assert.equal((await alice.call('DELETE', `/projects/${project.id}/statuses/${statusByName['À faire']}`)).status, 409);
  assert.equal((await alice.call('DELETE', `/projects/${project.id}/statuses/${created.body.id}`)).status, 204);
});

await step('recherche par titre et par clé', async () => {
  const byTitle = (await alice.call('GET', `/workspaces/${workspaceId}/search?q=tro`)).body;
  assert.deepEqual(byTitle.map((issue) => issue.key), ['REF-3']);
  const byKey = (await alice.call('GET', `/workspaces/${workspaceId}/search?q=ref-2`)).body;
  assert.deepEqual(byKey.map((issue) => issue.key), ['REF-2']);
});

await step('profil et changement de mot de passe', async () => {
  const renamed = await bob.call('PATCH', '/auth/me', { name: 'Bob Durand-Leroy' });
  assert.equal(renamed.body.name, 'Bob Durand-Leroy');

  const wrong = await bob.call('POST', '/auth/password', { currentPassword: 'faux', newPassword: 'nouveau-mot-de-passe' });
  assert.equal(wrong.status, 400);
  const before = bob.cookie;
  const changed = await bob.call('POST', '/auth/password', {
    currentPassword: 'mot-de-passe-long',
    newPassword: 'nouveau-mot-de-passe',
  });
  assert.equal(changed.status, 200);
  bob.setToken(changed.body.accessToken);

  // Les anciennes sessions sont fermées, l'ancien mot de passe ne marche plus.
  const stale = client();
  stale.cookie = before;
  assert.equal((await stale.call('POST', '/auth/refresh')).status, 401);
  const email = `bob-${suffix}@test.dev`;
  assert.equal((await client().call('POST', '/auth/login', { email, password: 'mot-de-passe-long' })).status, 401);
  assert.equal((await client().call('POST', '/auth/login', { email, password: 'nouveau-mot-de-passe' })).status, 200);
});

await step('mot de passe oublié : lien à usage unique', async () => {
  const email = `bob-${suffix}@test.dev`;
  assert.equal((await client().call('POST', '/auth/forgot-password', { email: 'inconnu@test.dev' })).status, 204);
  assert.equal((await client().call('POST', '/auth/forgot-password', { email })).status, 204);
  const { token } = await lastMailTo(email);

  assert.equal((await client().call('POST', '/auth/reset-password', { token: 'x'.repeat(43), password: 'peu-importe-12' })).status, 400);
  assert.equal((await client().call('POST', '/auth/reset-password', { token, password: 'troisieme-mot-de-passe' })).status, 204);
  assert.equal((await client().call('POST', '/auth/reset-password', { token, password: 'quatrieme-mot-de-passe' })).status, 400);

  const login = await bob.call('POST', '/auth/login', { email, password: 'troisieme-mot-de-passe' });
  assert.equal(login.status, 200);
  bob.setToken(login.body.accessToken);
});

await step('invitation par e-mail : nouveau compte', async () => {
  const email = `dina-${suffix}@test.dev`;
  const invited = await alice.call('POST', `/workspaces/${workspaceId}/members`, { email, role: 'MEMBER' });
  assert.equal(invited.body.status, 'invited');
  assert.equal((await alice.call('GET', `/workspaces/${workspaceId}/invitations`)).body.length, 1);
  assert.equal((await bob.call('GET', `/workspaces/${workspaceId}/invitations`)).status, 403);

  const { token } = await lastMailTo(email);
  const preview = await client().call('GET', `/invitations/${token}`);
  assert.equal(preview.body.email, email);
  assert.equal(preview.body.hasAccount, false);

  // Le lien ne vaut que pour l'adresse invitée.
  const hijack = await client().call('POST', '/auth/register', {
    name: 'Eve Intruse',
    email: `eve-${suffix}@test.dev`,
    password: 'mot-de-passe-long',
    invitationToken: token,
  });
  assert.equal(hijack.status, 400);

  const dina = client();
  const registered = await dina.call('POST', '/auth/register', {
    name: 'Dina Roche',
    email,
    password: 'mot-de-passe-long',
    invitationToken: token,
  });
  assert.equal(registered.status, 201);
  dina.setToken(registered.body.accessToken);
  const workspaces = (await dina.call('GET', '/workspaces')).body;
  assert.deepEqual(workspaces.map((w) => [w.id, w.role]), [[workspaceId, 'MEMBER']]);
  assert.equal((await client().call('GET', `/invitations/${token}`)).status, 404);
});

await step('invitation par e-mail : compte créé entre-temps', async () => {
  const email = `farid-${suffix}@test.dev`;
  await alice.call('POST', `/workspaces/${workspaceId}/members`, { email, role: 'GUEST' });
  const { token } = await lastMailTo(email);

  const farid = client();
  const res = await farid.call('POST', '/auth/register', { name: 'Farid Alaoui', email, password: 'mot-de-passe-long' });
  farid.setToken(res.body.accessToken);
  assert.equal((await bob.call('POST', `/invitations/${token}/accept`)).status, 403);
  const accepted = await farid.call('POST', `/invitations/${token}/accept`);
  assert.equal(accepted.body.role, 'GUEST');
  assert.equal((await farid.call('GET', '/workspaces')).body.length, 2);
});

await step('rôles et retrait de membres', async () => {
  const members = (await alice.call('GET', `/workspaces/${workspaceId}/members`)).body;
  assert.equal(members.length, 4);

  assert.equal((await bob.call('PATCH', `/workspaces/${workspaceId}/members/${aliceId}`, { role: 'GUEST' })).status, 403);
  assert.equal((await alice.call('PATCH', `/workspaces/${workspaceId}/members/${aliceId}`, { role: 'ADMIN' })).status, 400);

  const promoted = await alice.call('PATCH', `/workspaces/${workspaceId}/members/${bobId}`, { role: 'ADMIN' });
  assert.equal(promoted.body.find((m) => m.user.id === bobId).role, 'ADMIN');
  // Même administrateur, Bob ne touche pas au propriétaire.
  assert.equal((await bob.call('PATCH', `/workspaces/${workspaceId}/members/${aliceId}`, { role: 'GUEST' })).status, 403);
  assert.equal((await bob.call('DELETE', `/workspaces/${workspaceId}/members/${aliceId}`)).status, 403);
  assert.equal((await alice.call('DELETE', `/workspaces/${workspaceId}/members/${aliceId}`)).status, 403);

  assert.equal((await bob.call('PATCH', `/workspaces/${workspaceId}`, { name: 'Atelier renommé' })).body.name, 'Atelier renommé');
});

await step('commentaires : mention, modification, suppression', async () => {
  const issueId = issues[1].id;
  await bob.call('POST', '/me/notifications/read');
  const created = await alice.call('POST', `/issues/${issueId}/comments`, { body: 'Peux-tu relire, @Bob Durand-Leroy ?' });
  assert.equal(created.status, 201);

  const notifications = (await bob.call('GET', '/me/notifications')).body.filter((n) => !n.readAt);
  // Bob est assigné et mentionné : une seule notification, la mention.
  assert.deepEqual(notifications.map((n) => n.type), ['MENTIONED']);

  assert.equal((await bob.call('PATCH', `/comments/${created.body.id}`, { body: 'Piraté' })).status, 403);
  const edited = await alice.call('PATCH', `/comments/${created.body.id}`, { body: 'Relu, merci.' });
  assert.equal(edited.body.body, 'Relu, merci.');
  assert.ok(edited.body.editedAt);

  // Bob est administrateur : il peut supprimer le commentaire d'un autre.
  assert.equal((await bob.call('DELETE', `/comments/${created.body.id}`)).status, 204);
  assert.equal((await alice.call('GET', `/issues/${issueId}/comments`)).body.length, 1);
});

await step('étiquettes', async () => {
  const label = (await alice.call('POST', `/projects/${project.id}/labels`, { name: 'front', color: '#3d4db7' })).body;
  assert.equal((await alice.call('POST', `/projects/${project.id}/labels`, { name: 'front', color: '#3d4db7' })).status, 409);
  await alice.call('PATCH', `/issues/${issues[1].id}`, { labelIds: [label.id] });
  const renamed = await alice.call('PATCH', `/projects/${project.id}/labels/${label.id}`, { name: 'interface' });
  assert.equal(renamed.body.name, 'interface');
  assert.equal((await alice.call('DELETE', `/projects/${project.id}/labels/${label.id}`)).status, 204);
  const issue = (await alice.call('GET', `/issues/${issues[1].id}`)).body;
  assert.deepEqual(issue.labelIds, []);
});

await step('pièces jointes', async () => {
  const issueId = issues[1].id;
  const upload = async (who, name, content) => {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/plain' }), name);
    const res = await fetch(`${API}/issues/${issueId}/attachments`, {
      method: 'POST',
      headers: { authorization: `Bearer ${who.token()}` },
      body: form,
    });
    return { status: res.status, body: await res.json() };
  };

  const sent = await upload(alice, 'compte-rendu été.txt', 'bonjour');
  assert.equal(sent.status, 201);
  assert.equal(sent.body.filename, 'compte-rendu été.txt');
  assert.equal(sent.body.size, 7);

  const detail = (await alice.call('GET', `/issues/${issueId}`)).body;
  assert.equal(detail.attachments.length, 1);

  const download = await fetch(`${API}/attachments/${sent.body.id}`, { headers: { authorization: `Bearer ${alice.token()}` } });
  assert.equal(await download.text(), 'bonjour');
  assert.match(download.headers.get('content-disposition'), /^attachment;/);
  assert.equal((await fetch(`${API}/attachments/${sent.body.id}`)).status, 401);

  const tooBig = await upload(alice, 'gros.bin', new Uint8Array(11 * 1024 * 1024));
  assert.equal(tooBig.status, 413);

  assert.equal((await alice.call('DELETE', `/attachments/${sent.body.id}`)).status, 204);
  assert.equal((await alice.call('GET', `/issues/${issueId}`)).body.attachments.length, 0);
});

await step('rapports', async () => {
  const sprint = (await alice.call('POST', `/projects/${project.id}/sprints`, { name: 'Sprint rapport' })).body;
  await alice.call('PATCH', `/issues/${issues[1].id}`, { sprintId: sprint.id, estimate: 5 });
  await alice.call('PATCH', `/issues/${issues[2].id}`, { sprintId: sprint.id });
  await alice.call('POST', `/sprints/${sprint.id}/start`);
  await alice.call('PATCH', `/issues/${issues[2].id}`, { statusId: statusByName['Terminé'] });

  const report = (await alice.call('GET', `/projects/${project.id}/reports`)).body;
  assert.equal(report.burndown.sprintName, 'Sprint rapport');
  assert.equal(report.burndown.total, 2);
  assert.equal(report.burndown.points[0].remaining, 1);
  assert.equal(report.burndown.points.at(-1).ideal, 0);
  assert.deepEqual(report.velocity.map((v) => [v.sprintName, v.issues]), [['Sprint 1', 1]]);
  assert.equal(report.byStatus.reduce((sum, s) => sum + s.count, 0), 3);
  assert.deepEqual(report.byAssignee.map((a) => [a.user?.id ?? null, a.open, a.points]), [[bobId, 1, 5]]);
  assert.ok(report.cycleTime.sampleSize >= 2);
});

await step('retirer un membre libère ses tickets', async () => {
  assert.equal((await alice.call('DELETE', `/workspaces/${workspaceId}/members/${bobId}`)).status, 204);
  assert.equal((await bob.call('GET', `/projects/${project.id}`)).status, 404);
  assert.equal((await alice.call('GET', `/issues/${issues[1].id}`)).body.assignee, null);
});

await step('rotation du jeton de rafraîchissement et détection de rejeu', async () => {
  const stolen = alice.cookie;
  const refreshed = await alice.call('POST', '/auth/refresh');
  assert.equal(refreshed.status, 200);
  assert.notEqual(alice.cookie, stolen);
  const current = alice.cookie;

  alice.cookie = stolen;
  assert.equal((await alice.call('POST', '/auth/refresh')).status, 401);
  // Le rejeu a révoqué toute la famille : le jeton légitime ne passe plus non plus.
  alice.cookie = current;
  assert.equal((await alice.call('POST', '/auth/refresh')).status, 401);
});

await step('suppression', async () => {
  assert.equal((await alice.call('DELETE', `/issues/${issues[2].id}`)).status, 204);
  assert.equal((await alice.call('GET', `/issues/${issues[2].id}`)).status, 404);
});

console.log('\nTous les parcours passent.');
process.exit(0);

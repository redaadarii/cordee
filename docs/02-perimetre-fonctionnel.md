# Périmètre fonctionnel

Deux niveaux : ce qui est **livré** et vérifié dans cette version, et ce qui est **prévu** dans la feuille de route.

## Livré

### Comptes et sécurité
- Inscription, connexion, déconnexion.
- Profil modifiable (nom), changement de mot de passe : les autres sessions sont fermées.
- Mot de passe oublié : lien par e-mail, valable une heure, à usage unique. La réponse est la même que l'adresse existe ou non.
- Jeton d'accès court (15 min) en mémoire, jeton de rafraîchissement en cookie `httpOnly` avec rotation ; un jeton rejoué révoque toute la session.
- Mots de passe hachés avec scrypt, limitation du nombre de tentatives.

### Espaces de travail et membres
- Un espace personnel créé à l'inscription, création d'autres espaces depuis le menu, renommage.
- Invitation par e-mail :
  - une personne qui a déjà un compte rejoint l'espace tout de suite ;
  - sinon elle reçoit un lien valable 7 jours, lié à son adresse : un lien transféré ne donne pas accès.
- Liste des invitations en attente, annulation.
- Changement de rôle et retrait d'un membre ; ses tickets deviennent non assignés. Personne ne peut modifier le propriétaire, ni son propre rôle.
- Quatre rôles :

| Action | Invité | Membre | Admin | Propriétaire |
| --- | :-: | :-: | :-: | :-: |
| Voir projets, tickets, commentaires, rapports | ✓ | ✓ | ✓ | ✓ |
| Créer, modifier, déplacer, commenter, joindre des fichiers | | ✓ | ✓ | ✓ |
| Gérer les sprints et les étiquettes | | ✓ | ✓ | ✓ |
| Créer un projet, régler ses colonnes, l'archiver | | | ✓ | ✓ |
| Inviter, changer les rôles, retirer des membres | | | ✓ | ✓ |
| Supprimer le commentaire ou le fichier d'un autre | | | ✓ | ✓ |

### Projets
- Nom, clé (2 à 6 caractères), couleur, description.
- Archivage réversible : le projet sort du menu et de « Mon travail ».
- Réglages des colonnes : ajout, renommage, catégorie, ordre, limite d'en-cours, suppression protégée (une colonne qui contient des tickets ne se supprime pas).
- Étiquettes : création, renommage, couleur, suppression.

### Tickets
- Types : épopée, récit, tâche, anomalie. Priorités : urgente, haute, moyenne, basse, aucune.
- Assigné, étiquettes, estimation en points, échéance, ticket parent et sous-tickets.
- Description en Markdown (titres, listes, cases à cocher, code, tableaux, liens). Le HTML brut n'est pas interprété.
- Pièces jointes (10 Mo par défaut), toujours servies en téléchargement.
- Numérotation par projet (APP-12), sans trou ni doublon même en création simultanée.
- Historique : création, changement de statut, d'assigné, de priorité, de sprint, de titre.

### Commentaires et notifications
- Commentaires en Markdown, modifiables par leur auteur (mention « modifié »), supprimables par l'auteur ou un administrateur.
- Mentions `@Prénom Nom` avec suggestions pendant la frappe.
- Notifications quand :
  - un ticket m'est confié ;
  - un de mes tickets est commenté ;
  - on me mentionne. Une personne mentionnée et assignée ne reçoit qu'une notification.

### Vues
- **Tableau** :
  - glisser-déposer à la souris, au doigt (appui long) et au clavier ;
  - ajout rapide, filtre par personne, limite d'en-cours ;
  - « voie du sprint » qui montre l'avancement.
- **Backlog** : sprints et backlog, création, démarrage (un seul sprint actif), clôture avec retour des tickets non terminés.
- **Liste** : tableau triable par colonne, filtres par statut, type, priorité, assigné, étiquette et texte.
- **Calendrier** : échéances du mois ; sur téléphone, un agenda des jours concernés.
- **Rapports** :
  - burndown du sprint en cours et vélocité des sprints clôturés, chacun avec une version en tableau ;
  - répartition par statut et charge par personne ;
  - délai médian de la création à la clôture.

### Au quotidien
- « Mon travail » : mes tickets ouverts sur tous les projets, retards mis en avant.
- Recherche par titre ou par clé, palette de commandes (Ctrl/⌘ + K), raccourci `C` pour créer un ticket.
- Temps réel : tableau, commentaires, pièces jointes et notifications se mettent à jour sans recharger.
- Mode sombre (clair, sombre ou selon le système).
- Interface responsive, du téléphone au grand écran.

## Limites connues

- **Burndown** : le périmètre d'un sprint n'est pas historisé. Un ticket ajouté en cours de sprint relève toute la courbe.
- **E-mails** : ils partent seulement si `SMTP_URL` est renseigné. Sinon, ils sont écrits dans les journaux de l'API.
- **Pièces jointes** : elles sont stockées sur le disque du serveur. Plusieurs instances de l'API demanderont un stockage partagé (S3 ou MinIO).
- **Liste des tickets** : elle se charge en entier, sans pagination. C'est adapté à quelques milliers de tickets par projet, pas au-delà.

## Prévu

Voir la [feuille de route](05-roadmap.md) : vue chronologie (Gantt), filtres enregistrés, automatisations, intégrations Git, SSO, API publique, import Jira/Trello, traductions.

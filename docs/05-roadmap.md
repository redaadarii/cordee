# Feuille de route

Ce qui est fait est décrit dans le [périmètre fonctionnel](02-perimetre-fonctionnel.md). L'ordre ci-dessous suit ce qui débloque le plus d'usage réel.

## Étape 1 : passer à l'échelle
- Pagination de la liste des tickets et du backlog, recherche plein texte PostgreSQL (`tsvector`).
- Stockage des pièces jointes sur S3 ou MinIO (seule `StorageService` change), aperçu des images.
- Adaptateur Redis pour Socket.IO (plusieurs instances de l'API), BullMQ pour les e-mails et les rappels d'échéance.
- Historisation du périmètre des sprints, pour un burndown exact quand des tickets sont ajoutés en cours de route.

## Étape 2 : planifier
- Vue chronologie (Gantt) des épopées.
- Filtres enregistrés et partagés.
- Glisser-déposer dans le backlog et entre sprints.
- Report des tickets non terminés vers le sprint suivant à la clôture, au choix.
- Rappels d'échéance par e-mail.

## Étape 3 : exploitation
- Journalisation structurée, traces OpenTelemetry, métriques.
- Documentation OpenAPI générée depuis les schémas Zod.
- Tests navigateur (Playwright) dans la CI.
- Sauvegardes automatisées de PostgreSQL et des pièces jointes.

## Étape 4 : ouverture
- Intégration GitHub et GitLab : lier branches et pull requests aux tickets, changer le statut à la fusion.
- Webhooks et API publique avec jetons personnels.
- Automatisations (« quand un ticket passe en revue, l'assigner à… »).
- Connexion SSO (OIDC), double authentification.
- Import depuis Jira et Trello.
- Anglais et arabe (avec mise en page de droite à gauche).

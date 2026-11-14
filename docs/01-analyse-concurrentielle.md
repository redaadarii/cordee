# Analyse des outils existants

Objectif : repérer ce que chaque outil fait bien, ce qui agace ses utilisateurs, et en tirer le positionnement de Cordée. Relevé fait en novembre 2026 ; les tarifs changent souvent, ils ne sont donc pas repris ici.

## Les outils regardés

| Outil | Pour qui | Ce qu'il fait bien | Ce qui pèse |
| --- | --- | --- | --- |
| **Jira** | Équipes logicielles, grandes organisations | Workflows configurables à l'extrême, Scrum et Kanban complets, rapports (burndown, vélocité), JQL, écosystème d'extensions | Lent, écrans chargés, configuration qui demande un administrateur ; la simplicité se paie en extensions |
| **Trello** | Petites équipes, usage personnel | Prise en main immédiate, tableau de cartes, glisser-déposer agréable, automatisations Butler | S'essouffle au-delà d'une dizaine de personnes : pas de backlog, pas de sprint, peu de hiérarchie |
| **Linear** | Équipes produit et engineering | Rapidité, raccourcis clavier partout, palette de commandes, cycles, modèle imposé mais cohérent | Peu configurable, fermé, pas d'auto-hébergement |
| **Asana** | Équipes transverses (marketing, ops) | Plusieurs vues (liste, tableau, calendrier, chronologie), objectifs, règles d'automatisation | Peu adapté au développement logiciel, cher quand l'équipe grandit |
| **ClickUp** | Équipes qui veulent tout au même endroit | Très grand nombre de vues, documents, tableaux blancs, suivi du temps | Surcharge : trop d'options, interface dense, performances inégales |
| **monday.com** | Opérations, suivi visuel | Tableaux colorés très lisibles, automatisations simples | Modèle « tableur » peu naturel pour un backlog de développement |
| **Notion** | Équipes centrées sur les documents | Documents et bases de données dans le même espace | Suivi de projet léger, pas pensé pour les sprints |
| **GitHub Projects** | Développeurs déjà sur GitHub | Lié aux issues et aux pull requests | Limité hors du code, peu de rapports |
| **Plane** | Équipes qui veulent un Jira moderne et auto-hébergé | Open source, interface soignée, cycles et modules, pages | Certaines fonctions (suivi du temps) réservées aux offres payantes |
| **OpenProject** | Projets planifiés, secteur public | Gantt, budgets, suivi du temps, cycle en V et agile | Interface plus datée, lourdeur |
| **Huly** | Équipes qui veulent projet + chat + documents | Tout-en-un open source, synchronisation GitHub | Auto-hébergement plus exigeant |

## Ce qui ressort

**Deux familles s'opposent.** D'un côté les outils configurables (Jira, ClickUp) : on peut tout faire, mais il faut du temps pour les régler et ils ralentissent avec l'usage. De l'autre les outils à modèle imposé (Linear, Trello) : rapides et agréables, mais on s'adapte à eux.

**La vitesse est devenue un critère de choix.** Le succès de Linear repose là-dessus : interface instantanée, mises à jour optimistes, clavier d'abord. C'est la première raison citée par les équipes qui quittent Jira.

**Le temps réel est attendu.** Voir une carte bouger quand un collègue la déplace n'est plus un plus, c'est la norme.

**L'auto-hébergement revient.** Atlassian a arrêté la vente de nouvelles licences Jira Data Center en mars 2026, ce qui pousse les organisations qui veulent garder leurs données chez elles vers Plane ou OpenProject.

**Le mobile est le parent pauvre.** La plupart des outils proposent une application séparée et un site peu utilisable sur téléphone.

## Fonctions communes à tous

Ce socle se retrouve partout ; un outil qui en manque n'est pas crédible :

- espaces de travail, membres, rôles ;
- projets avec une clé (APP-12) ;
- tickets typés avec priorité, assigné, étiquettes, échéance, estimation ;
- tableau kanban à colonnes configurables, glisser-déposer ;
- backlog et sprints ;
- commentaires, historique des changements, notifications ;
- recherche et filtres.

## Positionnement retenu pour Cordée

Cordée vise les équipes produit de 3 à 50 personnes qui trouvent Trello trop court et Jira trop lourd.

1. **Le modèle de Jira, la légèreté de Linear.** Épopées, récits, tâches, anomalies, sprints, colonnes configurables avec limite d'en-cours, mais sans schéma de workflow à administrer.
2. **Rapide par construction.** Mises à jour optimistes, classement des cartes par index fractionnaire (un déplacement = une ligne écrite), palette de commandes.
3. **Un seul site, utilisable au téléphone.** Tableau à défilement horizontal aimanté, tiroir de ticket en plein écran, appui long pour déplacer.
4. **Temps réel partout.** Tableau, commentaires et notifications poussés par WebSocket.
5. **Auto-hébergeable.** PostgreSQL et un processus Node, sans service propriétaire.
6. **En français d'abord**, là où presque tous les concurrents sont pensés en anglais puis traduits.

## Sources

- [Plane : comparatif des outils open source](https://plane.so/blog/top-6-open-source-project-management-software-in-2026)
- [Plane vs OpenProject](https://plane.so/blog/plane-vs-openproject-which-should-you-choose-in-2026)
- [Orangescrum : outils open source et fin de Jira Data Center](https://blog.orangescrum.com/open-source-project-management-software/)
- [Automation Atlas : Linear vs Jira](https://automationatlas.io/guides/linear-vs-jira-2026-comparison/)
- [Dupple : comparatif et choix par type d'équipe](https://dupple.com/blog/project-software-comparisons)
- [Inventive HQ : alternatives à Jira](https://inventivehq.com/blog/best-project-management-tools-jira-alternatives)

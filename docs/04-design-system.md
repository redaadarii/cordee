# Design system et UX

## Intention

Un outil de suivi se regarde plusieurs heures par jour. L'interface doit donc s'effacer : surfaces calmes, hiérarchie nette, couleur réservée à ce qui porte une information. Le nom donne le vocabulaire visuel : la montagne (neige, ardoise, fleurs d'altitude) et la corde qui relie les relais.

Un seul élément porte l'identité : **la voie du sprint**, une corde qui monte de gauche à droite avec un nœud par ticket. Elle apparaît en tête du tableau, dans le logo et sur l'écran de connexion. Le reste est volontairement sobre.

## Couleurs

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `neve` | `#F3F5F7` | Fond de l'application |
| `surface` | `#FFFFFF` | Cartes, panneaux, champs |
| `line` / `line-strong` | `#DBE1E6` / `#C3CCD4` | Bordures, séparateurs |
| `ink` / `ink-2` / `ink-3` | `#18252F` / `#4A5A66` / `#5F6E7A` | Texte principal, secondaire, discret |
| `ardoise` | `#14212B` | Menu latéral |
| `gentiane` | `#3D4DB7` | Action principale, sélection, en cours |
| `lichen` | `#2F7D5B` | Terminé, succès |
| `meleze` | `#B7791F` | Avertissement, limite dépassée, sommet |
| `rhodo` | `#C8375B` | Urgent, retard, suppression |

Chaque couleur d'état a une variante claire (`-soft`) pour les fonds.

**Mode sombre.** Les mêmes jetons reçoivent d'autres valeurs sous `[data-theme='dark']` : fond `#101A22`, surfaces `#18252F`, gentiane éclaircie en `#7F8FF0` pour garder le contraste. Ce n'est pas une inversion automatique : chaque valeur est choisie pour le fond ardoise. Le texte posé sur la couleur d'action utilise `on-accent` (blanc en clair, ardoise en sombre). Le choix (clair, sombre, système) se fait dans « Mon compte ». La couleur n'est jamais seule à porter le sens : la priorité se lit à la hauteur des barres, le statut à la forme de la pastille (pointillée, vide, pleine), le retard au libellé.

## Typographie

Une seule famille, **Schibsted Grotesk** (variable, auto-hébergée) : assez de caractère en titres, lisible en petit. Corps à 15 px. Les clés de ticket et les compteurs utilisent les chiffres tabulaires de la même police plutôt qu'une police à chasse fixe.

| Rôle | Taille | Graisse |
| --- | --- | --- |
| Titre de page | 24 px | 700 |
| Titre de ticket (tiroir) | 20 px | 700 |
| Titre de section | 15–16 px | 600 |
| Corps, cartes | 14–15 px | 400–500 |
| Métadonnées | 12–13 px | 400–500 |

## Formes

Rayon de 10 px pour les cartes, 8 px pour les contrôles, 12 à 16 px pour les panneaux et dialogues. Ombres très légères au repos ; l'ombre marquée est réservée à ce qui flotte (carte en cours de déplacement, dialogue).

## Écrans

```
Bureau                                   Téléphone
┌────────┬───────────────────────────┐   ┌─────────────────┐
│ Logo   │ Recherche        Notifs   │   │ ☰  Recherche  🔔│
│ Espace ├───────────────────────────┤   ├─────────────────┤
│        │ Projet        [+ Ticket]  │   │ Projet [+Ticket]│
│ Mon    │ Tableau | Backlog         │   │ Tableau|Backlog │
│ travail│ ┌ Voie du sprint ───────┐ │   │ ┌ Voie ───────┐ │
│ Projets│ └───────────────────────┘ │   │ └─────────────┘ │
│ Membres│ ┌─────┐┌─────┐┌─────┐┌──  │   │ ┌───────────┐┌─ │
│        │ │Col. ││Col. ││Col. ││    │   │ │ Colonne   ││  │
│ Projets│ │carte││carte││carte││    │   │ │ carte     ││  │
│  · APP │ │carte││     ││carte││    │   │ │ carte     ││  │
│  · WEB │ └─────┘└─────┘└─────┘└──  │   │ └───────────┘└─ │
│ Profil │                           │   │  ← défilement → │
└────────┴───────────────────────────┘   └─────────────────┘
```

- **Tableau** : colonnes de largeur fixe, défilement horizontal. Sur téléphone, une colonne occupe 85 % de la largeur et s'aimante, la suivante dépasse pour signaler qu'on peut faire défiler.
- **Ticket** : tiroir à droite sur bureau, plein écran sur téléphone. L'adresse contient `?issue=`, donc un ticket se partage par lien et le bouton retour le ferme.
- **Backlog** : listes denses, une section par sprint, action principale à droite de chaque titre.
- **Mon travail** : la page d'accueil répond à « qu'est-ce que je dois faire ? ».
- **Liste** : tableau dense, triable, filtres sur une ligne au-dessus. Sur téléphone, le tableau défile horizontalement plutôt que d'écraser les colonnes.
- **Calendrier** : grille mensuelle à partir de la tablette, agenda des seuls jours concernés sur téléphone (une grille de 7 colonnes y serait illisible).
- **Rapports** : une ligne de chiffres clés, puis un graphique par question. Un seul axe par graphique, infobulle au survol, et chaque graphique a sa version en tableau.

## Principes d'interaction

- **Réponse immédiate.** Déplacer une carte ou créer un ticket met l'écran à jour avant la réponse du serveur ; en cas de refus, l'état réel est rechargé.
- **Édition sur place.** Dans le tiroir, titre et description sont du texte tant qu'on n'y touche pas, et s'enregistrent en quittant le champ. Pas de bouton « Enregistrer ».
- **Clavier.** `Ctrl/⌘ + K` ouvre la recherche, `C` crée un ticket, `Échap` ferme, le glisser-déposer fonctionne à la barre d'espace et aux flèches.
- **Toucher.** Appui long pour saisir une carte, afin que le défilement reste naturel. Le statut se change aussi depuis le tiroir, sans glisser.
- **Mentions.** Taper `@` propose les membres de l'espace ; flèches et Entrée pour choisir.
- **Un nom par action.** Le bouton « Créer le ticket » crée un ticket ; « Terminer le sprint » annonce ce qui arrive aux tickets restants avant de le faire.
- **États vides utiles.** Un écran vide dit quoi faire ensuite. Une erreur dit ce qui s'est passé et comment s'en sortir.

## Accessibilité

- Contraste du texte conforme AA sur toutes les surfaces.
- Focus visible partout, dialogues natifs (`<dialog>`) qui gèrent le piège du focus.
- Libellés sur tous les contrôles, y compris les boutons à icône.
- Animations coupées si le système demande moins de mouvement.

Les jetons sont définis dans `apps/web/src/index.css`, les composants de base dans `apps/web/src/ui`.

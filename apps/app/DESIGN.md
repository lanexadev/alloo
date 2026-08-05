# Alloo — direction artistique

> Source de vérité visuelle. Les tokens vivent dans `src/app/globals.css`, cette page
> explique **pourquoi** ils sont ce qu'ils sont et **quand** les utiliser.

## Le pitch en une phrase

**Un produit calme.** Surfaces neutres proche du blanc, **un** bleu utilisé avec
parcimonie, filets de 1px, élévation réservée à ce qui flotte vraiment. L'interface,
c'est le contenu plus le minimum de chrome nécessaire pour le lire.

## Principes

1. **Le bleu se mérite.** `--primary` sert à : les messages qu'on envoie, le bouton
   envoyer, le wordmark, les états actifs, les liens. Rien d'autre. Pas de bloc bleu
   décoratif, pas de fond teinté « pour faire joli ».
2. **Aucun dégradé, aucune texture, aucun halo.** Un aplat, une bordure, un filet.
   Si un élément a besoin d'un effet pour exister, c'est qu'il n'a pas sa place.
3. **L'app occupe tout l'écran.** Pas de panneau flottant, pas de marge autour de
   l'application. Les panneaux sont séparés par des bordures, pas par du vide.
4. **L'élévation est un signal, pas une décoration.** `shadow-e1/e2/e3` uniquement
   pour ce qui flotte au-dessus de la page : menus, dialogues, segment actif. Jamais
   sur une bulle, une ligne de liste ou un panneau.
5. **Densité de produit.** Rayons de 12px, cibles de 36-40px, hauteurs de ligne
   serrées, tailles de texte franches (11 / 13 / 14 / 15px). Pas de grands vides.
6. **Une seule famille typographique.** Figtree partout. Les titres se distinguent
   par le poids et le tracking, jamais par une police d'affichage.

## Couleur

| Rôle | Token | Clair | Sombre |
| --- | --- | --- | --- |
| Fond app / canevas | `--background` / `--canvas` | gris quasi blanc | ardoise neutre |
| Surface (panneaux, en-têtes, cartes) | `--surface` / `--card` | blanc | ardoise claire |
| Surface creusée (champs, segments) | `--surface-sunken` | gris clair | ardoise foncée |
| Marque | `--primary` | `oklch(.55 .21 262)` | `oklch(.62 .19 262)` |
| Marque diffuse (ligne active, réactions) | `--primary-subtle` | bleu très pâle | bleu profond |
| Présence en ligne | `--online` | vert | vert clair |
| Bulle reçue | `--bubble-in` | blanc + bordure | ardoise, sans bordure |
| Bulle envoyée | `--primary` | aplat bleu | aplat bleu |

## Typographie

Figtree, une seule famille. Poids utiles : 400 / 500 / 600.

| Usage | Taille | Poids |
| --- | --- | --- |
| Méta (heure, compteurs, libellés) | 11px | 400-500 |
| Aperçu de conversation | 13px | 400-500 |
| Interface courante, nom de conversation | 14px | 500-600 |
| Corps de message | 15px (14px ≥ sm) | 400 |
| Titre d'écran | 16-20px | 600, `tracking-tight` |

Chiffres toujours en `tabular-nums` (heures, compteurs de non-lus).

## Composants clés

**Bulles.** `rounded-bubble` (18px), aplat bleu à droite / blanc bordé à gauche,
aucune ombre. Les messages consécutifs d'un même auteur dans une fenêtre de 5 minutes
forment un bloc : coin de couture rétréci, avatar et horodatage **uniquement sur le
dernier**. La logique est pure et testée (`src/lib/message-groups.ts`).

**Séparateurs de jour.** Un filet horizontal avec la date au milieu — pas de pilule
flottante.

**Sidebar.** En-tête 56px avec le wordmark, recherche 36px, contrôle segmenté
(Tous / Non lus / Groupes), lignes de 64px. Ligne active en `primary-subtle`.

**Composer.** Un champ bordé qui prend la couleur de focus. Le bouton envoyer n'est
rempli que s'il y a quelque chose à envoyer.

**Appels.** Toujours sur fond sombre dans les deux thèmes, contrôles en verre.

## Ce qu'on ne fait pas

- Pas de dégradé, nulle part.
- Pas de texture de fond, pas de halo coloré, pas de blob flouté.
- Pas de police d'affichage, pas de logo dessiné à côté du wordmark.
- Pas d'ombre sur les bulles, les lignes de liste ou les panneaux.
- Pas d'application « en fenêtre » : le produit occupe le viewport.

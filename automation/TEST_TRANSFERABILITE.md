# Test de transférabilité : fiche pour la personne qui teste

Merci de tester notre automatisation. Le but est de savoir si quelqu'un qui ne connaît pas le projet peut l'installer avec seulement nos documents. Ne demandez pas d'aide à l'équipe pendant l'installation : si vous êtes bloqué, notez où et pourquoi, c'est exactement ce que nous cherchons.

## Ce que vous recevez

- Le dossier `automation/` : le fichier `workflow_telegram_coach_media.json`, les trois fichiers `tg_*.csv` et le `README.md`.
- Rien d'autre : pas de compte de l'équipe, pas de clé, pas d'accès à notre n8n.

## Ce dont vous avez besoin

- Un compte n8n Cloud (l'essai gratuit de 14 jours suffit) ou n8n installé sur votre machine.
- Un compte Telegram et un compte Google.
- Une clé de l'API de modèles (création gratuite, voir la section 4 du README).

## Étapes

1. Notez l'heure de début.
2. Suivez la section 5 du README, sans sauter d'étape.
3. Envoyez au bot les messages de la section 6 du README.
4. Notez l'heure de fin et remplissez la fiche ci-dessous.

## Fiche à remplir

| Question | Réponse |
|---|---|
| Nom du testeur et date | |
| Lien avec l'équipe (ami, camarade d'une autre classe…) | |
| Machine et système (Windows, macOS, Linux) | |
| n8n utilisé (Cloud ou local, version) | |
| Heure de début, heure de fin, durée totale | |
| Étapes réussies sans aide (numéros de la section 5) | |
| Étape où vous avez été bloqué, et ce qui manquait dans le README | |
| Messages de la section 6 qui ont fonctionné | |
| Messages qui n'ont pas fonctionné, avec le message d'erreur | |
| Ce qui était le plus difficile (credentials Google, clé, identifiant de la feuille…) | |
| Ce que vous changeriez dans la documentation | |
| Note de clarté du README sur 5 | |

## Pour l'équipe, après le test

Répondez à ces questions pour écrire la réflexion demandée par l'enseignante, puis reportez-la dans le tableau 12 du rapport (colonne « Test par une personne extérieure ») :

1. Combien de temps a pris l'installation, comparé aux 15 minutes annoncées ?
2. Quelles étapes ont demandé une connaissance que seule l'équipe avait ?
3. Qu'avons-nous corrigé dans le README ou le JSON après le test ?
4. Qu'est-ce que ce test montre sur la dépendance de l'automatisation à notre environnement (compte Google, clé, fuseau horaire, API GymBuddy) ?
5. Que faudrait-il automatiser ou simplifier pour qu'une installation se fasse sans aucune aide ?

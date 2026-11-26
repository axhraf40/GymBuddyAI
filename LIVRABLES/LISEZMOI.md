# GymBuddy AI : livrables du projet

Projet d'IA générative textuelle, encadré par Dr. Hasnâ CHAABI. Ce dossier regroupe tout ce qui doit être remis, dans l'ordre de la consigne (`PROJET.txt`).

| Dossier | Contenu | Point de la consigne |
|---|---|---|
| `01_Rapport/` | Rapport en Word et en PDF (11 chapitres, sommaire, listes des figures et des tableaux) | « Le rapport devrait contenir les parties les plus importantes » et le guide en 7 étapes |
| `02_Presentation/` | Présentation PowerPoint et PDF (24 diapositives, environ 20 min de projet et 5 à 10 min d'automatisation) | Présentation avec démonstration |
| `03_Application/` | `LIEN_APPLICATION.txt` (lien à envoyer la veille), guide utilisateur, guide de déploiement, plan de tests, vidéo de démonstration | Lien de l'application web |
| `04_Code_source/` | Code du backend (FastAPI) et du frontend (Next.js), sans les dépendances installées | Réalisation |
| `05_Automatisation_n8n/` | Voir ci-dessous | Partie automatisation |
| `06_Documentation/` | Documents techniques du projet (explication du code, étude de marché, cahier des charges d'origine) | Étape 5 du guide : documentation |

## 05_Automatisation_n8n

| Sous-dossier | Contenu | Point de la consigne |
|---|---|---|
| `01_Workflows_JSON/` | `workflow_telegram_coach_media.json` (principal, 83 nœuds), `workflow_gymbuddy_crm.json`, `workflow_daily_coach.json` | Le workflow n8n exporté en JSON |
| `02_README_Installation/` | `README.md` : installation, utilisation, environnement technique, dépendances, registre des credentials et des variables | README, environnement, dépendances, registre des credentials |
| `03_Architecture/` | `architecture_telegram.png` : déclencheur, traitement, IA, intégrations externes, résultat, avec les données échangées | Schéma de l'architecture |
| `04_Modeles_Google_Sheets/` | En-têtes des onglets `TG_Subscribers`, `TG_Workouts`, `TG_Meals` et modèle du CRM | Nécessaire à l'installation |
| `05_Test_Transferabilite/` | `TEST_TRANSFERABILITE.md` : fiche à donner à l'ami et questions pour la réflexion | Test de transférabilité |
| `06_Captures/` | Workflow sur n8n Cloud, journal des exécutions, conversation Telegram | Preuves de fonctionnement |

## G-Event
* Pour qui : Les associations étudiantes et leurs bénévoles (avec, en périphérie, les participants qui réservent une place)
* Problème : Les associations gèrent aujourd'hui leurs événements avec différents outils, pas de vue centralisée sur les bénévoles et la rédaction de la communication (description, posts) est refaite manuellement à chaque événement.
* Parcours :
  0. L'organisateur crée une organisation (avec un logo) et y invite des bénévoles, qui doivent accepter l'invitation
  1. L'organisateur crée un événement (infos, capacité, créneaux bénévoles nécessaires) rattaché à une ou plusieurs organisations dont il est gestionnaire : sans organisation, pas d'événement
  2. Les participants consultent la liste des événements et réservent un billet (code unique affiché)
  3. Les bénévoles s'inscrivent sur les créneaux disponibles, uniquement pour les événements d'une organisation dont ils sont membres. Un gestionnaire peut retirer un bénévole de son organisation d'un événement
  4. Le jour J, l'organisateur fait le check-in des participants (recherche + validation manuelle)
  5. L'organisateur consulte le dashboard de suivi (inscriptions, remplissage, couverture bénévoles)

* Données :
  - Comptes utilisateurs (rôles : organisateur, bénévole, participant)
  - Organisations (nom, description, logo stocké en base), membres (gestionnaire ou bénévole) et invitations à accepter
  - Événements (titre, dité, catégorie)
  - Billets / inscriptions
  - Créneaux bénévoles et affectations
  - Historique des inscriptions passées (sert de base à la prédiction IA)

* Brique IA :
  - Prédiction d'affluence à la création d'un événement, à partir de l'historique des événements similaires (catégorie, saison, capacité)
  - Génération automatique de communication (description marketing, post réseau social) à partir des infos de l'événement, éditable avant publication

* Stack : TypeScript - React (Vite) - NestJS (API REST) - PostgreSQL + Prisma

* Hors périmètre :
  - Paiement en ligne réel (billetterie gratuite/simulée)
  - Scan QR par caméra (check-in manuel uniquement)
  - Application mobile native
  - Notifications email/push réelles (mock si besoin en démo)
  - Facturation/abonnement des organisations (les organisations elles-mêmes sont dans le périmètre)

---
paths:
  - '**/modules/ai/**'
  - '**/features/ai/**'
---

# Brique IA

- **Prédiction d'affluence** : calculée à la création d'un événement à partir de l'historique d'événements similaires (catégorie, saison, capacité). Logique déterministe dans `PredictionService`, testable sans réseau.
- **Génération de communication** : toujours via `LlmProvider.generate(prompt)`, injecté avec le token `LLM_PROVIDER`. Ne jamais importer un SDK de LLM directement dans un service.
- **Nouveau fournisseur** (hors périmètre pour l'instant, seul `mock` existe) : une classe qui `implements LlmProvider`, la valeur ajoutée dans `@IsIn([...])` de `env.validation.ts`, dans `.env.example`, et le câblage dans `AiModule`.
- **Frontend** : le texte généré est toujours **éditable avant publication**, avec un état de chargement et un état d'erreur. Jamais de publication automatique.
- **Tests** : toujours avec `MockLlmProvider`, jamais d'appel réseau.

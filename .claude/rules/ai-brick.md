---
paths:
  - '**/modules/ai/**'
  - '**/features/ai/**'
---

# Brique IA

- **Prédiction d'affluence** : calculée à la création d'un événement à partir de l'historique d'événements similaires (catégorie, saison, capacité). Logique déterministe dans `PredictionService`, testable sans réseau.
- **Génération de communication** : le texte passe toujours par `LlmProvider.generate(prompt)` (token `LLM_PROVIDER`), l'image par `ImageProvider.generateImage(prompt)` (token `IMAGE_PROVIDER`, résultat en base64). Ne jamais importer un SDK de LLM directement dans un service.
- **Fournisseurs** : texte `mock` (défaut) ou `gemini` ; image `mock` (défaut) ou `cloudflare` (SDXL Lightning, affiche portrait 832×1176 au ratio A, `fetch` direct, secrets dans un header). Le choix se fait dans `createLlmProvider` et `createImageProvider` (`llm-provider.factory.ts`) : sans clé, repli sur le mock.
- **Nouveau fournisseur** : une classe qui `implements LlmProvider` ou `ImageProvider`, la valeur ajoutée dans `@IsIn([...])` de `env.validation.ts`, dans `.env.example`, et le cas dans la fabrique correspondante.
- **Frontend** : le texte généré est toujours **éditable avant publication**, avec un état de chargement et un état d'erreur. Jamais de publication automatique.
- **Tests** : toujours avec `MockLlmProvider`, jamais d'appel réseau.

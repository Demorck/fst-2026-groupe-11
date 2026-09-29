export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  generate(prompt: string): Promise<string>;
}

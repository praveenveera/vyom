// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild Server — Plugin bootstrap
//
// Called once at startup after engine.initialize(). Registers all built-in
// model plugins (Tier 1 trusted — same process). Each plugin is initialized
// with any stored API key from the workspace model configs.
//
// If no model config exists yet for a provider, the plugin is still registered
// so it can be configured later via POST /workspace/models.
// ─────────────────────────────────────────────────────────────────────────────

import type { GarageBuildPlugin, PluginConfig } from '@garagebuild/plugin-sdk';
import type { GarageBuildEngine } from '@garagebuild/engine';
import { OpenAIPlugin } from '@garagebuild/plugin-openai';
import { AnthropicPlugin } from '@garagebuild/plugin-anthropic';
import { OllamaPlugin } from '@garagebuild/plugin-ollama';

const KNOWN_PROVIDERS = ['openai', 'anthropic', 'ollama'] as const;
type KnownProvider = (typeof KNOWN_PROVIDERS)[number];

export function createPlugin(provider: string): GarageBuildPlugin | null {
  switch (provider as KnownProvider) {
    case 'openai':    return new OpenAIPlugin();
    case 'anthropic': return new AnthropicPlugin();
    case 'ollama':    return new OllamaPlugin();
    default:          return null;
  }
}

export async function bootstrapPlugins(engine: GarageBuildEngine): Promise<void> {
  const modelConfigs = engine.workspaceManager.listModelConfigs();

  for (const provider of KNOWN_PROVIDERS) {
    const plugin = createPlugin(provider);
    if (!plugin) continue;

    // Use stored credentials from the first model config for this provider
    const stored = modelConfigs.find(m => m.provider === provider);
    const pluginConfig: PluginConfig = {
      ...(stored?.apiKeyRef !== undefined && { apiKey: stored.apiKeyRef }),
      ...(stored?.baseUrl   !== undefined && { baseUrl: stored.baseUrl   }),
    };

    await engine.pluginRegistry.register(plugin, pluginConfig);
  }
}

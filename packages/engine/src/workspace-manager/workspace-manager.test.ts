// ─────────────────────────────────────────────────────────────────────────────
// VYOM Engine — WorkspaceManager Tests
// ─────────────────────────────────────────────────────────────────────────────

import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { jest } from '@jest/globals';
import { WorkspaceManager } from './workspace-manager.js';
import { eventBus } from '../event-bus/event-bus.js';

// Use a temp directory for each test run so tests never share state
function tempDbPath(): string {
  return join(tmpdir(), `vyom-test-${randomUUID()}.db`);
}

describe('WorkspaceManager', () => {
  let manager: WorkspaceManager;
  let dbPath: string;

  beforeEach(() => {
    dbPath = tempDbPath();
    manager = new WorkspaceManager();
    eventBus.removeAllListeners();
  });

  afterEach(() => {
    manager.close();
  });

  // ── initialize ─────────────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('creates a workspace on first run', async () => {
      const workspace = await manager.initialize(dbPath);
      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBe('My Workspace');
      expect(workspace.owner).toBe('local');
    });

    it('emits workspace.created on first run', async () => {
      const handler = jest.fn<(payload: { workspaceId: string; name: string }) => void>();
      eventBus.on('workspace.created', handler);
      await manager.initialize(dbPath);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('loads existing workspace on subsequent runs', async () => {
      const first = await manager.initialize(dbPath);
      manager.close();

      const manager2 = new WorkspaceManager();
      const second = await manager2.initialize(dbPath);
      expect(second.id).toBe(first.id);
      manager2.close();
    });

    it('does not emit workspace.created on subsequent runs', async () => {
      await manager.initialize(dbPath);
      manager.close();

      const handler = jest.fn<(payload: { workspaceId: string; name: string }) => void>();
      eventBus.on('workspace.created', handler);

      const manager2 = new WorkspaceManager();
      await manager2.initialize(dbPath);
      expect(handler).not.toHaveBeenCalled();
      manager2.close();
    });
  });

  // ── getWorkspace ───────────────────────────────────────────────────────────

  describe('getWorkspace()', () => {
    it('returns the workspace after initialize', async () => {
      await manager.initialize(dbPath);
      const workspace = manager.getWorkspace();
      expect(workspace).toBeDefined();
      expect(workspace.name).toBe('My Workspace');
    });

    it('throws if called before initialize', () => {
      expect(() => manager.getWorkspace()).toThrow('not initialized');
    });
  });

  // ── updateSettings ─────────────────────────────────────────────────────────

  describe('updateSettings()', () => {
    it('merges new settings with existing ones', async () => {
      await manager.initialize(dbPath);
      const updated = manager.updateSettings({ theme: 'dark' });
      expect(updated.settings.theme).toBe('dark');
    });

    it('emits workspace.updated', async () => {
      await manager.initialize(dbPath);
      const handler = jest.fn<(payload: { workspaceId: string }) => void>();
      eventBus.on('workspace.updated', handler);
      manager.updateSettings({ theme: 'light' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('persists settings across restarts', async () => {
      await manager.initialize(dbPath);
      manager.updateSettings({ theme: 'dark', telemetryEnabled: false });
      manager.close();

      const manager2 = new WorkspaceManager();
      await manager2.initialize(dbPath);
      const workspace = manager2.getWorkspace();
      expect(workspace.settings.theme).toBe('dark');
      expect(workspace.settings.telemetryEnabled).toBe(false);
      manager2.close();
    });
  });

  // ── addModelConfig ─────────────────────────────────────────────────────────

  describe('addModelConfig()', () => {
    it('adds a model config and returns it', async () => {
      await manager.initialize(dbPath);
      const config = manager.addModelConfig({
        provider: 'ollama',
        modelName: 'llama3',
        displayName: 'Llama 3',
        isLocal: true,
      });
      expect(config.id).toBeDefined();
      expect(config.provider).toBe('ollama');
      expect(config.modelName).toBe('llama3');
      expect(config.isLocal).toBe(true);
    });

    it('automatically activates the first model added', async () => {
      await manager.initialize(dbPath);
      const config = manager.addModelConfig({
        provider: 'ollama',
        modelName: 'llama3',
        displayName: 'Llama 3',
        isLocal: true,
      });
      expect(config.isActive).toBe(true);
    });

    it('does not activate subsequent models automatically', async () => {
      await manager.initialize(dbPath);
      manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      const second = manager.addModelConfig({ provider: 'openai', modelName: 'gpt-4o', displayName: 'GPT-4o' });
      expect(second.isActive).toBe(false);
    });

    it('emits model.configured', async () => {
      await manager.initialize(dbPath);
      const handler = jest.fn<(payload: { modelId: string; provider: string; model: string }) => void>();
      eventBus.on('model.configured', handler);
      manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── listModelConfigs ───────────────────────────────────────────────────────

  describe('listModelConfigs()', () => {
    it('returns empty array when no models configured', async () => {
      await manager.initialize(dbPath);
      expect(manager.listModelConfigs()).toEqual([]);
    });

    it('returns all configured models', async () => {
      await manager.initialize(dbPath);
      manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      manager.addModelConfig({ provider: 'openai', modelName: 'gpt-4o', displayName: 'GPT-4o' });
      expect(manager.listModelConfigs()).toHaveLength(2);
    });
  });

  // ── getActiveModel ─────────────────────────────────────────────────────────

  describe('getActiveModel()', () => {
    it('returns undefined when no models configured', async () => {
      await manager.initialize(dbPath);
      expect(manager.getActiveModel()).toBeUndefined();
    });

    it('returns the active model', async () => {
      await manager.initialize(dbPath);
      manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      const active = manager.getActiveModel();
      expect(active?.modelName).toBe('llama3');
    });
  });

  // ── setActiveModel ─────────────────────────────────────────────────────────

  describe('setActiveModel()', () => {
    it('switches the active model', async () => {
      await manager.initialize(dbPath);
      manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      const second = manager.addModelConfig({ provider: 'openai', modelName: 'gpt-4o', displayName: 'GPT-4o' });
      manager.setActiveModel(second.id);
      expect(manager.getActiveModel()?.modelName).toBe('gpt-4o');
    });

    it('deactivates the previous active model', async () => {
      await manager.initialize(dbPath);
      const first = manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      const second = manager.addModelConfig({ provider: 'openai', modelName: 'gpt-4o', displayName: 'GPT-4o' });
      manager.setActiveModel(second.id);
      const models = manager.listModelConfigs();
      const firstModel = models.find(m => m.id === first.id);
      expect(firstModel?.isActive).toBe(false);
    });

    it('throws if model id does not exist', async () => {
      await manager.initialize(dbPath);
      expect(() => manager.setActiveModel('non-existent-id')).toThrow('not found');
    });

    it('emits model.switched', async () => {
      await manager.initialize(dbPath);
      manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      const second = manager.addModelConfig({ provider: 'openai', modelName: 'gpt-4o', displayName: 'GPT-4o' });
      const handler = jest.fn<(payload: { from: string; to: string; sessionId: string }) => void>();
      eventBus.on('model.switched', handler);
      manager.setActiveModel(second.id);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ── removeModelConfig ──────────────────────────────────────────────────────

  describe('removeModelConfig()', () => {
    it('removes a model config', async () => {
      await manager.initialize(dbPath);
      const config = manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      manager.removeModelConfig(config.id);
      expect(manager.listModelConfigs()).toHaveLength(0);
    });

    it('activates next model when active model is removed', async () => {
      await manager.initialize(dbPath);
      const first = manager.addModelConfig({ provider: 'ollama', modelName: 'llama3', displayName: 'Llama 3', isLocal: true });
      manager.addModelConfig({ provider: 'openai', modelName: 'gpt-4o', displayName: 'GPT-4o' });
      manager.removeModelConfig(first.id);
      expect(manager.getActiveModel()?.modelName).toBe('gpt-4o');
    });

    it('throws if model id does not exist', async () => {
      await manager.initialize(dbPath);
      expect(() => manager.removeModelConfig('non-existent-id')).toThrow('not found');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GarageBuild plugin-react — Tests
// ─────────────────────────────────────────────────────────────────────────────

import { ReactPlugin } from './react-plugin.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePlugin(): ReactPlugin {
  const p = new ReactPlugin();
  return p;
}

async function init(plugin: ReactPlugin): Promise<void> {
  await plugin.initialize({});
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ReactPlugin', () => {
  // ── manifest / config ──────────────────────────────────────────────────────

  describe('getManifest()', () => {
    it('returns manifest with id "react" and type "framework"', () => {
      const plugin = makePlugin();
      const m = plugin.getManifest();
      expect(m.id).toBe('react');
      expect(m.type).toBe('framework');
    });
  });

  describe('healthCheck()', () => {
    it('returns healthy after initialize', async () => {
      const plugin = makePlugin();
      await init(plugin);
      const result = await plugin.healthCheck();
      expect(result.status).toBe('healthy');
    });
  });

  // ── createProject ──────────────────────────────────────────────────────────

  describe('createProject()', () => {
    it('returns files, installCommand and devCommand', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'my-app',
        framework: 'react',
        typescript: true,
        tailwind: false,
        outputPath: '/tmp/my-app',
      });

      expect(scaffold.installCommand).toBe('npm install');
      expect(scaffold.devCommand).toBe('npm run dev');
      expect(scaffold.files.length).toBeGreaterThan(0);
    });

    it('includes package.json with react dependency', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'my-app',
        framework: 'react',
        typescript: true,
        tailwind: false,
        outputPath: '/tmp/my-app',
      });

      const pkg = scaffold.files.find(f => f.path === 'package.json');
      expect(pkg).toBeDefined();
      const parsed = JSON.parse(pkg!.content) as { dependencies: Record<string, string> };
      expect(parsed.dependencies['react']).toBeDefined();
    });

    it('includes tsconfig.json when typescript is true', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'ts-app',
        framework: 'react',
        typescript: true,
        tailwind: false,
        outputPath: '/tmp/ts-app',
      });

      const tsconfig = scaffold.files.find(f => f.path === 'tsconfig.json');
      expect(tsconfig).toBeDefined();
    });

    it('omits tsconfig.json when typescript is false', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'js-app',
        framework: 'react',
        typescript: false,
        tailwind: false,
        outputPath: '/tmp/js-app',
      });

      const tsconfig = scaffold.files.find(f => f.path === 'tsconfig.json');
      expect(tsconfig).toBeUndefined();
    });

    it('uses .jsx extension when typescript is false', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'js-app',
        framework: 'react',
        typescript: false,
        tailwind: false,
        outputPath: '/tmp/js-app',
      });

      const main = scaffold.files.find(f => f.path.startsWith('src/main'));
      expect(main?.path).toMatch(/\.jsx$/);
    });

    it('includes Tailwind files when tailwind is true', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'tw-app',
        framework: 'react',
        typescript: true,
        tailwind: true,
        outputPath: '/tmp/tw-app',
      });

      const paths = scaffold.files.map(f => f.path);
      expect(paths).toContain('src/index.css');
      expect(paths).toContain('tailwind.config.js');
      expect(paths).toContain('postcss.config.js');
    });

    it('omits Tailwind files when tailwind is false', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'no-tw',
        framework: 'react',
        typescript: true,
        tailwind: false,
        outputPath: '/tmp/no-tw',
      });

      const paths = scaffold.files.map(f => f.path);
      expect(paths).not.toContain('src/index.css');
      expect(paths).not.toContain('tailwind.config.js');
    });

    it('all returned files have action "create"', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'my-app',
        framework: 'react',
        typescript: true,
        tailwind: true,
        outputPath: '/tmp/my-app',
      });

      for (const file of scaffold.files) {
        expect(file.action).toBe('create');
      }
    });

    it('includes the project name in index.html', async () => {
      const plugin = makePlugin();
      const scaffold = await plugin.createProject({
        name: 'awesome-app',
        framework: 'react',
        typescript: true,
        tailwind: false,
        outputPath: '/tmp/awesome-app',
      });

      const html = scaffold.files.find(f => f.path === 'index.html');
      expect(html?.content).toMatch('awesome-app');
    });
  });

  // ── validateProject ────────────────────────────────────────────────────────

  describe('validateProject()', () => {
    it('returns valid: false when path does not have package.json', async () => {
      const plugin = makePlugin();
      const result = await plugin.validateProject('/nonexistent/path');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  // ── generateComponent ──────────────────────────────────────────────────────

  describe('generateComponent()', () => {
    it('generates a .tsx file under src/components/', async () => {
      const plugin = makePlugin();
      const files = await plugin.generateComponent({
        name: 'Button',
        description: 'A reusable button',
      });

      expect(files).toHaveLength(1);
      expect(files[0]?.path).toBe('src/components/Button.tsx');
    });

    it('exports the component by name', async () => {
      const plugin = makePlugin();
      const [file] = await plugin.generateComponent({
        name: 'Card',
        description: 'A card component',
      });

      expect(file?.content).toMatch('export default Card');
    });

    it('includes prop types when props are provided', async () => {
      const plugin = makePlugin();
      const [file] = await plugin.generateComponent({
        name: 'Avatar',
        description: 'User avatar',
        props: { src: 'string', alt: 'string' },
      });

      expect(file?.content).toMatch('src: string');
      expect(file?.content).toMatch('alt: string');
    });
  });

  // ── generatePage ───────────────────────────────────────────────────────────

  describe('generatePage()', () => {
    it('generates a page file under src/pages/', async () => {
      const plugin = makePlugin();
      const files = await plugin.generatePage({
        name: 'Home',
        route: '/',
        description: 'Landing page',
      });

      expect(files).toHaveLength(1);
      expect(files[0]?.path).toBe('src/pages/HomePage.tsx');
    });

    it('exports the page by name', async () => {
      const plugin = makePlugin();
      const [file] = await plugin.generatePage({
        name: 'About',
        route: '/about',
        description: 'About page',
      });

      expect(file?.content).toMatch('export default AboutPage');
    });
  });

  // ── generateDockerfile ─────────────────────────────────────────────────────

  describe('generateDockerfile()', () => {
    it('returns a string with FROM and EXPOSE instructions', async () => {
      const plugin = makePlugin();
      const df = await plugin.generateDockerfile({
        id: 'p1',
        name: 'my-app',
        framework: 'react',
        path: '/tmp/my-app',
      });

      expect(df).toMatch(/FROM node/);
      expect(df).toMatch(/EXPOSE 80/);
      expect(df).toMatch(/nginx/);
    });

    it('is a multi-stage build', async () => {
      const plugin = makePlugin();
      const df = await plugin.generateDockerfile({
        id: 'p1',
        name: 'my-app',
        framework: 'react',
        path: '/tmp/my-app',
      });

      const fromCount = (df.match(/^FROM /gm) ?? []).length;
      expect(fromCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ── lifecycle ──────────────────────────────────────────────────────────────

  describe('teardown()', () => {
    it('can be called without error', async () => {
      const plugin = makePlugin();
      await init(plugin);
      await expect(plugin.teardown()).resolves.toBeUndefined();
    });
  });
});

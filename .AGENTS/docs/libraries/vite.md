# Vite Documentation

> **Version:** v8.0.8
> **Package:** `vite@^8.0.8`
> **Vite Plugin:** `@sveltejs/vite-plugin-svelte@^7.0.0`

## Overview

Vite (French for "fast") is the next-generation frontend tooling for building modern web applications. In the `vibe-coded` party game framework, Vite powers the client-side development server and production builds for `@partygame/client` and all game applications (e.g., `wit-clash`). Vite provides blazing-fast Hot Module Replacement (HMR), optimized builds, and native ES modules support out of the box.

Vite 8 is the first version powered by the new **Rolldown** compiler (replacing esbuild/rollup), offering faster builds and improved compatibility. The project uses Vite for:
- **Development server** with instant HMR for Svelte 5 components
- **Production builds** with optimized, minified bundles
- **Library mode** for `@partygame/client` package

## Key Concepts

| Concept | Description |
|---------|-------------|
| **ESM-first** | Native ES modules in development and production |
| **Rolldown** | New compiler in Vite 8, replacing esbuild for bundling |
| **HMR** | Hot Module Replacement - instant updates without page reload |
| **Optimized Builds** | Pre-bundling dependencies, code-splitting, and tree-shaking |
| **Plugins** | Extensible architecture for framework integrations |
| **Server-side Rendering** | Built-in SSR support (not used in this project) |

## Installation

### For Application (Games)

```bash
# Using Bun (recommended)
bun add -D vite @sveltejs/vite-plugin-svelte

# Using npm
npm install -D vite @sveltejs/vite-plugin-svelte
```

### For Library Mode (client package)

```bash
# Using Bun (recommended)
bun add -D vite @sveltejs/vite-plugin-svelte typescript

# Using npm
npm install -D vite @sveltejs/vite-plugin-svelte typescript
```

## Project Configuration

### Game Configuration (Wit Clash)

**`games/wit-clash/vite.config.ts`:**
```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
});
```

### Client Package Configuration

**`packages/client/vite.config.ts`:**
```typescript
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [svelte()],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "PartyGameClient",
      fileName: "index",
    },
    rollupOptions: {
      external: ["@partygame/shared", "@partygame/core", "@colyseus/sdk"],
      output: {
        globals: {
          "@partygame/shared": "PartyGameShared",
          "@partygame/core": "PartyGameCore",
          "@colyseus/sdk": "ColyseusSDK",
        },
      },
    },
  },
});
```

### Root Configuration

The monorepo uses a root `vite.config.mts` for shared settings and `vitest.workspace.ts` for workspace configuration.

## Common Commands

| Command | Description |
|---------|-------------|
| `vite` | Start development server |
| `vite build` | Build for production |
| `vite preview` | Preview production build locally |
| `vite optimize` | Pre-bundle dependencies |

### Project-specific

| Project | Command |
|---------|---------|
| `@partygame/client` | `bun run dev` (starts Vite dev server) |
| `@partygame/client` | `bun run build` (produces library build) |
| `wit-clash` | `bun run dev` (starts game dev server) |

## Vite 8 Changes

Vite 8 introduced **Rolldown** as the new bundler, replacing esbuild for the build pipeline:

| Feature | Vite 7 (esbuild) | Vite 8 (Rolldown) |
|---------|----------------|------------------|
| **Compiler** | esbuild | Rolldown (Rust-based) |
| **Speed** | Fast | Faster (parallel processing) |
| **Compatibility** | Good | Improved CSS, Asset handling |
| **`optimizeDeps`** | esbuildOptions | Removed (Rolldown handles) |
| **CSS** | Basic | Full CSS support with nesting |

**Migration Notes:**
- Remove `optimizeDeps.esbuildOptions` from configs (no longer supported in Rolldown)
- Rolldown handles TypeScript transforms internally

## Svelte 5 Integration

The project uses `@sveltejs/vite-plugin-svelte@^7.0.0` which supports Svelte 5's Runes system and the new compiler.

### Plugin Options

```typescript
import { svelte } from "@sveltejs/vite-plugin-svelte";

plugins: [
  svelte({
    // Enable runes mode (Svelte 5 default)
    compilerOptions: {
      runes: true,
    },
    // Preprocess options
    preprocess: [/* ... */],
    // Hot module replacement
    hot: {
      // Default: true for non-library mode
      // Set to false for library builds
    },
  }),
],
```

## Best Practices in This Project

- **Prefer ESM imports.** Use `import` over `require` for all modules.
- **Use `bun run dev` for development.** Bun's fast execution pairs well with Vite's HMR.
- **Configure `base` for production.** Set `base` in vite.config for correct asset paths when deploying.
- **Externalize shared packages.** In library mode, externalize `@partygame/*` packages to avoid duplication.
- **Use environment variables.** Access via `import.meta.env.VITE_*` prefix for client-side variables.

### Environment Variables

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.npm_package_version),
  },
});
```

```typescript
// In client code
const version = import.meta.env.VITE_APP_VERSION;
```

## Project Structure

### Development Scripts

**`package.json` (game):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  }
}
```

**`package.json` (client library):**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "rm -rf dist && tsc && vite build",
    "preview": "vite preview"
  }
}
```

## Troubleshooting

### HMR Not Working

**Symptom:** Changes don't appear without page refresh.
**Solution:** Ensure `import.meta.hot` is not being accessed in a way that prevents HMR. Check for syntax errors that might break the connection.

### Build Fails with Rolldown

**Symptom:** Build errors in Vite 8 that worked in Vite 7.
**Solution:** Check for retired options (like `esbuildOptions`). Read the [Vite 8 Migration Guide](https://vite.dev/guide/migration.html).

### Styles Not Loading

**Symptom:** CSS not applied in development.
**Solution:** Ensure CSS files are imported in your entry file or referenced in Svelte components.

## References

- [Official Docs](https://vite.dev)
- [Rolldown Compiler](https://rolldown.js.org)
- [Svelte Plugin](https://github.com/sveltejs/vite-plugin-svelte)
- [LLM Index](https://vite.dev/llms.txt)
- [Vite 8 Migration Guide](https://vite.dev/guide/migration.html)

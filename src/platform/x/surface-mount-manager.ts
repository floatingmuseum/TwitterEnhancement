import type { XNoteSurfaceTarget } from './dom-adapter';

export interface MountedXNoteSurface {
  updateAppearance(): void;
  destroy(): void;
}

export type MountXNoteSurface = (target: XNoteSurfaceTarget) => MountedXNoteSurface;

interface MountEntry {
  target: XNoteSurfaceTarget;
  mounted: MountedXNoteSurface;
}

export interface XSurfaceMountManager {
  sync(targets: XNoteSurfaceTarget[]): void;
  destroyAll(): void;
}

export function createXSurfaceMountManager(mount: MountXNoteSurface): XSurfaceMountManager {
  const entries = new Map<HTMLElement, MountEntry>();

  function sync(targets: XNoteSurfaceTarget[]) {
    const visibleAnchors = new Set<HTMLElement>();

    for (const target of targets) {
      visibleAnchors.add(target.anchor);
      const existing = entries.get(target.anchor);

      if (
        existing &&
        existing.target.handle === target.handle &&
        existing.target.displayName === target.displayName &&
        existing.target.surface === target.surface &&
        existing.target.inlineContainer === target.inlineContainer
      ) {
        existing.mounted.updateAppearance();
        continue;
      }

      existing?.mounted.destroy();
      entries.set(target.anchor, { target, mounted: mount(target) });
    }

    for (const [anchor, entry] of entries) {
      if (!visibleAnchors.has(anchor) || !anchor.isConnected) {
        entry.mounted.destroy();
        entries.delete(anchor);
      }
    }
  }

  function destroyAll() {
    for (const entry of entries.values()) {
      entry.mounted.destroy();
    }
    entries.clear();
  }

  return { sync, destroyAll };
}

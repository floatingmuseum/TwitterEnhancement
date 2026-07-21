import type { XNoteSurfaceTarget } from '../src/platform/x/dom-adapter';
import { createXSurfaceMountManager } from '../src/platform/x/surface-mount-manager';

function target(
  anchor: HTMLElement,
  handle = 'alice',
  surface: XNoteSurfaceTarget['surface'] = 'profile',
  displayName = 'Alice',
): XNoteSurfaceTarget {
  return { anchor, handle, displayName, surface };
}

describe('X surface mount manager', () => {
  it('mounts each anchor once and updates appearance on repeated scans', () => {
    const anchor = document.createElement('div');
    document.body.append(anchor);
    const updateAppearance = vi.fn();
    const destroy = vi.fn();
    const mount = vi.fn(() => ({ updateAppearance, destroy }));
    const manager = createXSurfaceMountManager(mount);

    manager.sync([target(anchor)]);
    manager.sync([target(anchor)]);

    expect(mount).toHaveBeenCalledTimes(1);
    expect(updateAppearance).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();
  });

  it('remounts a reused hover-card anchor when its handle changes', () => {
    const anchor = document.createElement('div');
    document.body.append(anchor);
    const firstDestroy = vi.fn();
    const secondDestroy = vi.fn();
    const mount = vi
      .fn()
      .mockReturnValueOnce({ updateAppearance: vi.fn(), destroy: firstDestroy })
      .mockReturnValueOnce({ updateAppearance: vi.fn(), destroy: secondDestroy });
    const manager = createXSurfaceMountManager(mount);

    manager.sync([target(anchor, 'alice', 'hover-card')]);
    manager.sync([target(anchor, 'bob', 'hover-card')]);

    expect(firstDestroy).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledTimes(2);
  });

  it('remounts a surface when the observed display name changes', () => {
    const anchor = document.createElement('div');
    document.body.append(anchor);
    const firstDestroy = vi.fn();
    const mount = vi
      .fn()
      .mockReturnValueOnce({ updateAppearance: vi.fn(), destroy: firstDestroy })
      .mockReturnValueOnce({ updateAppearance: vi.fn(), destroy: vi.fn() });
    const manager = createXSurfaceMountManager(mount);

    manager.sync([target(anchor, 'alice', 'profile', 'Alice')]);
    manager.sync([target(anchor, 'alice', 'profile', 'Alice Updated')]);

    expect(firstDestroy).toHaveBeenCalledOnce();
    expect(mount).toHaveBeenCalledTimes(2);
  });

  it('unmounts surfaces removed by SPA navigation', () => {
    const anchor = document.createElement('div');
    document.body.append(anchor);
    const destroy = vi.fn();
    const manager = createXSurfaceMountManager(() => ({
      updateAppearance: vi.fn(),
      destroy,
    }));

    manager.sync([target(anchor)]);
    anchor.remove();
    manager.sync([]);

    expect(destroy).toHaveBeenCalledOnce();
  });
});

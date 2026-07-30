import { createXInterfaceModuleManager } from '../src/platform/x/interface-module-manager';
import {
  INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS,
  LocalInterfaceModuleVisibilityRepository,
} from '../src/shared/storage/interface-module-visibility-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

function renderXModules() {
  document.body.innerHTML = `
    <main data-testid="primaryColumn">
      <div id="timeline-follow" data-testid="cellInnerDiv">
        <h2>Who to follow</h2>
        <div data-testid="UserCell">Alice</div>
        <a href="/i/connect_people">Show more</a>
      </div>
      <div id="ordinary-cell" data-testid="cellInnerDiv">
        <article>Regular post</article>
      </div>
    </main>
    <aside data-testid="sidebarColumn">
      <form id="sidebar-search" role="search">
        <input data-testid="SearchBox_Search_Input" />
      </form>
      <aside id="premium-card" style="display: grid">
        <h2>Subscribe to Premium</h2>
        <a data-testid="premium-signup-tab" href="/i/premium_sign_up">Subscribe</a>
      </aside>
      <section id="trend-card" aria-label="Timeline: Trending now">
        <h2>What's happening</h2>
        <a href="/explore">Show more</a>
      </section>
      <aside id="sidebar-follow">
        <h2>Who to follow</h2>
        <div data-testid="UserCell">Bob</div>
        <a href="/i/connect_people">Show more</a>
      </aside>
      <footer id="sidebar-footer">Terms</footer>
    </aside>
  `;
}

describe('X interface module manager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('hides the four configured modules and restores their original styles', async () => {
    renderXModules();
    const storage = new FakeExtensionLocalStorage();
    for (const storageKey of Object.values(
      INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS,
    )) {
      storage.values.set(storageKey, false);
    }
    const repository = new LocalInterfaceModuleVisibilityRepository(storage);
    const manager = createXInterfaceModuleManager(repository);

    await vi.waitFor(() => {
      expect(document.getElementById('timeline-follow')).toHaveStyle({
        display: 'none',
      });
      expect(document.getElementById('sidebar-follow')).toHaveStyle({
        display: 'none',
      });
      expect(document.getElementById('trend-card')).toHaveStyle({ display: 'none' });
      expect(document.getElementById('premium-card')).toHaveStyle({ display: 'none' });
      expect(document.getElementById('sidebar-search')).toHaveStyle({ display: 'none' });
    });
    expect(document.getElementById('ordinary-cell')).not.toHaveStyle({
      display: 'none',
    });
    expect(document.getElementById('sidebar-footer')).not.toHaveStyle({
      display: 'none',
    });

    await repository.setModuleVisibility('followRecommendations', true);
    expect(document.getElementById('timeline-follow')).not.toHaveStyle({
      display: 'none',
    });
    expect(document.getElementById('sidebar-follow')).not.toHaveStyle({
      display: 'none',
    });
    expect(document.getElementById('trend-card')).toHaveStyle({ display: 'none' });

    await repository.setModuleVisibility('premiumSubscription', true);
    expect(document.getElementById('premium-card')).toHaveStyle({ display: 'grid' });

    manager.destroy();
    expect(document.getElementById('trend-card')).not.toHaveStyle({
      display: 'none',
    });
    expect(document.getElementById('sidebar-search')).not.toHaveStyle({
      display: 'none',
    });
  });

  it('hides recommendation modules inserted after the initial scan', async () => {
    renderXModules();
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(
      INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS.followRecommendations,
      false,
    );
    const repository = new LocalInterfaceModuleVisibilityRepository(storage);
    const manager = createXInterfaceModuleManager(repository);

    await vi.waitFor(() => {
      expect(document.getElementById('sidebar-follow')).toHaveStyle({
        display: 'none',
      });
    });

    const newCell = document.createElement('div');
    newCell.id = 'new-follow-cell';
    newCell.dataset.testid = 'cellInnerDiv';
    newCell.innerHTML = `
      <h2>Who to follow</h2>
      <div data-testid="UserCell">Carol</div>
      <a href="/i/connect_people">Show more</a>
    `;
    document.querySelector('main')?.append(newCell);
    manager.sync();

    expect(newCell).toHaveStyle({ display: 'none' });
    manager.destroy();
  });

  it('hides the bordered card around a sidebar recommendation region', async () => {
    document.body.innerHTML = `
      <div data-testid="sidebarColumn">
        <div
          id="follow-card-shell"
          style="border: 1px solid rgb(47, 51, 54); border-radius: 16px"
        >
          <section id="follow-card-content" role="region">
            <h2>Who to follow</h2>
            <div data-testid="UserCell">Alice</div>
            <a href="/i/connect_people">Show more</a>
          </section>
        </div>
      </div>
    `;
    const storage = new FakeExtensionLocalStorage();
    storage.values.set(
      INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS.followRecommendations,
      false,
    );
    const repository = new LocalInterfaceModuleVisibilityRepository(storage);
    const manager = createXInterfaceModuleManager(repository);

    await vi.waitFor(() => {
      expect(document.getElementById('follow-card-shell')).toHaveStyle({
        display: 'none',
      });
    });

    expect(document.getElementById('follow-card-content')).not.toHaveStyle({
      display: 'none',
    });
    manager.destroy();
  });
});

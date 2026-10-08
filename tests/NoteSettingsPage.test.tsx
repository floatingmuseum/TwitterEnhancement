import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ListRepostPreferences } from '../src/features/list-reposts/list-repost-preference';
import { NoteSettingsPage } from '../src/features/user-notes/NoteSettingsPage';
import {
  INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS,
  LocalInterfaceModuleVisibilityRepository,
} from '../src/shared/storage/interface-module-visibility-repository';
import {
  HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY,
  HIDE_ADS_STORAGE_KEY,
  LocalListRepostPreferenceRepository,
  SHOW_LIST_REPOSTS_STORAGE_KEY,
} from '../src/shared/storage/list-repost-preference-repository';
import { LocalUserNoteRepository } from '../src/shared/storage/user-note-repository';
import { FakeExtensionLocalStorage } from './fakes/fake-storage';

describe('NoteSettingsPage', () => {
  it('lists local notes and searches display names, handles, and note text', async () => {
    const user = userEvent.setup();
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    const interfaceModuleRepository =
      new LocalInterfaceModuleVisibilityRepository(storage);
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);
    await repository.importNotes(
      [
        {
          version: 1,
          handle: 'alice',
          displayName: 'Alice Zhang',
          text: '产品设计',
          updatedAt: 200,
        },
        {
          version: 1,
          handle: 'bob',
          displayName: 'Bob Li',
          text: '安全研究',
          updatedAt: 100,
        },
      ],
      'replace',
    );

    render(
      <NoteSettingsPage
        repository={repository}
        interfaceModuleRepository={interfaceModuleRepository}
        listRepostRepository={listRepostRepository}
      />,
    );

    expect(await screen.findByText('@alice')).toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.getByText('Alice Zhang')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: '搜索备注' }), '安全');
    expect(screen.queryByText('@alice')).not.toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
    expect(screen.getByText('显示 1 / 2 条')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: '搜索备注' }));
    await user.type(screen.getByRole('searchbox', { name: '搜索备注' }), 'alice');
    expect(screen.getByText('@alice')).toBeInTheDocument();
    expect(screen.queryByText('@bob')).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: '搜索备注' }));
    await user.type(screen.getByRole('searchbox', { name: '搜索备注' }), 'Bob Li');
    expect(screen.queryByText('@alice')).not.toBeInTheDocument();
    expect(screen.getByText('@bob')).toBeInTheDocument();
  });

  it('selects and persists the hidden repost display mode', async () => {
    const user = userEvent.setup();
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    const interfaceModuleRepository =
      new LocalInterfaceModuleVisibilityRepository(storage);
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);

    render(
      <NoteSettingsPage
        repository={repository}
        interfaceModuleRepository={interfaceModuleRepository}
        listRepostRepository={listRepostRepository}
      />,
    );

    const hiddenMode = await screen.findByRole('radio', { name: /完全隐藏/ });
    const dividerMode = screen.getByRole('radio', { name: /灰线提示/ });
    expect(
      screen.getByRole('heading', { name: '隐藏转贴的呈现方式' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('一条来自某用户的转贴已被收起，点击可还原'),
    ).toHaveLength(3);
    expect(hiddenMode).toBeChecked();

    await user.click(dividerMode);

    expect(dividerMode).toBeChecked();
    expect(storage.values.get(HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY)).toBe(
      'divider',
    );
  });

  it('persists each X interface module switch independently', async () => {
    const user = userEvent.setup();
    const storage = new FakeExtensionLocalStorage();
    const repository = new LocalUserNoteRepository(storage);
    const interfaceModuleRepository =
      new LocalInterfaceModuleVisibilityRepository(storage);
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);

    render(
      <NoteSettingsPage
        repository={repository}
        interfaceModuleRepository={interfaceModuleRepository}
        listRepostRepository={listRepostRepository}
      />,
    );

    const trendsSwitch = await screen.findByRole('switch', { name: '新鲜事' });
    const searchSwitch = screen.getByRole('switch', { name: '右栏搜索框' });
    expect(trendsSwitch).toBeChecked();
    expect(searchSwitch).toBeChecked();

    await user.click(trendsSwitch);

    expect(trendsSwitch).not.toBeChecked();
    expect(searchSwitch).toBeChecked();
    expect(
      storage.values.get(INTERFACE_MODULE_VISIBILITY_STORAGE_KEYS.trends),
    ).toBe(false);
  });

  it('enables ad hiding by default and persists it independently of repost settings', async () => {
    const user = userEvent.setup();
    const storage = new FakeExtensionLocalStorage();
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);
    await listRepostRepository.setShowReposts(true);
    await listRepostRepository.setHiddenRepostDisplayMode('social-context');
    render(
      <NoteSettingsPage
        repository={new LocalUserNoteRepository(storage)}
        interfaceModuleRepository={new LocalInterfaceModuleVisibilityRepository(storage)}
        listRepostRepository={listRepostRepository}
      />,
    );

    const adSwitch = await screen.findByRole('switch', { name: '隐藏广告' });
    const sourceMode = screen.getByRole('radio', { name: /保留转贴来源/ });
    await waitFor(() => expect(adSwitch).toBeEnabled());
    expect(adSwitch).toBeChecked();
    expect(sourceMode).toBeChecked();
    expect(adSwitch.closest('section')).not.toBe(sourceMode.closest('section'));

    await user.click(adSwitch);

    expect(adSwitch).not.toBeChecked();
    expect(storage.values.get(HIDE_ADS_STORAGE_KEY)).toBe(false);
    expect(storage.values.get(SHOW_LIST_REPOSTS_STORAGE_KEY)).toBe(true);
    expect(sourceMode).toBeChecked();
    const dividerMode = screen.getByRole('radio', { name: /灰线提示/ });
    await user.click(dividerMode);
    expect(dividerMode).toBeChecked();
    expect(storage.values.get(HIDE_ADS_STORAGE_KEY)).toBe(false);
    expect(storage.values.get(SHOW_LIST_REPOSTS_STORAGE_KEY)).toBe(true);
  });

  it('rolls back a failed ad setting save without affecting repost settings', async () => {
    const user = userEvent.setup();
    const storage = new FakeExtensionLocalStorage();
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);
    const save = vi.spyOn(listRepostRepository, 'setHideAds').mockRejectedValueOnce(
      new Error('Storage unavailable'),
    );
    render(
      <NoteSettingsPage
        repository={new LocalUserNoteRepository(storage)}
        interfaceModuleRepository={new LocalInterfaceModuleVisibilityRepository(storage)}
        listRepostRepository={listRepostRepository}
      />,
    );
    const adSwitch = await screen.findByRole('switch', { name: '隐藏广告' });
    await waitFor(() => expect(adSwitch).toBeEnabled());

    await user.click(adSwitch);

    expect(save).toHaveBeenCalledWith(false);
    expect(await screen.findByRole('alert')).toHaveTextContent('广告设置保存失败，请重试。');
    expect(adSwitch).toBeChecked();
    expect(adSwitch).toBeEnabled();
    const dividerMode = screen.getByRole('radio', { name: /灰线提示/ });
    await user.click(dividerMode);
    expect(dividerMode).toBeChecked();
    expect(adSwitch).toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent('广告设置保存失败，请重试。');
  });

  it('allows repost changes while an ad setting save is pending', async () => {
    const user = userEvent.setup();
    const storage = new FakeExtensionLocalStorage();
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);
    let finishSave: (() => void) | undefined;
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const persistHideAds = listRepostRepository.setHideAds.bind(listRepostRepository);
    vi.spyOn(listRepostRepository, 'setHideAds').mockImplementationOnce(async (hideAds) => {
      await pendingSave;
      await persistHideAds(hideAds);
    });
    render(
      <NoteSettingsPage
        repository={new LocalUserNoteRepository(storage)}
        interfaceModuleRepository={new LocalInterfaceModuleVisibilityRepository(storage)}
        listRepostRepository={listRepostRepository}
      />,
    );
    const adSwitch = await screen.findByRole('switch', { name: '隐藏广告' });
    await waitFor(() => expect(adSwitch).toBeEnabled());

    await user.click(adSwitch);
    expect(adSwitch).toBeDisabled();
    const dividerMode = screen.getByRole('radio', { name: /灰线提示/ });
    expect(dividerMode).toBeEnabled();
    await user.click(dividerMode);
    expect(dividerMode).toBeChecked();
    expect(adSwitch).not.toBeChecked();

    await act(async () => {
      finishSave?.();
    });
    await waitFor(() => expect(adSwitch).toBeEnabled());
    expect(storage.values.get(HIDE_ADS_STORAGE_KEY)).toBe(false);
    expect(storage.values.get(HIDDEN_REPOST_DISPLAY_MODE_STORAGE_KEY)).toBe('divider');
  });

  it('loads repost preferences without overwriting a newer ad subscription update', async () => {
    const storage = new FakeExtensionLocalStorage();
    const listRepostRepository = new LocalListRepostPreferenceRepository(storage);
    let finishLoad: ((preferences: ListRepostPreferences) => void) | undefined;
    const pendingLoad = new Promise<ListRepostPreferences>((resolve) => {
      finishLoad = resolve;
    });
    vi.spyOn(listRepostRepository, 'getPreferences').mockReturnValue(pendingLoad);
    render(
      <NoteSettingsPage
        repository={new LocalUserNoteRepository(storage)}
        interfaceModuleRepository={new LocalInterfaceModuleVisibilityRepository(storage)}
        listRepostRepository={listRepostRepository}
      />,
    );
    const adSwitch = screen.getByRole('switch', { name: '隐藏广告' });
    const sourceMode = screen.getByRole('radio', { name: /保留转贴来源/ });
    expect(adSwitch).toBeDisabled();
    expect(sourceMode).toBeDisabled();

    await act(async () => {
      await listRepostRepository.setHideAds(false);
    });
    expect(adSwitch).not.toBeChecked();
    expect(adSwitch).toBeEnabled();
    expect(sourceMode).toBeDisabled();

    await act(async () => {
      finishLoad?.({
        showReposts: false,
        hideAds: true,
        hiddenRepostDisplayMode: 'social-context',
      });
    });
    expect(sourceMode).toBeChecked();
    expect(sourceMode).toBeEnabled();
    expect(adSwitch).not.toBeChecked();
  });
});

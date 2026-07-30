import { useEffect, useState } from 'react';
import type {
  InterfaceModuleKey,
  InterfaceModuleVisibility,
  InterfaceModuleVisibilityRepository,
} from './interface-module-visibility';
import { DEFAULT_INTERFACE_MODULE_VISIBILITY } from './interface-module-visibility';

interface InterfaceModuleSettingsProps {
  repository: InterfaceModuleVisibilityRepository;
}

interface ModuleOption {
  module: InterfaceModuleKey;
  title: string;
  description: string;
}

const MODULE_OPTIONS: readonly ModuleOption[] = [
  {
    module: 'followRecommendations',
    title: '关注推荐',
    description: '主时间线和右栏中的推荐关注账号。',
  },
  {
    module: 'trends',
    title: '新鲜事',
    description: '右栏中的“有什么新鲜事”趋势模块。',
  },
  {
    module: 'premiumSubscription',
    title: '订阅推荐',
    description: '右栏中的 Premium 订阅推荐卡片。',
  },
  {
    module: 'sidebarSearch',
    title: '右栏搜索框',
    description: '右栏顶部用于搜索 X 内容的搜索框。',
  },
];

export function InterfaceModuleSettings({
  repository,
}: InterfaceModuleSettingsProps) {
  const [visibility, setVisibility] = useState<InterfaceModuleVisibility>({
    ...DEFAULT_INTERFACE_MODULE_VISIBILITY,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingModules, setSavingModules] = useState<Set<InterfaceModuleKey>>(
    () => new Set(),
  );
  const [saveError, setSaveError] = useState<InterfaceModuleKey | null>(null);

  useEffect(() => {
    let active = true;
    let visibilityRevision = 0;
    const unsubscribe = repository.subscribe((change) => {
      if (!active) {
        return;
      }

      visibilityRevision += 1;
      setVisibility((current) => ({ ...current, ...change }));
      setIsLoading(false);
      setSaveError(null);
    });

    void repository
      .getVisibility()
      .then((storedVisibility) => {
        if (active && visibilityRevision === 0) {
          setVisibility(storedVisibility);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setIsLoading(false);
          setSaveError('followRecommendations');
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  async function updateModule(module: InterfaceModuleKey, visible: boolean) {
    if (isLoading || savingModules.has(module) || visibility[module] === visible) {
      return;
    }

    const previousValue = visibility[module];
    setVisibility((current) => ({ ...current, [module]: visible }));
    setSavingModules((current) => new Set(current).add(module));
    setSaveError(null);

    try {
      await repository.setModuleVisibility(module, visible);
    } catch {
      setVisibility((current) => ({ ...current, [module]: previousValue }));
      setSaveError(module);
    } finally {
      setSavingModules((current) => {
        const next = new Set(current);
        next.delete(module);
        return next;
      });
    }
  }

  return (
    <section className="module-settings" aria-labelledby="module-settings-heading">
      <div className="module-settings__intro">
        <p className="section-kicker">界面模块</p>
        <h2 id="module-settings-heading">控制 X 页面模块</h2>
        <p>关闭不需要的模块，设置会立即应用到已打开的 X 页面。</p>
        <span className="session-note">四项默认显示，可随时单独恢复。</span>
      </div>

      <fieldset className="module-option-grid" disabled={isLoading}>
        <legend className="visually-hidden">选择要在 X 页面显示的界面模块</legend>
        {MODULE_OPTIONS.map((option) => {
          const isVisible = visibility[option.module];
          const isSaving = savingModules.has(option.module);
          return (
            <label key={option.module} className="module-option">
              <span className="module-option__copy">
                <strong>{option.title}</strong>
                <span>{option.description}</span>
              </span>
              <span className="module-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={isVisible}
                  disabled={isSaving}
                  aria-label={option.title}
                  onChange={(event) =>
                    void updateModule(option.module, event.target.checked)
                  }
                />
                <span className="module-switch__track" aria-hidden="true">
                  <span className="module-switch__thumb" />
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {saveError ? (
        <p className="module-settings__error" role="alert">
          界面模块设置保存失败，请重试。
        </p>
      ) : null}
    </section>
  );
}

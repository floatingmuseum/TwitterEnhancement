import { useEffect, useState } from 'react';
import type {
  HiddenRepostDisplayMode,
  ListRepostPreferenceRepository,
} from './list-repost-preference';

interface ListRepostSettingsProps {
  repository: ListRepostPreferenceRepository;
}

interface DisplayModeOption {
  mode: HiddenRepostDisplayMode;
  title: string;
  description: string;
}

const DISPLAY_MODE_OPTIONS: readonly DisplayModeOption[] = [
  {
    mode: 'hidden',
    title: '完全隐藏',
    description: '收紧时间线，不留下任何占位或提示。',
  },
  {
    mode: 'divider',
    title: '灰线提示',
    description: '只留分隔线；悬停时显示转贴来源。',
  },
  {
    mode: 'social-context',
    title: '保留转贴来源',
    description: '始终保留收起提示与转贴来源，正文保持收起。',
  },
];

export function ListRepostSettings({ repository }: ListRepostSettingsProps) {
  const [selectedMode, setSelectedMode] =
    useState<HiddenRepostDisplayMode>('hidden');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let active = true;
    let preferenceRevision = 0;
    const unsubscribe = repository.subscribe((change) => {
      if (active && change.hiddenRepostDisplayMode) {
        preferenceRevision += 1;
        setSelectedMode(change.hiddenRepostDisplayMode);
        setIsLoading(false);
        setSaveError(false);
      }
    });

    void repository
      .getPreferences()
      .then((preferences) => {
        if (active && preferenceRevision === 0) {
          setSelectedMode(preferences.hiddenRepostDisplayMode);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setIsLoading(false);
          setSaveError(true);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  async function selectMode(mode: HiddenRepostDisplayMode) {
    if (isLoading || isSaving || mode === selectedMode) {
      return;
    }

    const previousMode = selectedMode;
    setSelectedMode(mode);
    setIsSaving(true);
    setSaveError(false);

    try {
      await repository.setHiddenRepostDisplayMode(mode);
    } catch {
      setSelectedMode(previousMode);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="repost-settings" aria-labelledby="repost-settings-heading">
      <div className="repost-settings__intro">
        <p className="section-kicker">列表时间线</p>
        <h2 id="repost-settings-heading">隐藏转贴的呈现方式</h2>
        <p>
          列表页的“显示转贴”关闭时生效。点击保留的灰线或转贴来源，可临时展开完整内容。
        </p>
        <span className="session-note">刷新列表页后，临时展开状态会清除。</span>
      </div>

      <fieldset className="display-mode-grid" disabled={isLoading || isSaving}>
        <legend className="visually-hidden">选择隐藏转贴的呈现方式</legend>
        {DISPLAY_MODE_OPTIONS.map((option) => (
          <label
            key={option.mode}
            className={`display-mode-card${
              selectedMode === option.mode ? ' display-mode-card--selected' : ''
            }`}
          >
            <input
              className="visually-hidden"
              type="radio"
              name="hidden-repost-display-mode"
              value={option.mode}
              checked={selectedMode === option.mode}
              onChange={() => void selectMode(option.mode)}
            />
            <span className="display-mode-card__copy">
              <strong>{option.title}</strong>
              <span>{option.description}</span>
            </span>
            <span
              className={`display-mode-preview display-mode-preview--${option.mode}`}
              aria-hidden="true"
            >
              <span className="preview-post-line" />
              <span className="preview-repost-trace">
                <span className="preview-repost-icon">↻</span>
                <span>一条来自某用户的转贴已被收起，点击可还原</span>
              </span>
              <span className="preview-post-line preview-post-line--short" />
            </span>
            {selectedMode === option.mode ? (
              <span className="display-mode-card__selection" aria-hidden="true">
                ✓
              </span>
            ) : null}
          </label>
        ))}
      </fieldset>

      {saveError ? (
        <p className="repost-settings__error" role="alert">
          显示方式保存失败，请重试。
        </p>
      ) : null}
    </section>
  );
}

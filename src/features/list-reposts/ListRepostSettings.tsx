import { useEffect, useState } from 'react';
import {
  DEFAULT_LIST_REPOST_PREFERENCES,
  type HiddenRepostDisplayMode,
  type ListRepostPreferenceRepository,
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
  return (
    <>
      <RepostDisplaySettings repository={repository} />
      <AdFilterSettings repository={repository} />
    </>
  );
}

function RepostDisplaySettings({ repository }: ListRepostSettingsProps) {
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
        <p className="section-kicker">时间线过滤</p>
        <h2 id="repost-settings-heading">隐藏转贴的呈现方式</h2>
        <p>
          受支持时间线中的“显示转贴”关闭时生效。点击保留的灰线或转贴来源，可临时展开完整内容。
        </p>
        <span className="session-note">刷新或切换时间线后，临时展开状态会清除。</span>
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

function AdFilterSettings({ repository }: ListRepostSettingsProps) {
  const [hideAds, setHideAds] = useState(DEFAULT_LIST_REPOST_PREFERENCES.hideAds);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<'load' | 'save' | null>(null);

  useEffect(() => {
    let active = true;
    let preferenceRevision = 0;
    const unsubscribe = repository.subscribe((change) => {
      if (active && change.hideAds !== undefined) {
        preferenceRevision += 1;
        setHideAds(change.hideAds);
        setIsLoading(false);
        setError(null);
      }
    });

    void repository
      .getPreferences()
      .then((preferences) => {
        if (active && preferenceRevision === 0) {
          setHideAds(preferences.hideAds);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active && preferenceRevision === 0) {
          setIsLoading(false);
          setError('load');
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  async function updateHideAds(nextHideAds: boolean) {
    if (isLoading || isSaving || nextHideAds === hideAds) {
      return;
    }

    const previousHideAds = hideAds;
    setHideAds(nextHideAds);
    setIsSaving(true);
    setError(null);

    try {
      await repository.setHideAds(nextHideAds);
    } catch {
      setHideAds(previousHideAds);
      setError('save');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="module-settings" aria-labelledby="ad-settings-heading">
      <div className="module-settings__intro">
        <p className="section-kicker">广告过滤</p>
        <h2 id="ad-settings-heading">时间线广告</h2>
        <p>直接隐藏带“广告”或“推广”标记的推文，不保留灰线或展开入口。</p>
        <span className="session-note">默认开启，与“显示转贴”开关和转贴呈现方式无关。</span>
      </div>

      <label className="module-option">
        <span className="module-option__copy">
          <strong>隐藏广告</strong>
          <span>应用于首页、列表和个人主页帖子时间线。</span>
        </span>
        <span className="module-switch">
          <input
            type="checkbox"
            role="switch"
            checked={hideAds}
            disabled={isLoading || isSaving}
            aria-label="隐藏广告"
            aria-describedby={error ? 'ad-settings-error' : undefined}
            onChange={(event) => void updateHideAds(event.target.checked)}
          />
          <span className="module-switch__track" aria-hidden="true">
            <span className="module-switch__thumb" />
          </span>
        </span>
      </label>

      {error ? (
        <p id="ad-settings-error" className="module-settings__error" role="alert">
          {error === 'load'
            ? '广告设置读取失败，请刷新页面重试。'
            : '广告设置保存失败，请重试。'}
        </p>
      ) : null}
    </section>
  );
}

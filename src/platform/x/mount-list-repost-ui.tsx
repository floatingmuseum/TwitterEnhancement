import { useEffect, useState, type MouseEvent } from 'react';
import ReactDOM from 'react-dom/client';
import listRepostStyles from '../../../entrypoints/twitter.content/list-repost.css?inline';
import type { ListRepostPreferenceRepository } from '../../features/list-reposts/list-repost-preference';
import type {
  MountedXRepostTimelineControl,
  XRepostTimelineTarget,
} from './list-repost-manager';
import { isDarkXPage } from './theme';

interface ListRepostToggleProps {
  repository: ListRepostPreferenceRepository;
}

function RepostTimelineToggle({ repository }: ListRepostToggleProps) {
  const [showReposts, setShowReposts] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let active = true;
    let preferenceRevision = 0;
    const unsubscribe = repository.subscribe((change) => {
      if (active && change.showReposts !== undefined) {
        preferenceRevision += 1;
        setShowReposts(change.showReposts);
        setIsLoading(false);
        setHasError(false);
      }
    });

    void repository
      .getPreferences()
      .then((preferences) => {
        if (active && preferenceRevision === 0) {
          setShowReposts(preferences.showReposts);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setIsLoading(false);
          setHasError(true);
        }
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [repository]);

  function stopPropagation(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  async function toggleShowReposts() {
    if (isLoading || isSaving) {
      return;
    }

    const nextShowReposts = !showReposts;
    setShowReposts(nextShowReposts);
    setIsSaving(true);
    setHasError(false);

    try {
      await repository.setShowReposts(nextShowReposts);
    } catch {
      setShowReposts(showReposts);
      setHasError(true);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="te-timeline-repost" onClick={stopPropagation}>
      <div className="te-timeline-repost__identity">
        <svg
          className="te-timeline-repost__icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M4.75 3.79 9.353 8.09 8.33 9.186 5.5 6.546V15A2.5 2.5 0 0 0 8 17.5h3V19H8a4 4 0 0 1-4-4V6.546L1.169 9.186.147 8.09 4.75 3.79Zm14.5 16.42-4.603-4.3 1.022-1.096 2.831 2.64V9A2.5 2.5 0 0 0 16 6.5h-3V5h3a4 4 0 0 1 4 4v8.454l2.831-2.64 1.022 1.096-4.603 4.3Z" />
        </svg>
        <span>转贴内容</span>
        {hasError ? (
          <span
            id="te-timeline-repost-error"
            className="te-timeline-repost__error"
            role="alert"
          >
            设置保存失败
          </span>
        ) : null}
      </div>
      <button
        type="button"
        className="te-timeline-repost__control"
        role="switch"
        aria-label="显示转贴"
        aria-checked={showReposts}
        aria-describedby={hasError ? 'te-timeline-repost-error' : undefined}
        disabled={isLoading || isSaving}
        onClick={() => void toggleShowReposts()}
      >
        <span className="te-timeline-repost__state">
          {showReposts ? '显示' : '隐藏'}
        </span>
        <span className="te-timeline-repost__switch" aria-hidden="true" />
      </button>
    </div>
  );
}

export function mountXRepostTimelineUi(
  target: XRepostTimelineTarget,
  repository: ListRepostPreferenceRepository,
): MountedXRepostTimelineControl {
  if (!target.controlAnchor) {
    throw new Error('A repost timeline control anchor is required.');
  }

  const host = document.createElement('div');
  host.dataset.twitterEnhancementRepostTimeline = '';
  host.dataset.teSurface = target.surface;
  host.style.display = 'block';
  host.style.width = '100%';

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = listRepostStyles;
  const reactContainer = document.createElement('div');
  shadowRoot.append(style, reactContainer);
  if (target.controlPlacement === 'before') {
    target.controlAnchor.insertAdjacentElement('beforebegin', host);
  } else {
    target.controlAnchor.append(host);
  }

  const root = ReactDOM.createRoot(reactContainer);
  root.render(<RepostTimelineToggle repository={repository} />);

  function updateAppearance() {
    host.dataset.teTheme = isDarkXPage() ? 'dark' : 'light';
  }

  updateAppearance();

  return {
    updateAppearance,
    isConnected() {
      return host.isConnected;
    },
    destroy() {
      root.unmount();
      host.remove();
    },
  };
}

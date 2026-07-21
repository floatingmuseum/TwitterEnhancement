import { useEffect, useState, type MouseEvent } from 'react';
import ReactDOM from 'react-dom/client';
import listRepostStyles from '../../../entrypoints/twitter.content/list-repost.css?inline';
import type { ListRepostPreferenceRepository } from '../../features/list-reposts/list-repost-preference';
import type {
  MountedXListRepostControl,
  XListRepostTarget,
} from './list-repost-manager';
import { isDarkXPage } from './theme';

interface ListRepostToggleProps {
  repository: ListRepostPreferenceRepository;
}

function ListRepostToggle({ repository }: ListRepostToggleProps) {
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
    <div className="te-list-repost" onClick={stopPropagation}>
      <div>
        <button
          type="button"
          className="te-list-repost__control"
          role="switch"
          aria-checked={showReposts}
          aria-describedby={hasError ? 'te-list-repost-error' : undefined}
          disabled={isLoading || isSaving}
          onClick={() => void toggleShowReposts()}
        >
          <span>显示转贴</span>
          <span className="te-list-repost__switch" aria-hidden="true" />
        </button>
        {hasError ? (
          <p id="te-list-repost-error" className="te-list-repost__error" role="alert">
            设置保存失败
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function mountXListRepostUi(
  target: XListRepostTarget,
  repository: ListRepostPreferenceRepository,
): MountedXListRepostControl {
  const host = document.createElement('div');
  host.dataset.twitterEnhancementListRepost = '';
  host.style.display = 'block';
  host.style.width = '100%';

  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = listRepostStyles;
  const reactContainer = document.createElement('div');
  shadowRoot.append(style, reactContainer);
  target.anchor.append(host);

  const root = ReactDOM.createRoot(reactContainer);
  root.render(<ListRepostToggle repository={repository} />);

  function updateAppearance() {
    host.dataset.teTheme = isDarkXPage() ? 'dark' : 'light';
  }

  updateAppearance();

  return {
    updateAppearance,
    destroy() {
      root.unmount();
      host.remove();
    },
  };
}

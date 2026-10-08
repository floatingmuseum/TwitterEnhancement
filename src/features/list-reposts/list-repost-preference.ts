export const HIDDEN_REPOST_DISPLAY_MODES = [
  'hidden',
  'divider',
  'social-context',
] as const;

export type HiddenRepostDisplayMode =
  (typeof HIDDEN_REPOST_DISPLAY_MODES)[number];

export interface ListRepostPreferences {
  showReposts: boolean;
  hideAds: boolean;
  hiddenRepostDisplayMode: HiddenRepostDisplayMode;
}

export type ListRepostPreferenceChange = Partial<ListRepostPreferences>;
export type ListRepostPreferenceListener = (
  change: ListRepostPreferenceChange,
) => void;

export const DEFAULT_LIST_REPOST_PREFERENCES: ListRepostPreferences = {
  showReposts: false,
  hideAds: true,
  hiddenRepostDisplayMode: 'hidden',
};

export interface ListRepostPreferenceRepository {
  getPreferences(): Promise<ListRepostPreferences>;
  setShowReposts(showReposts: boolean): Promise<void>;
  setHideAds(hideAds: boolean): Promise<void>;
  setHiddenRepostDisplayMode(mode: HiddenRepostDisplayMode): Promise<void>;
  subscribe(listener: ListRepostPreferenceListener): () => void;
}

export const INTERFACE_LAYOUT_KEYS = [
  'leftNavigationExpanded',
  'rightSidebarVisible',
] as const;

export type InterfaceLayoutKey = (typeof INTERFACE_LAYOUT_KEYS)[number];
export type InterfaceLayoutPreference = Record<InterfaceLayoutKey, boolean>;
export type InterfaceLayoutChange = Partial<InterfaceLayoutPreference>;
export type InterfaceLayoutListener = (change: InterfaceLayoutChange) => void;

export const DEFAULT_INTERFACE_LAYOUT_PREFERENCE: InterfaceLayoutPreference = {
  leftNavigationExpanded: true,
  rightSidebarVisible: true,
};

export interface InterfaceLayoutPreferenceRepository {
  getPreference(): Promise<InterfaceLayoutPreference>;
  setPreference(key: InterfaceLayoutKey, value: boolean): Promise<void>;
  subscribe(listener: InterfaceLayoutListener): () => void;
}

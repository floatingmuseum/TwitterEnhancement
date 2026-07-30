export const INTERFACE_MODULE_KEYS = [
  'followRecommendations',
  'trends',
  'premiumSubscription',
  'sidebarSearch',
] as const;

export type InterfaceModuleKey = (typeof INTERFACE_MODULE_KEYS)[number];

export type InterfaceModuleVisibility = Record<InterfaceModuleKey, boolean>;
export type InterfaceModuleVisibilityChange = Partial<InterfaceModuleVisibility>;
export type InterfaceModuleVisibilityListener = (
  change: InterfaceModuleVisibilityChange,
) => void;

export const DEFAULT_INTERFACE_MODULE_VISIBILITY: InterfaceModuleVisibility = {
  followRecommendations: true,
  trends: true,
  premiumSubscription: true,
  sidebarSearch: true,
};

export interface InterfaceModuleVisibilityRepository {
  getVisibility(): Promise<InterfaceModuleVisibility>;
  setModuleVisibility(module: InterfaceModuleKey, visible: boolean): Promise<void>;
  subscribe(listener: InterfaceModuleVisibilityListener): () => void;
}

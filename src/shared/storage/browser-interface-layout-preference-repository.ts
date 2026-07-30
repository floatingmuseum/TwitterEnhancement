import { browserLocalStorage } from './browser-local-storage';
import { LocalInterfaceLayoutPreferenceRepository } from './interface-layout-preference-repository';

export const interfaceLayoutPreferenceRepository =
  new LocalInterfaceLayoutPreferenceRepository(browserLocalStorage);

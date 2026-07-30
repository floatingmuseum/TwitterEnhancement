import { browserLocalStorage } from './browser-local-storage';
import { LocalInterfaceModuleVisibilityRepository } from './interface-module-visibility-repository';

export const interfaceModuleVisibilityRepository =
  new LocalInterfaceModuleVisibilityRepository(browserLocalStorage);

import { browserLocalStorage } from './browser-local-storage';
import { LocalListRepostPreferenceRepository } from './list-repost-preference-repository';

export const listRepostPreferenceRepository =
  new LocalListRepostPreferenceRepository(browserLocalStorage);

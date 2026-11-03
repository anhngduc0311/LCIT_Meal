import { storage } from '../utils/storage';
import { env } from '../config/env';
import { STORAGE_KEYS } from '../config/constants';
import type { FacilityId, FacilityOverrides, FacilityPerson } from '../utils/facilities';

async function namespace(mock: boolean) {
  const api = mock ? 'mock' : String(await storage.getItem(STORAGE_KEYS.API_URL_OVERRIDE) || env.apiBaseUrl).replace(/\/+$/, '');
  // SecureStore allows only letters, digits, dots, underscores and hyphens in keys.
  return `meal_facilities_v1_${Array.from(api).map(char => char.charCodeAt(0).toString(16)).join('_')}`;
}

export const facilityService = {
  async load(mock = false): Promise<FacilityOverrides> {
    const prefix = await namespace(mock);
    const ids = await storage.getObject<string[]>(prefix);
    const result: FacilityOverrides = {};
    if (!Array.isArray(ids)) return result;
    for (const id of ids.filter(id => typeof id === 'string' && /^\d+$/.test(id))) {
      const value = await storage.getObject<FacilityOverrides[string]>(`${prefix}_${id}`);
      if (value && typeof value.name === 'string' && [1, 2, null].includes(value.facilityId)) result[id] = value;
    }
    return result;
  },

  async assign(person: FacilityPerson, facilityId: FacilityId | null, mock = false) {
    if (person.id === undefined || !person.fullName || ![1, 2, null].includes(facilityId)) {
      throw new Error('Thông tin phân cơ sở không hợp lệ.');
    }
    const prefix = await namespace(mock);
    const stored = await storage.getObject<string[]>(prefix);
    const ids = Array.isArray(stored) ? stored.filter(id => typeof id === 'string' && /^\d+$/.test(id)) : [];
    const id = String(person.id);
    await storage.setObject(`${prefix}_${id}`, { name: person.fullName, facilityId });
    await storage.setObject(prefix, Array.from(new Set([...ids, id])));
  },
};

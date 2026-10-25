import { SEARCH_SITE_ADAPTERS } from './catalog';
import { launchApartmentsSearch } from './apartmentsLaunch';
import { launchZillowSearch } from './zillowLaunch';
import { launchRealtorSearch } from './realtorLaunch';
import { launchRedfinSearch } from './redfinLaunch';
import { launchRentSearch } from './rentLaunch';
import { launchHotpadsSearch } from './hotpadsLaunch';
import { launchZumperSearch } from './zumperLaunch';
import type { RentalSearch } from './types';

const launchers = {
  apartments: launchApartmentsSearch,
  zillow: launchZillowSearch,
  realtor: launchRealtorSearch,
  redfin: launchRedfinSearch,
  rent: launchRentSearch,
  hotpads: launchHotpadsSearch,
  zumper: launchZumperSearch,
};

export async function launchRentalSite(
  siteId: string,
  search: RentalSearch,
  siteAccess?: Promise<boolean>,
) {
  const site = SEARCH_SITE_ADAPTERS.find((item) => item.id === siteId);
  const launcher = launchers[siteId as keyof typeof launchers];
  if (!site || !launcher) throw new Error('This rental site is not supported.');
  const result = site.buildLink(search);
  if (result.status !== 'ready') throw new Error(result.reason);
  return launcher(search, result.link.url, siteAccess);
}

/** Call synchronously from the Open button, before storage reads or approval hashing. */
export function prepareRentalSiteAccess(
  siteId: string,
  search: RentalSearch,
): Promise<boolean> {
  const site = SEARCH_SITE_ADAPTERS.find((item) => item.id === siteId);
  const result = site?.buildLink(search);
  if (
    !site ||
    result?.status !== 'ready' ||
    result.link.transferMode !== 'page' ||
    !result.link.applied.length
  )
    return Promise.resolve(false);
  try {
    return chrome.permissions
      .request({ origins: site.allowedOrigins.map((origin) => `${origin}/*`) })
      .catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

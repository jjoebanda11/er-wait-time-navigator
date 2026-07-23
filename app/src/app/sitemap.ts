import type { MetadataRoute } from 'next';
import { getWaitTimes } from '@/lib/ahs/client';
import { REGION_SLUGS } from '@/lib/ahs/parse';
import { config } from '@/lib/config';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = config.site.url;
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'hourly', priority: 1 },
    { url: `${base}/triage`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/alternatives`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/trends`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
    { url: `${base}/data`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const cityRoutes: MetadataRoute.Sitemap = Object.values(REGION_SLUGS).map((slug) => ({
    url: `${base}/${slug}-er-wait-times`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.95,
  }));

  // Facility pages come from live data, so a new AHS site appears in the
  // sitemap automatically without a code change.
  const snapshot = await getWaitTimes();
  const facilityRoutes: MetadataRoute.Sitemap = snapshot.facilities.map((facility) => ({
    url: `${base}/facility/${facility.slug}`,
    lastModified: now,
    changeFrequency: 'hourly',
    priority: 0.8,
  }));

  return [...staticRoutes, ...cityRoutes, ...facilityRoutes];
}

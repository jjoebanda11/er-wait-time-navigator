import type { MetadataRoute } from 'next';
import { config } from '@/lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing useful to a crawler, and the cron route should never be hit
        // by one.
        disallow: ['/api/cron/', '/api/alerts', '/offline'],
      },
    ],
    sitemap: `${config.site.url}/sitemap.xml`,
  };
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Accounta-Bill-Ity',
    short_name: 'AccountaBill',
    description: 'Retro Household Expense & Budget Tracker',
    start_url: '/',
    display: 'standalone',
    background_color: '#F3F4F6',
    theme_color: '#E07A5F',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
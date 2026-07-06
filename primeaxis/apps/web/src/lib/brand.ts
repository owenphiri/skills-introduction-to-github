/** Single place to rebrand the whole frontend. */
export const brand = {
  name: process.env.NEXT_PUBLIC_APP_NAME ?? 'PrimeAxis',
  tagline: 'From chicks to profits — one intelligent poultry platform.',
  company: 'PrimeAxis ICT Trade & Solutions Ltd',
  social: {
    x: 'https://x.com/primeaxis',
    facebook: 'https://facebook.com/primeaxis',
    instagram: 'https://instagram.com/primeaxis',
    // wa.me deep link opens a chat immediately (click-to-chat)
    whatsapp: 'https://wa.me/260970000000?text=Hello%20PrimeAxis!',
    youtube: 'https://youtube.com/@primeaxis',
  },
} as const;

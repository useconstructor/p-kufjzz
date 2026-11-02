import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Script from 'next/script';
import branding from '@/branding.json';
import { BrandShell } from '@/components/brand';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Vuelta — Dale forma a tu pausa.', template: '%s · Vuelta' },
  description: 'Barro, torno y color. Explora tres experiencias de cerámica de dos horas en Vuelta, un taller ficticio en Laureles, Medellín. Reservas de demostración.',
  applicationName: 'Vuelta',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const roles = { '--brand-background': branding.backgroundColor, '--brand-surface': branding.backgroundColor, '--brand-primary': branding.primaryColor, '--brand-accent': branding.secondaryColor, '--brand-text': branding.textColor, '--brand-font-heading': `"${branding.fontHeading}", sans-serif`, '--brand-font-body': `"${branding.fontBody}", sans-serif`, '--brand-radius': branding.borderRadius } as CSSProperties;
  return <html lang="es" style={roles}><body><BrandShell>{children}</BrandShell><Script src="/constructor-analytics.js" strategy="afterInteractive" /></body></html>;
}

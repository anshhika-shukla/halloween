import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'REPOREVENANT - Ghost of Abandoned Codebases',
  description: 'Evidence-bound local AI maintainer for open-source repositories.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

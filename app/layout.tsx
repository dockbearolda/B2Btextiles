import type { Metadata } from 'next';
import './globals.css';
import { getIsAdmin } from '@/lib/auth-guard';
import { EditModeProvider } from '@/components/edit-mode-provider';
import { AdminBar } from '@/components/admin-bar';
import { Toaster } from 'sonner';

export const metadata: Metadata = { title: 'Catalogue', description: 'Catalogue B2B' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await getIsAdmin();
  return (
    <html lang="fr">
      <body data-edit-mode={isAdmin ? 'on' : 'off'}>
        <EditModeProvider isAdmin={isAdmin}>
          {children}
          <AdminBar />
        </EditModeProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}

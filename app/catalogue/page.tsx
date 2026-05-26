import { prisma } from '@/lib/db';
import { EmptyState } from '@/components/empty-state';

export default async function CataloguePage() {
  const genreCount = await prisma.genre.count();
  if (genreCount === 0) return <EmptyState />;
  return <p className="micro-label">Sélectionnez une famille ou ajoutez un produit (Task 7).</p>;
}

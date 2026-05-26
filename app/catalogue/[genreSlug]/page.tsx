import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { EditableText } from '@/components/editable-text';

export default async function GenrePage({ params }: { params: Promise<{ genreSlug: string }> }) {
  const { genreSlug } = await params;
  const genre = await prisma.genre.findUnique({ where: { slug: genreSlug } });
  if (!genre) notFound();
  return (
    <section>
      <h1 style={{ color: 'var(--fg-1)', marginBottom: 16 }}>
        <EditableText entity="genre" entityId={genre.id} field="name" value={genre.name} />
      </h1>
      <p className="micro-label">Produits de cette famille (Task 7).</p>
    </section>
  );
}

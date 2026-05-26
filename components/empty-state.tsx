export function EmptyState() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', padding: '12vh 0', color: 'var(--fg-3)' }}>
      <div style={{
        width: 96, height: 96, borderRadius: 'var(--r-6)', border: '2px dashed var(--brand-sage)',
        display: 'grid', placeItems: 'center', marginBottom: 16, color: 'var(--fg-4)',
      }}>T-shirt</div>
      <h2 style={{ color: 'var(--fg-1)', marginBottom: 6 }}>Votre catalogue est vide</h2>
      <p style={{ maxWidth: 420 }}>Commencez par créer une famille (T-shirt, Polo, Sweat…) dans la colonne de gauche, puis ajoutez votre premier produit.</p>
    </div>
  );
}

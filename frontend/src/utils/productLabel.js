// Shared "Select Product" dropdown label: brand, then model, then category/subcategory
// as supporting info — used everywhere a product picker appears (Log Movement, Log
// Return, project Materials Used). Pass { includeId: true } to prefix the product's
// unique ID (e.g. Stock Movements, where the ID needs to stay visible/traceable).
export function formatProductLabel(product, { includeId = false } = {}) {
  if (!product) return '';
  const name = [product.brand, product.model].filter(Boolean).join(' ');
  const extra = [product.category, product.subcategory].filter(Boolean).join(' / ');
  const label = extra ? `${name} (${extra})` : name;
  return includeId && product.id ? `${product.id} — ${label}` : label;
}

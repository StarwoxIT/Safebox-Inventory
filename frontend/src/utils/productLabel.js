// Shared "Select Product" dropdown label: brand, then model, then category/subcategory
// as supporting info — used everywhere a product picker appears (Log Movement, Log
// Return, project Materials Used).
export function formatProductLabel(product) {
  if (!product) return '';
  const name = [product.brand, product.model].filter(Boolean).join(' ');
  const extra = [product.category, product.subcategory].filter(Boolean).join(' / ');
  return extra ? `${name} (${extra})` : name;
}

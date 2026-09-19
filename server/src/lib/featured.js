const AUTO_FEATURED_COUNT = 4;

// Best sellers first; the "popular" flag and menu order break ties so a restaurant with no sales yet still gets a sensible strip.
function pickAutoFeatured(items, count = AUTO_FEATURED_COUNT) {
  return items
    .filter(i => i.isAvailable)
    .sort((a, b) =>
      (b.totalOrdered - a.totalOrdered) ||
      (Number(b.isPopular) - Number(a.isPopular)) ||
      (a.sortOrder - b.sortOrder))
    .slice(0, count)
    .map(i => i.id);
}

// In auto mode the stored isFeatured flags are ignored (but kept, so switching back to manual restores them).
function applyAutoFeatured(items) {
  const picked = new Set(pickAutoFeatured(items));
  return items
    .map(i => ({ ...i, isFeatured: picked.has(i.id) }))
    .sort((a, b) => (Number(b.isFeatured) - Number(a.isFeatured)) || (a.sortOrder - b.sortOrder));
}

module.exports = { AUTO_FEATURED_COUNT, pickAutoFeatured, applyAutoFeatured };

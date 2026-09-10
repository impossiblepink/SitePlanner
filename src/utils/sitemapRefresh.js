const pageKey = (page) => {
  if (page.pageOrigin === 'manual') return null;
  return page.sitemapKey || (page.url ? page.url.replace(/\/$/, '') : null);
};

export const compareSitemapRefresh = (plan, preview, analysis = null) => {
  const currentPages = plan.pages || [];
  const currentByKey = new Map(
    currentPages.map(page => [pageKey(page), page]).filter(([key]) => key)
  );
  const nextByKey = new Map((preview.pages || []).map(page => [page.key, page]));
  const previousStructure = new Map(
    (plan.sitemapSnapshot || []).map(page => [page.key, page.parentKey || null])
  );

  const added = preview.pages.filter(page => !currentByKey.has(page.key));
  const sitemapKeys = analysis ? new Set(analysis.pages.map(page => page.key)) : new Set(nextByKey.keys());
  const missing = [...currentByKey.entries()]
    .filter(([key, page]) => !page.isPlaceholder && !sitemapKeys.has(key))
    .map(([, page]) => page);
  const moved = preview.pages.filter(page => {
    if (!currentByKey.has(page.key)) return false;
    if (previousStructure.has(page.key)) {
      return previousStructure.get(page.key) !== (page.parentKey || null);
    }
    const current = currentByKey.get(page.key);
    const currentParent = currentPages.find(pageItem => pageItem.id === current.parentId);
    return page.parentKey !== pageKey(currentParent || {});
  });

  return {
    added,
    missing,
    moved,
    addedCount: added.length,
    missingCount: missing.length,
    movedCount: moved.length,
    finalCount: preview.pages.length
  };
};

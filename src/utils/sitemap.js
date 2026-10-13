const MAX_SITEMAPS = 50;
const MAX_URLS = 10000;

const parseXml = (xmlText) => {
  const documentNode = new DOMParser().parseFromString(xmlText, 'application/xml');
  const parseError = documentNode.querySelector('parsererror');
  if (parseError) {
    throw new Error('This file is not valid XML.');
  }
  return documentNode;
};

const elementsByLocalName = (documentNode, name) =>
  Array.from(documentNode.getElementsByTagNameNS('*', name));

const readLocations = (documentNode, containerName) =>
  elementsByLocalName(documentNode, containerName)
    .map(container => elementsByLocalName(container, 'loc')[0]?.textContent?.trim())
    .filter(Boolean);

export const parseSitemapDocument = (xmlText) => {
  const documentNode = parseXml(xmlText);
  const sitemapLocations = readLocations(documentNode, 'sitemap');
  const pageLocations = readLocations(documentNode, 'url');

  if (sitemapLocations.length > 0) {
    return { type: 'index', locations: sitemapLocations };
  }
  if (pageLocations.length > 0) {
    return { type: 'urlset', locations: pageLocations };
  }
  throw new Error('No page URLs were found in this sitemap.');
};

const proxyUrlFor = (url) => {
  const endpoint = new URL('/api/sitemap', window.location.origin);
  endpoint.searchParams.set('url', url);
  return endpoint.toString();
};

const fetchXml = async (url) => {
  let directError;
  try {
    const response = await fetch(url, { headers: { Accept: 'application/xml,text/xml,*/*' } });
    if (response.ok) return await response.text();
    directError = new Error(`The server returned HTTP ${response.status}.`);
  } catch (error) {
    directError = error;
  }

  try {
    const response = await fetch(proxyUrlFor(url), { headers: { Accept: 'application/xml,text/xml' } });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || `The server returned HTTP ${response.status}.`);
    return payload.xml;
  } catch (proxyError) {
    throw new Error(
      'The sitemap could not be read from its URL. Try uploading the XML file instead. ' +
      (proxyError.message || directError?.message || '')
    );
  }
};

const normalizePageUrl = (value) => {
  // Some sitemap generators emit a backslash before the query delimiter and
  // double-escape ampersands. Normalize those obvious variants before parsing.
  const cleanedValue = value.replace(/\\\?/g, '?').replaceAll('&amp;', '&');
  const url = new URL(cleanedValue);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported URL protocol.');
  url.hash = '';
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
};

const siteKey = (hostname) => hostname.toLowerCase().replace(/^www\./, '');

const titleFromUrl = (url) => {
  const segment = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) || '');
  if (!segment) return 'Homepage';
  return segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
};

const titleFromPath = (path) => {
  const segment = decodeURIComponent(path.split('/').filter(Boolean).at(-1) || 'Page');
  return segment
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, character => character.toUpperCase());
};

const pathInfoForPage = (page) => {
  try {
    const url = new URL(page.url);
    return { origin: url.origin, path: url.pathname === '/' ? '/' : url.pathname.replace(/\/$/, '') };
  } catch {
    return null;
  }
};

const isBelowPath = (page, origin, path) => {
  const info = pathInfoForPage(page);
  return Boolean(info && info.origin === origin && info.path.startsWith(path + '/'));
};

const parentUrlKey = (url, availableKeys, homepageKey) => {
  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length <= 1) return homepageKey;

  for (let length = segments.length - 1; length > 0; length -= 1) {
    const parent = new URL(url.origin);
    parent.pathname = '/' + segments.slice(0, length).join('/');
    const key = parent.href.replace(/\/$/, '');
    if (availableKeys.has(key)) return key;
  }
  return homepageKey;
};

const queryGroupKeyFor = (url) => {
  const baseUrl = new URL(url.href);
  baseUrl.search = '';
  return baseUrl.href.replace(/\/$/, '') || baseUrl.origin;
};

export const buildSitemapAnalysis = (rawLocations, sourceUrl = '') => {
  const warnings = [];
  const invalidUrls = [];
  const normalized = [];

  rawLocations.forEach(value => {
    try {
      normalized.push(normalizePageUrl(value));
    } catch {
      invalidUrls.push(value);
    }
  });

  if (normalized.length === 0) {
    throw new Error('The sitemap does not contain any valid web page URLs.');
  }

  const primarySite = siteKey(normalized[0].hostname);
  const externalUrls = normalized.filter(url => siteKey(url.hostname) !== primarySite);
  const sameSiteUrls = normalized.filter(url => siteKey(url.hostname) === primarySite);

  const uniqueByHref = new Map();
  sameSiteUrls.forEach(url => {
    if (!uniqueByHref.has(url.href)) uniqueByHref.set(url.href, url);
  });
  const urls = Array.from(uniqueByHref.values());
  const duplicateCount = sameSiteUrls.length - urls.length;

  if (externalUrls.length) warnings.push(`${externalUrls.length} external-domain URL(s) will be skipped.`);
  if (duplicateCount) warnings.push(`${duplicateCount} duplicate URL(s) will be skipped.`);
  if (invalidUrls.length) warnings.push(`${invalidUrls.length} invalid URL(s) will be skipped.`);
  if (urls.length > 500) warnings.push('This is a large sitemap and may take a moment to display.');

  const homepageUrl = urls.find(url => url.pathname === '/' && !url.search) || new URL(urls[0].origin);
  const homepageKey = homepageUrl.href.replace(/\/$/, '') || homepageUrl.origin;
  const pageUrls = urls.filter(url => !(url.pathname === '/' && !url.search));
  const availableKeys = new Set(pageUrls.map(url => url.href.replace(/\/$/, '')));
  const depthByKey = new Map([[homepageKey, 1]]);
  const queryVariationsByBase = new Map();

  pageUrls.filter(url => url.search).forEach(url => {
    const groupKey = queryGroupKeyFor(url);
    const variations = queryVariationsByBase.get(groupKey) || [];
    variations.push(url);
    queryVariationsByBase.set(groupKey, variations);
  });

  const drafts = pageUrls
    .sort((a, b) => a.pathname.localeCompare(b.pathname) || a.search.localeCompare(b.search))
    .map(url => {
      const key = url.href.replace(/\/$/, '');
      return {
        key,
        title: titleFromUrl(url),
        description: url.href,
        url: url.href,
        parentKey: parentUrlKey(url, availableKeys, homepageKey),
        queryGroupKey: url.search ? queryGroupKeyFor(url) : null
      };
    });
  const draftByKey = new Map(drafts.map(draft => [draft.key, draft]));

  const depthFor = (draft, visited = new Set()) => {
    if (depthByKey.has(draft.key)) return depthByKey.get(draft.key);
    if (visited.has(draft.key)) return 2;
    const parent = draftByKey.get(draft.parentKey);
    const depth = parent ? depthFor(parent, new Set([...visited, draft.key])) + 1 : 2;
    depthByKey.set(draft.key, depth);
    return depth;
  };

  const maxDepth = Math.max(1, ...drafts.map(draft => depthFor(draft)));
  const domain = homepageUrl.hostname.replace(/^www\./, '');
  const defaultName = domain + ' Sitemap';
  const allPageKeys = new Set([homepageKey, ...drafts.map(draft => draft.key)]);
  const queryVariationGroups = Array.from(queryVariationsByBase.entries())
    .filter(([, variations]) => variations.length >= 2)
    .map(([key, variations]) => {
      const representativeKey = variations[0].href.replace(/\/$/, '');
      const representative = draftByKey.get(representativeKey);
      const baseUrl = new URL(variations[0].href);
      baseUrl.search = '';
      return {
        key,
        baseUrl: baseUrl.href,
        path: baseUrl.pathname || '/',
        variationCount: variations.length,
        basePageExists: allPageKeys.has(key),
        representativeKey,
        title: representative?.title || titleFromUrl(baseUrl),
        parentKey: representative?.parentKey || homepageKey,
        depth: representative ? (depthByKey.get(representative.key) || 2) : 2
      };
    })
    .sort((a, b) => b.variationCount - a.variationCount || a.path.localeCompare(b.path));

  return {
    sourceUrl,
    domain,
    defaultName,
    discoveredCount: rawLocations.length,
    importedCount: urls.length,
    resultingPageCount: drafts.length + 1,
    maxDepth,
    sitemapCount: 1,
    warnings,
    queryVariationGroups,
    pages: [
      {
        key: homepageKey,
        title: 'Homepage',
        description: homepageUrl.href,
        url: homepageUrl.href,
        parentKey: null,
        depth: 1
      },
      ...drafts.map(draft => ({ ...draft, depth: depthByKey.get(draft.key) || 2 }))
    ]
  };
};

export const getSitemapImportPreview = (
  analysis,
  {
    maxDepth = analysis.maxDepth,
    branchChoices = {},
    variationChoices = {},
    branchThreshold = 25,
    queryThreshold = 5
  } = {}
) => {
  const depthLimit = Math.max(1, Math.min(Number(maxDepth) || analysis.maxDepth, analysis.maxDepth));
  const depthLimitedPages = analysis.pages.filter(page => (page.depth || 1) <= depthLimit);
  const depthLimitedKeys = new Set(depthLimitedPages.map(page => page.key));
  const pageByKey = new Map(depthLimitedPages.map(page => [page.key, page]));

  const descendantCounts = new Map(depthLimitedPages.map(page => [page.key, 0]));
  [...depthLimitedPages]
    .sort((a, b) => (b.depth || 1) - (a.depth || 1))
    .forEach(page => {
      if (!page.parentKey || !depthLimitedKeys.has(page.parentKey)) return;
      descendantCounts.set(
        page.parentKey,
        (descendantCounts.get(page.parentKey) || 0) + 1 + (descendantCounts.get(page.key) || 0)
      );
    });

  const homepageKey = depthLimitedPages.find(page => !page.parentKey)?.key;
  const qualifyingKeys = new Set(
    depthLimitedPages
      .filter(page => page.key !== homepageKey && (descendantCounts.get(page.key) || 0) >= branchThreshold)
      .map(page => page.key)
  );

  const hasHiddenQualifyingAncestor = (page) => {
    let parentKey = page.parentKey;
    while (parentKey) {
      if (qualifyingKeys.has(parentKey) && branchChoices[parentKey] !== 'all') return true;
      parentKey = pageByKey.get(parentKey)?.parentKey;
    }
    return false;
  };

  const realBranches = depthLimitedPages
    .filter(page => qualifyingKeys.has(page.key) && !hasHiddenQualifyingAncestor(page))
    .map(page => {
      let path = page.title;
      try {
        path = new URL(page.url).pathname || '/';
      } catch {
        // Keep the page title when its URL cannot be parsed.
      }
      return {
        key: page.key,
        title: page.title,
        path,
        descendantCount: descendantCounts.get(page.key) || 0,
        missingParent: false,
        choice: branchChoices[page.key] || 'all'
      };
    });

  const missingPathCounts = new Map();
  depthLimitedPages.forEach(page => {
    const info = pathInfoForPage(page);
    if (!info || info.path === '/') return;
    const segments = info.path.split('/').filter(Boolean);
    for (let length = 1; length < segments.length; length += 1) {
      const path = '/' + segments.slice(0, length).join('/');
      const pageKey = info.origin + path;
      if (depthLimitedKeys.has(pageKey)) continue;
      const key = 'missing-path:' + pageKey;
      const current = missingPathCounts.get(key) || { key, pageKey, origin: info.origin, path, descendantCount: 0 };
      current.descendantCount += 1;
      missingPathCounts.set(key, current);
    }
  });

  const missingBranches = [...missingPathCounts.values()]
    .filter(branch => branch.descendantCount >= branchThreshold)
    .filter(branch => ![...missingPathCounts.values()].some(ancestor =>
      ancestor.key !== branch.key &&
      ancestor.descendantCount >= branchThreshold &&
      branch.path.startsWith(ancestor.path + '/') &&
      ['exclude', 'placeholder'].includes(branchChoices[ancestor.key])
    ))
    .map(branch => ({
      ...branch,
      title: titleFromPath(branch.path),
      placeholderTitle: `Placeholder ${titleFromPath(branch.path)}`,
      missingParent: true,
      choice: branchChoices[branch.key] || 'all'
    }));

  const largeBranches = [...realBranches, ...missingBranches]
    .sort((a, b) => b.descendantCount - a.descendantCount || a.path.localeCompare(b.path));

  const excludedBranchKeys = new Set(
    Object.entries(branchChoices)
      .filter(([, choice]) => choice === 'only')
      .map(([key]) => key)
  );
  const isExcluded = (page) => {
    let parentKey = page.parentKey;
    while (parentKey) {
      if (excludedBranchKeys.has(parentKey)) return true;
      parentKey = pageByKey.get(parentKey)?.parentKey;
    }
    return missingBranches.some(branch =>
      ['exclude', 'placeholder'].includes(branchChoices[branch.key]) && isBelowPath(page, branch.origin, branch.path)
    );
  };

  const retainedPagesAfterDescendants = depthLimitedPages.filter(page => !isExcluded(page));
  const excludedDescendants = depthLimitedPages.length - retainedPagesAfterDescendants.length;
  let pagesAfterDescendants = [...retainedPagesAfterDescendants];
  // The older temporary "exclude" value is treated as the combined placeholder
  // choice so previously saved experiments do not lose the collection marker.
  const placeholderBranches = missingBranches.filter(branch =>
    ['exclude', 'placeholder'].includes(branchChoices[branch.key])
  );
  placeholderBranches.forEach(branch => {
    if (pagesAfterDescendants.some(page => page.key === branch.pageKey)) return;
    pagesAfterDescendants.push({
      key: branch.pageKey,
      title: branch.placeholderTitle,
      description: branch.pageKey,
      url: branch.pageKey,
      parentKey: homepageKey,
      queryGroupKey: null,
      depth: 2,
      isPlaceholder: true
    });
  });

  if (placeholderBranches.length > 0) {
    const availablePages = new Map(pagesAfterDescendants.map(page => [page.key, page]));
    pagesAfterDescendants = pagesAfterDescendants.map(page => {
      const info = pathInfoForPage(page);
      if (!info || info.path === '/') return page;
      const segments = info.path.split('/').filter(Boolean);
      for (let length = segments.length - 1; length > 0; length -= 1) {
        const candidateKey = info.origin + '/' + segments.slice(0, length).join('/');
        if (candidateKey !== page.key && availablePages.has(candidateKey)) {
          return { ...page, parentKey: candidateKey };
        }
      }
      return page;
    });
  }
  const remainingKeys = new Set(pagesAfterDescendants.map(page => page.key));
  const remainingVariationCounts = new Map();
  pagesAfterDescendants.forEach(page => {
    if (!page.queryGroupKey) return;
    remainingVariationCounts.set(
      page.queryGroupKey,
      (remainingVariationCounts.get(page.queryGroupKey) || 0) + 1
    );
  });
  const remainingVariationGroups = (analysis.queryVariationGroups || [])
    .map(group => ({
      ...group,
      variationCount: remainingVariationCounts.get(group.key) || 0,
      basePageExists: remainingKeys.has(group.key),
      choice: variationChoices[group.key] || 'base'
    }))
    .filter(group => group.depth <= depthLimit && group.variationCount >= queryThreshold);

  const collapsedGroups = new Set(
    remainingVariationGroups
      .filter(group => group.choice !== 'all')
      .map(group => group.key)
  );
  const pages = pagesAfterDescendants.filter(page =>
    !page.queryGroupKey || !collapsedGroups.has(page.queryGroupKey)
  );

  remainingVariationGroups.forEach(group => {
    if (!collapsedGroups.has(group.key) || group.basePageExists) return;
    if (pages.some(page => page.key === group.key)) return;
    pages.push({
      key: group.key,
      title: group.title,
      description: group.baseUrl,
      url: group.baseUrl,
      parentKey: group.parentKey,
      queryGroupKey: null,
      depth: group.depth
    });
  });

  pages.sort((a, b) =>
    (a.depth || 1) - (b.depth || 1) || (a.url || '').localeCompare(b.url || '')
  );
  const finalByKey = new Map(pages.map(page => [page.key, page]));
  const finalDepthFor = (page, visited = new Set()) => {
    if (!page.parentKey || !finalByKey.has(page.parentKey)) return 1;
    if (visited.has(page.key)) return page.depth || 1;
    return finalDepthFor(finalByKey.get(page.parentKey), new Set([...visited, page.key])) + 1;
  };
  pages.forEach(page => { page.depth = finalDepthFor(page); });
  const resultingDepth = Math.max(1, ...pages.map(page => page.depth || 1));
  const excludedByDepth = analysis.pages.length - depthLimitedPages.length;
  const excludedQueryVariants = pagesAfterDescendants.length - pages.length;

  return {
    pages,
    maxDepth: depthLimit,
    resultingDepth,
    originalPageCount: analysis.pages.length,
    importedCount: pages.length,
    excludedCount: analysis.pages.length - pages.length,
    excludedByDepth,
    excludedDescendants,
    excludedQueryVariants,
    variationGroups: remainingVariationGroups,
    largeBranches
  };
};

export const analyzeSitemapXml = (xmlText, sourceUrl = '') => {
  const parsed = parseSitemapDocument(xmlText);
  if (parsed.type === 'index') {
    throw new Error('This is a sitemap index. Enter its URL so Site Planner can read its child sitemaps.');
  }
  return buildSitemapAnalysis(parsed.locations, sourceUrl);
};

export const analyzeSitemapUrl = async (value) => {
  const startingUrl = normalizePageUrl(value).href;
  const pending = [startingUrl];
  const visited = new Set();
  const pageLocations = [];

  while (pending.length > 0) {
    if (visited.size >= MAX_SITEMAPS) {
      throw new Error(`This sitemap index contains more than ${MAX_SITEMAPS} sitemap files.`);
    }
    const currentUrl = pending.shift();
    if (visited.has(currentUrl)) continue;
    visited.add(currentUrl);

    const xml = await fetchXml(currentUrl);
    const parsed = parseSitemapDocument(xml);
    if (parsed.type === 'index') {
      parsed.locations.forEach(location => {
        const resolved = new URL(location, currentUrl).href;
        if (!visited.has(resolved)) pending.push(resolved);
      });
    } else {
      pageLocations.push(...parsed.locations);
      if (pageLocations.length > MAX_URLS) {
        throw new Error(`This sitemap contains more than ${MAX_URLS.toLocaleString()} URLs.`);
      }
    }
  }

  const analysis = buildSitemapAnalysis(pageLocations, startingUrl);
  return { ...analysis, sitemapCount: visited.size };
};

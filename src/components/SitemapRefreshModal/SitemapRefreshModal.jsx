import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, GitBranch, Link2, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { analyzeSitemapUrl, getSitemapImportPreview } from '../../utils/sitemap';
import { compareSitemapRefresh } from '../../utils/sitemapRefresh';

const DESCENDANT_THRESHOLDS = [10, 25, 50, 100, 250, 500];
const QUERY_THRESHOLDS = [2, 5, 10, 25, 50, 100];
const defaults = {
  maxDepth: null,
  branchThreshold: 25,
  queryThreshold: 5,
  branchChoices: {},
  variationChoices: {}
};

const ChoiceCard = ({ children }) => (
  <div style={{ padding: '12px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
    {children}
  </div>
);

const SummaryItem = ({ label, value }) => (
  <div style={{ padding: '11px', backgroundColor: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginBottom: '2px' }}>{label}</div>
    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{value.toLocaleString()}</div>
  </div>
);

export default function SitemapRefreshModal({ isOpen, plan, onClose, onApply }) {
  const [result, setResult] = useState({ status: 'idle', analysis: null, error: '' });
  const [settingsMode, setSettingsMode] = useState('previous');
  const [settings, setSettings] = useState(defaults);
  const [applyMode, setApplyMode] = useState('match');

  useEffect(() => {
    if (!isOpen || !plan?.sourceUrl) return;
    let cancelled = false;
    const saved = { ...defaults, ...plan.sitemapSettings };
    setSettings(saved);
    setSettingsMode('previous');
    setApplyMode('match');
    setResult({ status: 'loading', analysis: null, error: '' });
    analyzeSitemapUrl(plan.sourceUrl)
      .then(analysis => {
        if (cancelled) return;
        setSettings(current => ({
          ...current,
          maxDepth: Math.min(current.maxDepth || analysis.maxDepth, analysis.maxDepth)
        }));
        setResult({ status: 'ready', analysis, error: '' });
      })
      .catch(error => {
        if (!cancelled) setResult({ status: 'error', analysis: null, error: error.message || 'The sitemap could not be refreshed.' });
      });
    return () => { cancelled = true; };
  }, [isOpen, plan?.id, plan?.sourceUrl]);

  if (!isOpen) return null;

  const analysis = result.analysis;
  const preview = analysis ? getSitemapImportPreview(analysis, settings) : null;
  const savedSettings = analysis
    ? { ...defaults, ...plan.sitemapSettings, maxDepth: Math.min(plan.sitemapSettings?.maxDepth || analysis.maxDepth, analysis.maxDepth) }
    : defaults;
  const previousPreview = analysis ? getSitemapImportPreview(analysis, savedSettings) : null;
  const comparison = preview ? compareSitemapRefresh(plan, preview, analysis) : null;
  const sitemapComparison = previousPreview ? compareSitemapRefresh(plan, previousPreview, analysis) : null;
  const previousKeys = new Set((previousPreview?.pages || []).map(page => page.key));
  const nextKeys = new Set((preview?.pages || []).map(page => page.key));
  const settingsAdded = preview?.pages.filter(page => !previousKeys.has(page.key)).length || 0;
  const settingsRemoved = previousPreview?.pages.filter(page => !nextKeys.has(page.key)).length || 0;
  const manualPageCount = (plan.pages || []).filter(page => page.pageOrigin === 'manual' || (!page.sitemapKey && !page.url)).length;
  const pagesAfterRefresh = applyMode === 'orphans'
    ? (plan.pages || []).length + (comparison?.addedCount || 0)
    : (preview?.pages.length || 0) + (comparison?.missingCount || 0) + manualPageCount;

  const updateSettings = (updates, resetVariations = false) => setSettings(current => ({
    ...current,
    ...updates,
    ...(resetVariations ? { variationChoices: {} } : {})
  }));

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1099, backdropFilter: 'blur(3px)' }} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="sitemap-refresh-title" style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 'min(650px, calc(100vw - 32px))', maxHeight: '88vh', overflowY: 'auto',
        padding: '26px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
        border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
        boxShadow: '0 24px 70px rgba(0,0,0,0.35)', zIndex: 1100
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <RefreshCw size={25} style={{ color: 'var(--primary-color)' }} />
            <div>
              <h2 id="sitemap-refresh-title" style={{ margin: 0, fontSize: '1.3rem' }}>Refresh Sitemap</h2>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{plan?.sourceUrl}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"><X size={20} /></button>
        </div>

        {result.status === 'loading' && (
          <div style={{ padding: '34px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <LoaderCircle className="spin" size={26} />
            <div style={{ marginTop: '9px' }}>Checking the latest sitemap…</div>
          </div>
        )}

        {result.status === 'error' && (
          <div style={{ display: 'flex', gap: '10px', marginTop: '18px', padding: '13px', color: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 'var(--radius-md)' }}>
            <AlertCircle size={19} /><span>{result.error}</span>
          </div>
        )}

        {result.status === 'ready' && preview && comparison && (
          <>
            <div style={{ display: 'flex', gap: '9px', alignItems: 'center', marginTop: '18px', padding: '12px', color: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle2 size={19} /> <strong style={{ fontSize: '0.86rem' }}>Latest sitemap found</strong>
            </div>

            <h3 style={{ margin: '20px 0 9px', fontSize: '0.95rem' }}>Import settings</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '9px' }}>
              {[
                ['previous', 'Use previous settings', 'Refresh with the choices saved on this plan.'],
                ['review', 'Review or change settings', 'Change depth, descendants, or query variations.']
              ].map(([value, title, description]) => (
                <label key={value} style={{ padding: '12px', border: `1px solid ${settingsMode === value ? 'var(--primary-color)' : 'var(--border-color)'}`, borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                  <input type="radio" name="settings-mode" value={value} checked={settingsMode === value} onChange={() => {
                    setSettingsMode(value);
                    if (value === 'previous') setSettings(savedSettings);
                  }} />
                  <strong style={{ marginLeft: '7px', fontSize: '0.82rem' }}>{title}</strong>
                  <div style={{ margin: '5px 0 0 22px', color: 'var(--text-secondary)', fontSize: '0.73rem', lineHeight: 1.4 }}>{description}</div>
                </label>
              ))}
            </div>

            {settingsMode === 'previous' && (
              <div style={{ marginTop: '9px', padding: '10px 12px', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', fontSize: '0.76rem' }}>
                Through level {settings.maxDepth} · Flag {settings.branchThreshold}+ descendants · Flag {settings.queryThreshold}+ query variants
              </div>
            )}

            {settingsMode === 'review' && (
              <div style={{ marginTop: '12px', padding: '14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'block', fontWeight: 650, fontSize: '0.82rem' }}>Import depth</label>
                <select aria-label="Refresh import depth" value={settings.maxDepth} onChange={event => updateSettings({ maxDepth: Number(event.target.value) }, true)} style={{ width: '100%', marginTop: '6px', padding: '8px' }}>
                  {Array.from({ length: analysis.maxDepth }, (_, index) => index + 1).map(depth => <option key={depth} value={depth}>Through level {depth}{depth === analysis.maxDepth ? ' — Full sitemap' : ''}</option>)}
                </select>

                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '14px', paddingTop: '14px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
                    <span><GitBranch size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Flag branches with at least</span>
                    <select aria-label="Refresh descendant threshold" value={settings.branchThreshold} onChange={event => updateSettings({ branchThreshold: Number(event.target.value), branchChoices: {} }, true)}>
                      {DESCENDANT_THRESHOLDS.map(value => <option key={value} value={value}>{value}+ descendants</option>)}
                    </select>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '9px' }}>
                    {preview.largeBranches.length === 0 && <em style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No branches meet this threshold.</em>}
                    {preview.largeBranches.map(branch => <ChoiceCard key={branch.key}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 650 }}>
                        {branch.path}{' '}
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                          {branch.missingParent
                            ? `contains ${branch.descendantCount.toLocaleString()} pages — the parent page is not listed in the sitemap`
                            : `has ${branch.descendantCount.toLocaleString()} descendants`}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '0.75rem' }}>
                        <label><input type="radio" name={`refresh-branch-${branch.key}`} checked={(settings.branchChoices[branch.key] || 'all') === 'all'} onChange={() => updateSettings({ branchChoices: { ...settings.branchChoices, [branch.key]: 'all' } }, true)} /> {branch.missingParent ? 'Keep all pages' : 'Keep all descendants'}</label>
                        {branch.missingParent ? <>
                          <label><input type="radio" name={`refresh-branch-${branch.key}`} checked={['exclude', 'placeholder'].includes(settings.branchChoices[branch.key])} onChange={() => updateSettings({ branchChoices: { ...settings.branchChoices, [branch.key]: 'placeholder' } }, true)} /> Replace them with “{branch.placeholderTitle}” Page</label>
                        </> : (
                          <label><input type="radio" name={`refresh-branch-${branch.key}`} checked={settings.branchChoices[branch.key] === 'only'} onChange={() => updateSettings({ branchChoices: { ...settings.branchChoices, [branch.key]: 'only' } }, true)} /> Keep {branch.path} only</label>
                        )}
                      </div>
                    </ChoiceCard>)}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '14px', paddingTop: '14px' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '0.8rem' }}>
                    <span><Link2 size={15} style={{ verticalAlign: 'middle', marginRight: '6px' }} />Flag pages with at least</span>
                    <select aria-label="Refresh query-string threshold" value={settings.queryThreshold} onChange={event => updateSettings({ queryThreshold: Number(event.target.value) })}>
                      {QUERY_THRESHOLDS.map(value => <option key={value} value={value}>{value}+ variants</option>)}
                    </select>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '9px' }}>
                    {preview.variationGroups.length === 0 && <em style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>No query-string groups meet this threshold.</em>}
                    {preview.variationGroups.map(group => <ChoiceCard key={group.key}>
                      <div style={{ fontSize: '0.8rem', fontWeight: 650 }}>{group.path} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>has {group.variationCount.toLocaleString()} variants</span></div>
                      <div style={{ display: 'flex', gap: '14px', marginTop: '8px', fontSize: '0.75rem' }}>
                        <label><input type="radio" name={`refresh-query-${group.key}`} checked={(settings.variationChoices[group.key] || 'base') === 'base'} onChange={() => updateSettings({ variationChoices: { ...settings.variationChoices, [group.key]: 'base' } })} /> Keep page only</label>
                        <label><input type="radio" name={`refresh-query-${group.key}`} checked={settings.variationChoices[group.key] === 'all'} onChange={() => updateSettings({ variationChoices: { ...settings.variationChoices, [group.key]: 'all' } })} /> Keep all variants</label>
                      </div>
                    </ChoiceCard>)}
                  </div>
                </div>
              </div>
            )}

            <h3 style={{ margin: '20px 0 9px', fontSize: '0.95rem' }}>Refresh preview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <SummaryItem label="New sitemap pages" value={sitemapComparison?.addedCount || 0} />
              <SummaryItem label="Moved sitemap pages" value={sitemapComparison?.movedCount || 0} />
              <SummaryItem label="Missing sitemap pages" value={sitemapComparison?.missingCount || 0} />
              <SummaryItem label="Added by settings" value={settingsAdded} />
              <SummaryItem label="Excluded by settings" value={settingsRemoved} />
              <SummaryItem label="Pages after refresh" value={pagesAfterRefresh} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', lineHeight: 1.45 }}>
              Missing sitemap pages and manually created pages will be preserved. Page descriptions, images, blocks, and notes will not be overwritten.
            </p>

            <h3 style={{ margin: '18px 0 9px', fontSize: '0.95rem' }}>Apply changes</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label><input type="radio" name="apply-mode" checked={applyMode === 'match'} onChange={() => setApplyMode('match')} /> <strong style={{ marginLeft: '6px' }}>Match the sitemap structure</strong><span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}> — add and reposition imported pages; preserve missing pages as orphans.</span></label>
              <label><input type="radio" name="apply-mode" checked={applyMode === 'orphans'} onChange={() => setApplyMode('orphans')} /> <strong style={{ marginLeft: '6px' }}>Add new pages as orphans</strong><span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}> — leave the existing structure unchanged.</span></label>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ padding: '9px 15px', color: 'var(--text-secondary)' }}>Cancel</button>
          <button disabled={!preview} onClick={() => {
            if (!preview) return;
            onApply({
              pages: preview.pages,
              sitemapSettings: settings,
              sitemapAllKeys: analysis.pages.map(page => page.key),
              applyMode
            });
            onClose();
          }} style={{ padding: '9px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600, color: 'white', backgroundColor: 'var(--primary-color)', opacity: preview ? 1 : 0.45 }}>
            Apply Refresh
          </button>
        </div>
      </div>
    </>
  );
}

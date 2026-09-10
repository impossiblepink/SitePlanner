import { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileUp, GitBranch, Globe2, Link2, LoaderCircle, Network, X } from 'lucide-react';
import { analyzeSitemapUrl, analyzeSitemapXml, getSitemapImportPreview } from '../../utils/sitemap';

const initialState = { status: 'idle', analysis: null, error: '' };
const formatLevelCount = (count) => `${count} ${count === 1 ? 'level' : 'levels'}`;
const DESCENDANT_THRESHOLDS = [10, 25, 50, 100, 250, 500];
const QUERY_THRESHOLDS = [2, 5, 10, 25, 50, 100];

const SectionHeading = ({ number, icon, title, description }) => (
  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px', marginTop: '18px' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
      <span style={{
        display: 'inline-flex', width: '21px', height: '21px', alignItems: 'center',
        justifyContent: 'center', borderRadius: '50%', backgroundColor: 'var(--primary-color)',
        color: 'white', fontSize: '0.7rem', fontWeight: 700
      }}>{number}</span>
      <span style={{ color: 'var(--primary-color)', display: 'flex' }}>{icon}</span>
      <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{title}</h3>
    </div>
    <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.45 }}>
      {description}
    </p>
  </div>
);

const LargeBranchesSection = ({ branches, choices, onChange, threshold, onThresholdChange }) => {
  return (
    <div>
      <SectionHeading
        number="1"
        icon={<GitBranch size={17} />}
        title="Large page collections"
        description="Review these branches first. Removing descendants also removes their query-string decisions below."
      />
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        padding: '10px 12px', marginBottom: '10px', backgroundColor: 'var(--bg-color)',
        border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
        fontSize: '0.8rem', color: 'var(--text-secondary)'
      }}>
        Flag branches with at least
        <select
          aria-label="Descendant threshold"
          value={threshold}
          onChange={event => onThresholdChange(Number(event.target.value))}
          style={{
            padding: '6px 9px', borderRadius: '6px', border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)'
          }}
        >
          {DESCENDANT_THRESHOLDS.map(value => <option key={value} value={value}>{value}+ descendants</option>)}
        </select>
      </label>
      {branches.length === 0 && (
        <div style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontSize: '0.78rem', fontStyle: 'italic' }}>
          No branches meet this threshold.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {branches.map(branch => {
          const selectedChoice = choices[branch.key] || 'all';
          const inputName = 'branch-' + branch.key;
          return (
            <div key={branch.key} style={{
              padding: '13px', backgroundColor: 'var(--bg-color)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)'
            }}>
              <div style={{ fontWeight: 650, fontSize: '0.86rem', marginBottom: '9px' }}>
                {branch.path}{' '}
                <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>
                  {branch.missingParent
                    ? `contains ${branch.descendantCount.toLocaleString()} pages — the parent page is not listed in the sitemap`
                    : `has ${branch.descendantCount.toLocaleString()} descendants`}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={inputName}
                    checked={selectedChoice === 'all'}
                    onClick={() => onChange(branch.key, 'all')}
                    onChange={() => onChange(branch.key, 'all')}
                  />
                  {branch.missingParent ? 'Keep all pages' : 'Keep all descendants'}
                </label>
                {branch.missingParent ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name={inputName}
                      checked={['exclude', 'placeholder'].includes(selectedChoice)}
                      onChange={() => onChange(branch.key, 'placeholder')}
                    />
                    Replace them with “{branch.placeholderTitle}” Page
                  </label>
                ) : (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="radio" name={inputName} checked={selectedChoice === 'only'} onChange={() => onChange(branch.key, 'only')} />
                    Keep {branch.path} only
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const VariationGroupsSection = ({ groups, choices, onChange, threshold, onThresholdChange }) => {
  return (
    <div>
      <SectionHeading
        number="2"
        icon={<Link2 size={17} />}
        title="Query-string variations"
        description="Only variations remaining after the descendant choices above are shown here."
      />
      <label style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        padding: '10px 12px', marginBottom: '10px', backgroundColor: 'var(--bg-color)',
        border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
        fontSize: '0.8rem', color: 'var(--text-secondary)'
      }}>
        Flag pages with at least
        <select
          aria-label="Query-string threshold"
          value={threshold}
          onChange={event => onThresholdChange(Number(event.target.value))}
          style={{
            padding: '6px 9px', borderRadius: '6px', border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)'
          }}
        >
          {QUERY_THRESHOLDS.map(value => <option key={value} value={value}>{value}+ variants</option>)}
        </select>
      </label>
      {groups.length === 0 && (
        <div style={{ padding: '11px 12px', color: 'var(--text-secondary)', fontSize: '0.78rem', fontStyle: 'italic' }}>
          No query-string groups meet this threshold.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {groups.map(group => {
          const selectedChoice = choices[group.key] || 'base';
          const inputName = 'variation-' + group.key;
          return (
            <div key={group.key} style={{
              padding: '13px', backgroundColor: 'var(--bg-color)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)'
            }}>
              <div style={{ fontWeight: 650, fontSize: '0.86rem' }}>
                {group.path} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>has {group.variationCount.toLocaleString()} query-string variants</span>
              </div>
              <div style={{ margin: '4px 0 9px', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                {group.basePageExists
                  ? 'The query-free page is listed in the sitemap.'
                  : 'The query-free page is not listed; Site Planner will create the clean address.'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={inputName}
                    checked={selectedChoice === 'base'}
                    onChange={() => onChange(group.key, 'base')}
                  />
                  Keep {group.path} only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name={inputName}
                    checked={selectedChoice === 'all'}
                    onChange={() => onChange(group.key, 'all')}
                  />
                  Keep all variants
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function SitemapImportModal({ isOpen, onClose, onCreate }) {
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [planName, setPlanName] = useState('');
  const [result, setResult] = useState(initialState);
  const [maxDepth, setMaxDepth] = useState(1);
  const [branchChoices, setBranchChoices] = useState({});
  const [variationChoices, setVariationChoices] = useState({});
  const [branchThreshold, setBranchThreshold] = useState(25);
  const [queryThreshold, setQueryThreshold] = useState(5);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setSitemapUrl('');
      setPlanName('');
      setResult(initialState);
      setMaxDepth(1);
      setBranchChoices({});
      setVariationChoices({});
      setBranchThreshold(25);
      setQueryThreshold(5);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const analyze = async () => {
    if (!sitemapUrl.trim()) {
      setResult({ status: 'error', analysis: null, error: 'Enter a sitemap URL first.' });
      return;
    }

    setResult({ status: 'analyzing', analysis: null, error: '' });
    try {
      const analysis = await analyzeSitemapUrl(sitemapUrl.trim());
      setPlanName(analysis.defaultName);
      setMaxDepth(analysis.maxDepth);
      setBranchChoices({});
      setVariationChoices({});
      setResult({ status: 'ready', analysis, error: '' });
    } catch (error) {
      setResult({ status: 'error', analysis: null, error: error.message || 'The sitemap could not be analyzed.' });
    }
  };

  const analyzeFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setResult({ status: 'analyzing', analysis: null, error: '' });
    try {
      const xml = await file.text();
      const analysis = analyzeSitemapXml(xml, file.name);
      setSitemapUrl('');
      setPlanName(analysis.defaultName);
      setMaxDepth(analysis.maxDepth);
      setBranchChoices({});
      setVariationChoices({});
      setResult({ status: 'ready', analysis, error: '' });
    } catch (error) {
      setResult({ status: 'error', analysis: null, error: error.message || 'The XML file could not be analyzed.' });
    }
  };

  const resetAnalysis = (value) => {
    setSitemapUrl(value);
    if (result.status !== 'idle') setResult(initialState);
  };

  const analysis = result.analysis;
  const preview = analysis
    ? getSitemapImportPreview(analysis, {
      maxDepth,
      branchChoices,
      variationChoices,
      branchThreshold,
      queryThreshold
    })
    : null;

  return (
    <>
      <div
        style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)',
          zIndex: 1099, backdropFilter: 'blur(3px)'
        }}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sitemap-import-title"
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 'min(620px, calc(100vw - 32px))', maxHeight: '85vh', overflowY: 'auto',
          padding: '26px', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)',
          border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)',
          boxShadow: '0 24px 70px rgba(0,0,0,0.35)', zIndex: 1100
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '22px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ color: 'var(--primary-color)', marginTop: '2px' }}><Network size={25} /></div>
            <div>
              <h2 id="sitemap-import-title" style={{ margin: 0, fontSize: '1.3rem' }}>Build from Sitemap</h2>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                Analyze a sitemap before creating an editable page tree.
              </p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--text-secondary)', alignSelf: 'flex-start' }}>
            <X size={20} />
          </button>
        </div>

        <label htmlFor="sitemap-url" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '7px' }}>
          Sitemap URL
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            id="sitemap-url"
            type="url"
            value={sitemapUrl}
            onChange={event => resetAnalysis(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter' && result.status !== 'analyzing') analyze();
            }}
            placeholder="https://example.com/sitemap.xml"
            autoFocus
            style={{
              flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)',
              color: 'var(--text-primary)', outline: 'none'
            }}
          />
          <button
            onClick={analyze}
            disabled={result.status === 'analyzing'}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 15px',
              borderRadius: 'var(--radius-md)', backgroundColor: 'var(--primary-color)',
              color: 'white', fontWeight: 600, opacity: result.status === 'analyzing' ? 0.7 : 1
            }}
          >
            {result.status === 'analyzing' ? <LoaderCircle className="spin" size={16} /> : <Globe2 size={16} />}
            Analyze
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '16px 0', color: 'var(--text-secondary)' }}>
          <span style={{ height: '1px', backgroundColor: 'var(--border-color)', flex: 1 }} />
          <span style={{ fontSize: '0.75rem' }}>or</span>
          <span style={{ height: '1px', backgroundColor: 'var(--border-color)', flex: 1 }} />
        </div>

        <input ref={fileInputRef} type="file" accept=".xml,text/xml,application/xml" onChange={analyzeFile} style={{ display: 'none' }} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={result.status === 'analyzing'}
          style={{
            width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
            padding: '9px 12px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', backgroundColor: 'var(--bg-color)'
          }}
        >
          <FileUp size={16} /> Upload XML File
        </button>

        {result.status === 'analyzing' && (
          <div style={{ marginTop: '20px', padding: '18px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <LoaderCircle className="spin" size={25} style={{ marginBottom: '8px' }} />
            <div>Checking the sitemap and calculating its page tree…</div>
          </div>
        )}

        {result.status === 'error' && (
          <div style={{
            display: 'flex', gap: '10px', marginTop: '18px', padding: '13px',
            borderRadius: 'var(--radius-md)', color: '#ef4444',
            backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)'
          }}>
            <AlertCircle size={19} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>{result.error}</div>
          </div>
        )}

        {result.status === 'ready' && analysis && (
          <div style={{ marginTop: '20px' }}>
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'center', padding: '12px 13px',
              borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(34,197,94,0.1)',
              color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)'
            }}>
              <CheckCircle2 size={19} />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Sitemap found and ready to import</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px', marginTop: '12px' }}>
              {[
                ['Pages found', analysis.resultingPageCount.toLocaleString()],
                ['Sitemap depth', formatLevelCount(analysis.maxDepth)],
                ['Sitemap files', analysis.sitemapCount.toLocaleString()]
              ].map(([label, value]) => (
                <div key={label} style={{ padding: '12px', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginBottom: '3px' }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{value}</div>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: '18px', padding: '15px', backgroundColor: 'var(--bg-color)',
              border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)'
            }}>
              <label htmlFor="sitemap-depth" style={{ display: 'block', fontSize: '0.875rem', fontWeight: 650, marginBottom: '5px' }}>
                Import depth
              </label>
              <p style={{ margin: '0 0 11px', color: 'var(--text-secondary)', fontSize: '0.78rem', lineHeight: 1.45 }}>
                Homepage is level 1. Pages below the selected level will not be imported.
              </p>
              <select
                id="sitemap-depth"
                value={maxDepth}
                onChange={event => {
                  setMaxDepth(Number(event.target.value));
                  setVariationChoices({});
                }}
                style={{
                  width: '100%', padding: '9px 10px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-surface)',
                  color: 'var(--text-primary)'
                }}
              >
                {Array.from({ length: analysis.maxDepth }, (_, index) => index + 1).map(depth => (
                  <option key={depth} value={depth}>
                    {depth === analysis.maxDepth
                      ? `Level ${depth} — Full sitemap`
                      : `Through level ${depth}`}
                  </option>
                ))}
              </select>
            </div>

            <LargeBranchesSection
              branches={preview.largeBranches}
              choices={branchChoices}
              threshold={branchThreshold}
              onThresholdChange={value => {
                setBranchThreshold(value);
                setVariationChoices({});
              }}
              onChange={(key, choice) => {
                setBranchChoices(choices => ({ ...choices, [key]: choice }));
                setVariationChoices({});
              }}
            />

            <VariationGroupsSection
              groups={preview.variationGroups}
              choices={variationChoices}
              threshold={queryThreshold}
              onThresholdChange={setQueryThreshold}
              onChange={(key, choice) => setVariationChoices(choices => ({ ...choices, [key]: choice }))}
            />

            <div style={{ marginTop: '18px' }}>
              <h3 style={{ margin: '0 0 9px', fontSize: '0.95rem' }}>Import summary</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '9px' }}>
                {[
                  ['Original pages', preview.originalPageCount.toLocaleString()],
                  ['Excluded by depth', preview.excludedByDepth.toLocaleString()],
                  ['Excluded descendants', preview.excludedDescendants.toLocaleString()],
                  ['Excluded query variants', preview.excludedQueryVariants.toLocaleString()],
                  ['Pages to import', preview.importedCount.toLocaleString()],
                  ['Resulting depth', formatLevelCount(preview.resultingDepth)]
                ].map(([label, value]) => (
                  <div key={label} style={{ padding: '11px', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.7rem', marginBottom: '2px' }}>{label}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '18px' }}>
              <label htmlFor="sitemap-plan-name" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '7px' }}>
                Plan name
              </label>
              <input
                id="sitemap-plan-name"
                value={planName}
                onChange={event => setPlanName(event.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-primary)', outline: 'none'
                }}
              />
            </div>

            {analysis.warnings.length > 0 && (
              <div style={{ marginTop: '12px', color: '#eab308', fontSize: '0.78rem', lineHeight: 1.5 }}>
                {analysis.warnings.map(warning => <div key={warning}>• {warning}</div>)}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button onClick={onClose} style={{ padding: '9px 15px', color: 'var(--text-secondary)' }}>Cancel</button>
          <button
            onClick={() => {
              if (!analysis || !preview || !planName.trim()) return;
              onCreate({
                ...analysis,
                ...preview,
                name: planName.trim(),
                sitemapSettings: {
                  maxDepth,
                  branchThreshold,
                  queryThreshold,
                  branchChoices,
                  variationChoices
                }
              });
              onClose();
            }}
            disabled={result.status !== 'ready' || !planName.trim()}
            style={{
              padding: '9px 16px', borderRadius: 'var(--radius-md)', fontWeight: 600,
              backgroundColor: 'var(--primary-color)', color: 'white',
              opacity: result.status === 'ready' && planName.trim() ? 1 : 0.45
            }}
          >
            Create Sitemap
          </button>
        </div>
      </div>
    </>
  );
}

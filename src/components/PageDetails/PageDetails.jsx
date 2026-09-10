import { useState, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { X, Plus, Trash2, Image as ImageIcon, Layout as LayoutIcon, FileText, ArrowLeft, Check } from 'lucide-react';
import { PAGE_COLORS } from '../../utils/pageColors';

export default function PageDetails({ pageId, onClose }) {
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'blocks', 'attachments'
  
  const pages = useStore(state => state.pages);
  const page = pages.find(p => p.id === pageId);
  const updatePage = useStore(state => state.updatePage);
  const setPageColor = useStore(state => state.setPageColor);
  
  const blocksMap = useStore(state => state.blocks);
  const blocks = (pageId && blocksMap && blocksMap[pageId]) || [];
  const addBlock = useStore(state => state.addBlock);
  const updateBlock = useStore(state => state.updateBlock);
  const deleteBlock = useStore(state => state.deleteBlock);

  const attachmentsMap = useStore(state => state.attachments);
  const attachments = (pageId && attachmentsMap && attachmentsMap[pageId]) || [];
  const addAttachment = useStore(state => state.addAttachment);
  const deleteAttachment = useStore(state => state.deleteAttachment);

  const fileInputRef = useRef(null);

  if (!page) {
    return null;
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        addAttachment(pageId, { name: file.name, dataUrl: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="details-panel">
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 20px', 
        borderBottom: '1px solid var(--border-color)' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={onClose} 
            style={{ 
              color: 'var(--text-secondary)', 
              padding: '6px 10px', 
              borderRadius: 'var(--radius-md)',
              display: 'flex', alignItems: 'center', gap: '4px',
              backgroundColor: 'var(--bg-color)',
              border: '1px solid var(--border-color)'
            }}
            title="Back to Sitemap"
          >
            <ArrowLeft size={16} />
            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>Back</span>
          </button>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            {page.title || 'Edit Page'}
          </h2>
        </div>

        <button 
          onClick={onClose} 
          style={{ color: 'var(--text-secondary)', padding: '4px' }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        <button 
          className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} 
          onClick={() => setActiveTab('details')}
        >
          <FileText size={16} /> Details
        </button>
        <button 
          className={`tab-btn ${activeTab === 'blocks' ? 'active' : ''}`} 
          onClick={() => setActiveTab('blocks')}
        >
          <LayoutIcon size={16} /> Blocks ({blocks.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'attachments' ? 'active' : ''}`} 
          onClick={() => setActiveTab('attachments')}
        >
          <ImageIcon size={16} /> Images ({attachments.length})
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        
        {/* Details Tab */}
        {activeTab === 'details' && (
          <div>
            <div className="form-group">
              <label className="form-label">Page Title</label>
              <input 
                type="text" 
                className="form-input" 
                value={page.title || ''}
                onChange={(e) => updatePage(page.id, { title: e.target.value })}
              />
              <div
                role="radiogroup"
                aria-label="Page color"
                style={{ display: 'flex', gap: '10px', marginTop: '10px' }}
              >
                {Object.entries(PAGE_COLORS).map(([name, colors]) => {
                  const selected = (page.pageColor || 'default') === name;
                  const label = name.charAt(0).toUpperCase() + name.slice(1);
                  return (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={label}
                      title={label}
                      onClick={() => setPageColor(page.id, name)}
                      style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        backgroundColor: colors.title,
                        border: selected ? '2px solid white' : '2px solid transparent',
                        boxShadow: selected ? '0 0 0 2px var(--primary-color)' : '0 0 0 1px var(--border-color)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {selected && <Check size={17} strokeWidth={3} color={name === 'default' || name === 'yellow' ? '#0f172a' : 'white'} />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea 
                className="form-input" 
                rows={4}
                value={page.description || ''}
                onChange={(e) => updatePage(page.id, { description: e.target.value })}
                placeholder="Briefly describe the purpose of this page..."
              />
            </div>
          </div>
        )}

        {/* Blocks Tab */}
        {activeTab === 'blocks' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Define structural sections for this page.</p>
              <button 
                onClick={() => addBlock(pageId)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', color: 'var(--primary-color)', fontWeight: 500 }}
              >
                <Plus size={16} /> Add Block
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {blocks.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  No blocks added yet.
                </div>
              )}
              {blocks.map((block, index) => (
                <div key={block.id || index} style={{ padding: '14px', backgroundColor: 'var(--bg-color)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Block {index + 1}</span>
                    <button onClick={() => deleteBlock(pageId, block.id)} style={{ color: 'var(--danger-color)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ width: '100%', marginBottom: '8px' }}
                    value={block.title || ''}
                    onChange={(e) => updateBlock(pageId, block.id, { title: e.target.value })}
                    placeholder="Block Title (e.g., Hero Section)"
                  />
                  <textarea 
                    className="form-input" 
                    style={{ width: '100%', marginBottom: '8px' }}
                    rows={2}
                    value={block.description || ''}
                    onChange={(e) => updateBlock(pageId, block.id, { description: e.target.value })}
                    placeholder="Block description or requirements..."
                  />

                  {/* Routing Links (Dashed Lines in Map View) */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Routes To (Target Pages - Dashed Links)</label>
                    <select 
                      multiple
                      className="form-input"
                      value={block.routesTo || []}
                      onChange={(e) => {
                        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                        updateBlock(pageId, block.id, { routesTo: selectedOptions });
                      }}
                      style={{ minHeight: '70px', fontSize: '0.8125rem' }}
                    >
                      {pages.filter(p => p.id !== pageId).map(p => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                    </select>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Hold Cmd/Ctrl to select multiple. Linked pages will display a dashed connection line on the sitemap.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments Tab */}
        {activeTab === 'attachments' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Attach reference images or wireframes.</p>
              <button 
                onClick={() => fileInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', color: 'var(--primary-color)', fontWeight: 500 }}
              >
                <Plus size={16} /> Upload Image
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept="image/*" 
                style={{ display: 'none' }} 
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {attachments.length === 0 && (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                  No attachments added yet.
                </div>
              )}
              {attachments.map(att => (
                <div key={att.id} style={{ position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <img src={att.dataUrl} alt={att.name} style={{ width: '100%', display: 'block', maxHeight: '200px', objectFit: 'cover' }} />
                  <div style={{ 
                    position: 'absolute', top: 0, left: 0, right: 0, 
                    padding: '8px 12px', 
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 500, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{att.name}</span>
                    <button 
                      onClick={() => deleteAttachment(pageId, att.id)}
                      style={{ color: 'white', padding: '4px', background: 'rgba(239, 68, 68, 0.85)', borderRadius: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

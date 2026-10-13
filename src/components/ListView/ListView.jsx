import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { Edit3, ChevronRight, ChevronDown, Plus, PlusCircle, Trash2, GripVertical, Unlink, Layers, FolderMinus, FolderPlus } from 'lucide-react';
import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { pageColorFor } from '../../utils/pageColors';

const buildTree = (pages = [], parentId = null, visited = new Set()) => {
  if (!Array.isArray(pages)) return [];
  
  return pages
    .filter(p => p && p.parentId === parentId && !visited.has(p.id))
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map(p => {
      const nextVisited = new Set(visited);
      nextVisited.add(p.id);
      return {
        ...p,
        children: buildTree(pages, p.id, nextVisited)
      };
    });
};

function PageListItem({ 
  page, 
  depth = 0, 
  onEditNode, 
  isExpanded, 
  toggleExpand, 
  onDragStart, 
  onDrop, 
  draggedPageId,
  onDeleteNode,
  readOnly = false
}) {
  const addPage = useStore(state => state.addPage);
  const addSiblingPage = useStore(state => state.addSiblingPage);

  const [dropPosition, setDropPosition] = useState(null);
  const dragCounter = React.useRef(0);
  const containerRef = React.useRef(null);

  if (!page || !page.id) return null;

  const childrenList = Array.isArray(page.children) ? page.children : [];
  const hasChildren = childrenList.length > 0;
  const pageColors = pageColorFor(page.pageColor);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedPageId || draggedPageId === page.id) return;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const height = rect.height;

    if (offsetY < height * 0.35) {
      setDropPosition('before');
    } else if (offsetY > height * 0.65) {
      setDropPosition('after');
    } else {
      setDropPosition('child');
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setDropPosition(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    if (dropPosition) {
      onDrop(page.id, dropPosition);
    }
    setDropPosition(null);
  };

  let borderStyle = pageColors.border
    ? `2px solid ${pageColors.border}`
    : '1px solid var(--border-color)';
  let bgStyle = 'var(--bg-surface)';

  if (dropPosition === 'child') {
    borderStyle = '2px dashed var(--primary-color)';
    bgStyle = 'var(--bg-surface-hover)';
  }

  const isBefore = dropPosition === 'before';
  const isAfter = dropPosition === 'after';

  return (
    <div 
      ref={containerRef}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{ marginBottom: '6px', position: 'relative' }}
    >
      {/* Spacer Before */}
      <div style={{
        height: isBefore ? '48px' : '0px',
        transition: 'height 0.2s cubic-bezier(0.2, 0, 0, 1)',
        overflow: 'hidden',
        marginLeft: `${depth * 24}px`,
        marginBottom: isBefore ? '4px' : '0px'
      }}>
        <div style={{
          height: '44px',
          backgroundColor: 'var(--bg-surface-hover)',
          border: '2px dashed var(--primary-color)',
          borderRadius: 'var(--radius-md)',
          opacity: 0.8
        }} />
      </div>

      <div 
        draggable={!readOnly && page.id !== 'root'}
        onDragStart={(e) => onDragStart(e, page.id)}
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          backgroundColor: bgStyle,
          borderRadius: 'var(--radius-md)',
          border: borderStyle,
          marginLeft: `${depth * 24}px`,
          gap: '10px',
          cursor: readOnly ? 'default' : 'grab',
          transition: 'background-color 0.15s ease, border 0.15s ease',
          opacity: draggedPageId === page.id ? 0.4 : 1
        }}
      >
        {!readOnly && <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', cursor: 'grab' }}>
          <GripVertical size={16} />
        </div>}

        <button 
          onClick={() => toggleExpand(page.id)}
          style={{ visibility: hasChildren ? 'visible' : 'hidden', padding: '2px', display: 'flex', color: 'var(--text-secondary)' }}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 500, fontSize: '0.9375rem', color: pageColors.title }}>{page.title || 'Untitled Page'}</span>
          {page.description && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {page.description.length > 65 ? page.description.substring(0, 65) + '...' : page.description}
            </span>
          )}
        </div>

        {!readOnly && <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button 
            onClick={() => addPage(page.id)}
            style={{ padding: '6px', color: 'var(--primary-color)', borderRadius: 'var(--radius-md)' }}
            title="Add Child Page"
          >
            <Plus size={16} />
          </button>
          {page.id !== 'root' && (
            <button 
              onClick={() => addSiblingPage(page.id)}
              style={{ padding: '6px', color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)' }}
              title="Add Sibling Page"
            >
              <PlusCircle size={16} />
            </button>
          )}
          <button 
            onClick={() => onEditNode(page.id)}
            style={{ padding: '6px', color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)' }}
            title="Edit Details"
          >
            <Edit3 size={16} />
          </button>
          {page.id !== 'root' && (
            <button 
              onClick={() => onDeleteNode(page.id)}
              style={{ padding: '6px', color: 'var(--danger-color)', borderRadius: 'var(--radius-md)' }}
              title="Delete Page"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>}
      </div>

      {/* Spacer After */}
      <div style={{
        height: isAfter ? '48px' : '0px',
        transition: 'height 0.2s cubic-bezier(0.2, 0, 0, 1)',
        overflow: 'hidden',
        marginLeft: `${depth * 24}px`,
        marginTop: isAfter ? '4px' : '0px'
      }}>
        <div style={{
          height: '44px',
          backgroundColor: 'var(--bg-surface-hover)',
          border: '2px dashed var(--primary-color)',
          borderRadius: 'var(--radius-md)',
          opacity: 0.8
        }} />
      </div>
      
      {/* Nested Children */}
      {isExpanded && hasChildren && (
        <div style={{ marginTop: '4px' }}>
          {childrenList.map(child => (
            <PageListItem 
              key={child.id} 
              page={child} 
              depth={depth + 1} 
              onEditNode={onEditNode}
              isExpanded={isExpanded}
              toggleExpand={toggleExpand}
              onDragStart={onDragStart}
              onDrop={onDrop}
              draggedPageId={draggedPageId}
              onDeleteNode={onDeleteNode}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ListView({ onEditNode, readOnly = false }) {
  const pages = useStore(state => state.pages || []);
  const deletePage = useStore(state => state.deletePage);
  const hasDependencies = useStore(state => state.hasDependencies);
  const reorderPage = useStore(state => state.reorderPage);
  const reparentPage = useStore(state => state.reparentPage);
  const updatePage = useStore(state => state.updatePage);
  const addDisconnectedPage = useStore(state => state.addDisconnectedPage);

  const [draggedPageId, setDraggedPageId] = useState(null);
  const [activeFloatingDropId, setActiveFloatingDropId] = useState(null);
  const [pageToDelete, setPageToDelete] = useState(null);

  const handleRequestDelete = (pageId) => {
    if (hasDependencies(pageId)) {
      setPageToDelete(pageId);
    } else {
      deletePage(pageId);
    }
  };

  const [expandedNodes, setExpandedNodes] = useState(() => {
    const initial = {};
    (pages || []).forEach(p => { if (p && p.id) initial[p.id] = true; });
    return initial;
  });

  const toggleExpand = (id) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (e, id) => {
    setDraggedPageId(id);
    e.dataTransfer.setData('text/plain', id);
  };

  const handleDropOnPage = (targetId, position) => {
    if (draggedPageId && draggedPageId !== targetId) {
      reorderPage(draggedPageId, targetId, position);
    }
    setDraggedPageId(null);
  };

  const handleDropOnFloatingArea = (e) => {
    e.preventDefault();
    setActiveFloatingDropId(null);
    if (draggedPageId && draggedPageId !== 'root') {
      reparentPage(draggedPageId, null);
    }
    setDraggedPageId(null);
  };

  const safePages = Array.isArray(pages) ? pages : [];
  const mainTree = buildTree(safePages, null).filter(p => p && p.id === 'root');
  const floatingRoots = safePages
    .filter(p => p && p.parentId === null && p.id !== 'root')
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto', padding: '32px 0 64px 0' }}>
      
      {/* SECTION 1: SITEMAP HIERARCHY */}
      <div style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={20} style={{ color: 'var(--primary-color)' }} />
              <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 600 }}>Sitemap Hierarchy</h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Connected page structure stemming from the Homepage root.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {!readOnly && <button
              onClick={() => {
                const allExpanded = Object.values(expandedNodes).every(v => v === true);
                const nextState = {};
                (pages || []).forEach(p => { if (p && p.id) nextState[p.id] = !allExpanded; });
                setExpandedNodes(nextState);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 500,
                fontSize: '0.875rem'
              }}
              title="Toggle Expand/Collapse All Sections"
            >
              {Object.values(expandedNodes).every(v => v === true) ? (
                <><FolderMinus size={16} /> Collapse All</>
              ) : (
                <><FolderPlus size={16} /> Expand All</>
              )}
            </button>}

            {!readOnly && <button
              onClick={addDisconnectedPage}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px',
                backgroundColor: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 500,
                fontSize: '0.875rem'
              }}
            >
              <Unlink size={16} />
              Add Floating Section
            </button>}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {mainTree.map(rootNode => (
            <PageListItem 
              key={rootNode.id} 
              page={rootNode} 
              depth={0} 
              onEditNode={onEditNode}
              isExpanded={expandedNodes[rootNode.id] !== false}
              toggleExpand={toggleExpand}
              onDragStart={handleDragStart}
              onDrop={handleDropOnPage}
              draggedPageId={draggedPageId}
              onDeleteNode={handleRequestDelete}
              readOnly={readOnly}
            />
          ))}
        </div>
      </div>

      {/* SECTION 2: FLOATING SECTIONS */}
      <div style={{ borderTop: '2px solid var(--border-color)', paddingTop: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Unlink size={20} style={{ color: 'var(--primary-color)' }} />
              <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 600 }}>Floating Sections</h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Independent page sections maintained separately from the main homepage hierarchy.
            </p>
          </div>
        </div>

        {/* Global Drop Zone */}
        {!readOnly && <div
          onDragOver={(e) => { e.preventDefault(); setActiveFloatingDropId('global'); }}
          onDragLeave={() => setActiveFloatingDropId(null)}
          onDrop={handleDropOnFloatingArea}
          style={{
            padding: '14px',
            marginBottom: '24px',
            borderRadius: 'var(--radius-md)',
            border: activeFloatingDropId === 'global' ? '2px dashed var(--primary-color)' : '1px dashed var(--border-color)',
            backgroundColor: activeFloatingDropId === 'global' ? 'var(--bg-surface-hover)' : 'transparent',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.8125rem',
            transition: 'all 0.2s ease'
          }}
        >
          Drop page here to disconnect it into a floating section
        </div>}

        {/* Individual Floating Section Panels */}
        {floatingRoots.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '32px', 
            color: 'var(--text-secondary)', 
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            fontSize: '0.875rem' 
          }}>
            No floating sections yet. Click "Add Floating Section" or drag pages into this area.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {floatingRoots.map(fp => {
              const fpTree = { ...fp, children: buildTree(safePages, fp.id) };
              const secTitle = fp.sectionTitle || `${fp.title || 'Floating'} Section`;
              const secDesc = fp.sectionDescription || 'Independent section.';

              return (
                <div 
                  key={fp.id}
                  style={{
                    padding: '24px',
                    backgroundColor: 'var(--bg-surface)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <div style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <input
                      type="text"
                      value={secTitle}
                      onChange={(e) => updatePage(fp.id, { sectionTitle: e.target.value })}
                      readOnly={readOnly}
                      placeholder="Section Title"
                      style={{
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        background: 'transparent',
                        border: '1px solid transparent',
                        borderRadius: 'var(--radius-md)',
                        padding: '2px 6px',
                        width: '100%',
                        outline: 'none'
                      }}
                      onFocus={(e) => e.target.style.border = '1px solid var(--primary-color)'}
                      onBlur={(e) => e.target.style.border = '1px solid transparent'}
                    />

                    <input
                      type="text"
                      value={secDesc}
                      onChange={(e) => updatePage(fp.id, { sectionDescription: e.target.value })}
                      readOnly={readOnly}
                      placeholder="Section Description"
                      style={{
                        fontSize: '0.8125rem',
                        color: 'var(--text-secondary)',
                        background: 'transparent',
                        border: '1px solid transparent',
                        borderRadius: 'var(--radius-md)',
                        padding: '2px 6px',
                        width: '100%',
                        outline: 'none',
                        marginTop: '4px'
                      }}
                      onFocus={(e) => e.target.style.border = '1px solid var(--primary-color)'}
                      onBlur={(e) => e.target.style.border = '1px solid transparent'}
                    />
                  </div>

                  <PageListItem
                    page={fpTree}
                    depth={0}
                    onEditNode={onEditNode}
                    isExpanded={expandedNodes[fp.id] !== false}
                    toggleExpand={toggleExpand}
                    onDragStart={handleDragStart}
                    onDrop={handleDropOnPage}
                    draggedPageId={draggedPageId}
                    onDeleteNode={handleRequestDelete}
                    readOnly={readOnly}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!pageToDelete}
        onClose={() => setPageToDelete(null)}
        onConfirm={() => {
          if (pageToDelete) deletePage(pageToDelete);
        }}
        title="Delete Page?"
        isDanger={true}
        confirmText="Delete"
        message="This page has child pages, content blocks, or attachments. Deleting it will also permanently delete all associated items."
      />
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Edit3, Plus, PlusCircle, ChevronDown, ChevronRight, FolderMinus, FolderPlus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { pageColorFor } from '../../utils/pageColors';

export default function PageNode({ id, data }) {
  const updatePage = useStore((state) => state.updatePage);
  const addPage = useStore((state) => state.addPage);
  const addSiblingPage = useStore((state) => state.addSiblingPage);
  const toggleCollapseNode = useStore((state) => state.toggleCollapseNode);
  const collapsedNodes = useStore((state) => state.collapsedNodes || {});
  const pages = useStore((state) => state.pages || []);
  
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(data.title);
  const titleInputRef = useRef(null);

  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState(data.description || '');
  const descInputRef = useRef(null);

  useEffect(() => {
    setTitleValue(data.title);
  }, [data.title]);

  useEffect(() => {
    setDescValue(data.description || '');
  }, [data.description]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (isEditingDesc && descInputRef.current) {
      descInputRef.current.focus();
      descInputRef.current.select();
    }
  }, [isEditingDesc]);

  const handleSaveTitle = () => {
    setIsEditingTitle(false);
    if (titleValue.trim() && titleValue !== data.title) {
      updatePage(id, { title: titleValue.trim() });
    } else {
      setTitleValue(data.title);
    }
  };

  const handleSaveDesc = () => {
    setIsEditingDesc(false);
    if (descValue !== data.description) {
      updatePage(id, { description: descValue.trim() });
    }
  };

  const pageColors = pageColorFor(data.pageColor);
  const borderStyle = data.isDragTarget
    ? '3px dashed var(--primary-color)'
    : `2px solid ${pageColors.border || 'var(--border-color)'}`;

  const bgStyle = data.isDragTarget
    ? 'var(--bg-surface-hover)'
    : 'var(--bg-surface)';

  return (
    <div 
      className="page-node-card"
      style={{
        padding: '14px 16px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: bgStyle,
        border: borderStyle,
        width: '280px',
        boxShadow: data.isDragTarget
          ? '0 0 15px rgba(96, 165, 250, 0.5)'
          : '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        position: 'relative',
        transition: 'border 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease'
      }}
    >
      {/* Target handle for incoming connections */}
      {id !== 'root' && (
        <Handle 
          type="target" 
          position={Position.Top} 
          style={{ background: 'var(--text-secondary)', width: '8px', height: '8px' }}
          isConnectable={false}
        />
      )}

      {/* Node Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
        {/* Title Inline Edit */}
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            type="text"
            value={titleValue}
            onChange={(e) => setTitleValue(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveTitle();
              if (e.key === 'Escape') {
                setTitleValue(data.title);
                setIsEditingTitle(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: pageColors.title,
              background: 'var(--bg-color)',
              border: '1px solid var(--primary-color)',
              borderRadius: 'var(--radius-md)',
              padding: '2px 6px',
              width: '100%',
              outline: 'none'
            }}
          />
        ) : (
          <h3 
            onClick={(e) => {
              e.stopPropagation();
              if (data.readOnly) return;
              setIsEditingTitle(true);
            }}
            title={data.readOnly ? undefined : 'Click to edit title'}
            style={{ 
              margin: 0, 
              fontSize: '1rem', 
              fontWeight: 600, 
              color: pageColors.title,
              wordBreak: 'break-word',
              flex: 1,
              cursor: data.readOnly ? 'default' : 'pointer'
            }}
          >
            {data.title}
          </h3>
        )}
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Edit Details Pencil Button */}
        {!data.readOnly && <button
            onClick={(e) => {
              e.stopPropagation();
              data.onEdit(id);
            }}
            style={{ 
              color: 'var(--text-secondary)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center'
            }}
            title="Edit Full Details (Blocks & Images)"
          >
            <Edit3 size={15} />
          </button>}
        </div>
      </div>

      {/* Description Inline Edit */}
      {isEditingDesc ? (
        <textarea
          ref={descInputRef}
          value={descValue}
          onChange={(e) => setDescValue(e.target.value)}
          onBlur={handleSaveDesc}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSaveDesc();
            }
            if (e.key === 'Escape') {
              setDescValue(data.description || '');
              setIsEditingDesc(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          rows={2}
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-primary)',
            background: 'var(--bg-color)',
            border: '1px solid var(--primary-color)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 6px',
            width: '100%',
            outline: 'none',
            resize: 'none',
            fontFamily: 'inherit'
          }}
        />
      ) : (
        <p 
          onClick={(e) => {
            e.stopPropagation();
            if (data.readOnly) return;
            setIsEditingDesc(true);
          }}
          title={data.readOnly ? undefined : 'Click to edit description'}
          style={{ 
            margin: 0, 
            fontSize: '0.8125rem', 
            color: 'var(--text-secondary)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            cursor: data.readOnly ? 'default' : 'pointer',
            minHeight: '20px'
          }}
        >
          {data.description || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Click to add description...</span>}
        </p>
      )}

      {/* Collapse Subtree Toggle Indicator */}
      {data.childCount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCollapseNode(id);
            }}
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              color: collapsedNodes[id] ? 'var(--primary-color)' : 'var(--text-secondary)',
              backgroundColor: collapsedNodes[id] ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-color)',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '2px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title={collapsedNodes[id] ? 'Expand Subtree' : 'Collapse Subtree'}
          >
            {collapsedNodes[id] ? (
              <><FolderPlus size={12} /> Hidden ({data.childCount})</>
            ) : (
              <><FolderMinus size={12} /> Collapse</>
            )}
          </button>
        </div>
      )}

      {/* Source handle for outgoing connections */}
      <Handle 
        type="source" 
        position={Position.Bottom} 
        style={{ background: 'var(--text-secondary)', width: '8px', height: '8px' }}
        isConnectable={false}
      />
    </div>
  );
}

import { useCallback, useEffect, useState, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  useReactFlow,
  Panel
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import PageNode from './PageNode';
import { useStore } from '../../store/useStore';
import { Plus, PlusCircle, Unlink, Columns, Rows, GitFork } from 'lucide-react';
import ConfirmModal from '../ConfirmModal/ConfirmModal';

const nodeTypes = {
  pageNode: PageNode,
};

const nodeWidth = 300;
const nodeHeight = 140;

const getLayoutedElements = (nodes, edges) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 });

  // Keep standalone/floating pages out of Dagre. If they are included here and
  // moved afterward, Dagre leaves their reserved slots behind as blank gaps in
  // the connected page tree.
  const hierarchyEdges = edges.filter(e => e.type !== 'blockRoute');
  const connectedNodeIds = new Set(['root']);
  hierarchyEdges.forEach((edge) => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });

  const connectedNodes = nodes.filter(node => connectedNodeIds.has(node.id));
  const floatingNodes = nodes.filter(node => !connectedNodeIds.has(node.id));

  connectedNodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  hierarchyEdges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  let maxConnectedY = 0;
  const layoutedConnectedNodes = connectedNodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const yPos = nodeWithPosition ? nodeWithPosition.y - nodeHeight / 2 : 0;
    maxConnectedY = Math.max(maxConnectedY, yPos);

    return {
      ...node,
      targetPosition: 'top',
      sourcePosition: 'bottom',
      position: {
        x: nodeWithPosition ? nodeWithPosition.x - nodeWidth / 2 : 0,
        y: yPos,
      },
    };
  });

  const layoutedFloatingNodes = floatingNodes.map((node, index) => {
    const floatX = (index % 3) * (nodeWidth + 40);
    const floatY = maxConnectedY + 200 + Math.floor(index / 3) * (nodeHeight + 40);
    return {
      ...node,
      targetPosition: 'top',
      sourcePosition: 'bottom',
      position: { x: floatX, y: floatY }
    };
  });

  return { nodes: [...layoutedConnectedNodes, ...layoutedFloatingNodes], edges };
};

function FlowCanvas({ onEditNode, readOnly = false }) {
  const pages = useStore(state => state.pages);
  const blocksMap = useStore(state => state.blocks);
  const collapsedNodes = useStore(state => state.collapsedNodes || {});
  const reparentPage = useStore(state => state.reparentPage);
  const addPage = useStore(state => state.addPage);
  const addSiblingPage = useStore(state => state.addSiblingPage);
  const addDisconnectedPage = useStore(state => state.addDisconnectedPage);
  const deletePage = useStore(state => state.deletePage);
  const hasDependencies = useStore(state => state.hasDependencies);

  const { getIntersectingNodes, fitView, setCenter } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [dragTargetNodeId, setDragTargetNodeId] = useState(null);

  const isInitialMountRef = useRef(true);
  const newlyCreatedPageIdRef = useRef(null);
  
  const [pageToDelete, setPageToDelete] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);

  const handleRequestDelete = (pageId) => {
    if (hasDependencies(pageId)) {
      setPageToDelete(pageId);
    } else {
      deletePage(pageId);
      setSelectedNode(null);
    }
  };

  // Transform pages and blocks into nodes and edges
  useEffect(() => {
    const safePages = Array.isArray(pages) ? pages : [];

    // Compute depth level for every node (Root = Level 1)
    const nodeDepths = {};
    const computeDepth = (id, currentDepth) => {
      nodeDepths[id] = currentDepth;
      const children = safePages.filter(p => p.parentId === id);
      children.forEach(child => computeDepth(child.id, currentDepth + 1));
    };
    safePages.filter(p => p.parentId === null).forEach(r => computeDepth(r.id, 1));

    const getDescendants = (pageId) => {
      const children = safePages.filter(p => p.parentId === pageId);
      let ids = [];
      for (let c of children) {
        ids.push(c.id, ...getDescendants(c.id));
      }
      return ids;
    };

    const hiddenIds = new Set();
    Object.entries(collapsedNodes).forEach(([pageId, isCollapsed]) => {
      if (isCollapsed) {
        getDescendants(pageId).forEach(id => hiddenIds.add(id));
      }
    });

    const visiblePages = safePages.filter(p => !hiddenIds.has(p.id));
    const sortedPages = [...visiblePages].sort((a, b) => (a.order || 0) - (b.order || 0));
    const pageIdSet = new Set(visiblePages.map(p => p.id));

    const initialNodes = sortedPages.map((page) => {
      const childCount = safePages.filter(p => p.parentId === page.id).length;
      return {
        id: page.id,
        type: 'pageNode',
        data: {
          title: page.title,
          description: page.description,
          pageColor: page.pageColor || 'default',
          childCount,
          isDragTarget: page.id === dragTargetNodeId,
          readOnly,
          onEdit: onEditNode,
          onPageAdded: (newId) => {
            newlyCreatedPageIdRef.current = newId;
          }
        },
        position: { x: 0, y: 0 },
        draggable: !readOnly,
      };
    });

    // 1. Hierarchy Edges
    const hierarchyEdges = sortedPages
      .filter((page) => page.parentId !== null && pageIdSet.has(page.parentId))
      .map((page) => ({
        id: `e-hierarchy-${page.parentId}-${page.id}`,
        source: page.parentId,
        target: page.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--border-color)', strokeWidth: 2 }
      }));

    // 2. Block Routing Edges
    const blockEdges = [];
    Object.entries(blocksMap || {}).forEach(([sourcePageId, blocks]) => {
      if (!pageIdSet.has(sourcePageId) || !Array.isArray(blocks)) return;
      blocks.forEach((block) => {
        if (Array.isArray(block.routesTo)) {
          block.routesTo.forEach((targetPageId) => {
            if (pageIdSet.has(targetPageId) && targetPageId !== sourcePageId) {
              blockEdges.push({
                id: `e-block-${sourcePageId}-${targetPageId}-${block.id}`,
                source: sourcePageId,
                target: targetPageId,
                type: 'blockRoute',
                animated: false,
                style: { stroke: 'var(--primary-color)', strokeWidth: 2, strokeDasharray: '6, 6' },
                label: block.title ? `Block: ${block.title}` : 'Block Link',
                labelStyle: { fill: 'var(--primary-color)', fontSize: '0.6875rem', fontWeight: 500 },
                labelBgStyle: { fill: 'var(--bg-surface)', rx: 4, ry: 4 }
              });
            }
          });
        }
      });
    });

    const allEdges = [...hierarchyEdges, ...blockEdges];

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      initialNodes,
      allEdges
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    // Initial mount fits view once
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    } else if (newlyCreatedPageIdRef.current) {
      // Preserve zoom and center on newly created node!
      const targetNode = layoutedNodes.find(n => n.id === newlyCreatedPageIdRef.current);
      if (targetNode) {
        setTimeout(() => {
          setCenter(targetNode.position.x + nodeWidth / 2, targetNode.position.y + nodeHeight / 2, { duration: 400 });
          newlyCreatedPageIdRef.current = null;
        }, 50);
      }
    }
  }, [pages, blocksMap, collapsedNodes, dragTargetNodeId, readOnly, setNodes, setEdges, onEditNode, fitView, setCenter]);

  const onNodeDrag = useCallback(
    (event, node) => {
      if (readOnly) return;
      const intersections = getIntersectingNodes(node).filter(n => n.id !== node.id);
      if (intersections.length > 0) {
        setDragTargetNodeId(intersections[0].id);
      } else {
        setDragTargetNodeId(null);
      }
    },
    [getIntersectingNodes, readOnly]
  );

  const onNodeDragStop = useCallback(
    (event, node) => {
      if (readOnly) return;
      const intersections = getIntersectingNodes(node).filter(n => n.id !== node.id);
      
      if (intersections.length > 0) {
        const targetId = intersections[0].id;
        reparentPage(node.id, targetId);
      } else {
        if (node.id !== 'root') {
          reparentPage(node.id, null);
        }
      }
      setDragTargetNodeId(null);
    },
    [getIntersectingNodes, readOnly, reparentPage]
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      onSelectionChange={(params) => {
        setSelectedNode(params.nodes[0]?.id || null);
      }}
      fitView
      minZoom={0.4}
      maxZoom={1.2}
      className="site-planner-flow"
    >
      <Background color="var(--border-color)" gap={20} size={1} />
      <Controls showInteractive={false} />
      <MiniMap 
        nodeColor={() => 'var(--primary-color)'}
        maskColor="rgba(0,0,0,0.2)"
        style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-md)' }}
      />

      {!readOnly && <Panel position="top-right" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <button
          onClick={() => {
            const parentId = selectedNode || 'root';
            const newId = addPage(parentId);
            newlyCreatedPageIdRef.current = newId;
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px',
            backgroundColor: 'var(--primary-color)',
            color: 'var(--primary-text)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 500,
            fontSize: '0.875rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <Plus size={16} />
          Add Child
        </button>

        {selectedNode && selectedNode !== 'root' && (
          <button
            onClick={() => {
              const newId = addSiblingPage(selectedNode);
              if (newId) newlyCreatedPageIdRef.current = newId;
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
          >
            <PlusCircle size={16} />
            Add Sibling
          </button>
        )}

        <button
          onClick={addDisconnectedPage}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            fontWeight: 500,
            fontSize: '0.875rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
          }}
        >
          <Unlink size={16} />
          Add Floating
        </button>

        {selectedNode && selectedNode !== 'root' && (
          <button
            onClick={() => handleRequestDelete(selectedNode)}
            style={{
              padding: '8px 14px',
              backgroundColor: 'var(--danger-color)',
              color: 'white',
              borderRadius: 'var(--radius-md)',
              fontWeight: 500,
              fontSize: '0.875rem'
            }}
          >
            Delete Selected
          </button>
        )}
      </Panel>}

      <ConfirmModal
        isOpen={!!pageToDelete}
        onClose={() => setPageToDelete(null)}
        onConfirm={() => {
          if (pageToDelete) {
            deletePage(pageToDelete);
            setSelectedNode(null);
          }
        }}
        title="Delete Page?"
        isDanger={true}
        confirmText="Delete"
        message="This page has child pages, content blocks, or attachments. Deleting it will also permanently delete all associated items."
      />
    </ReactFlow>
  );
}

export default function FlowView({ onEditNode, readOnly = false }) {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlowProvider>
        <FlowCanvas onEditNode={onEditNode} readOnly={readOnly} />
      </ReactFlowProvider>
    </div>
  );
}

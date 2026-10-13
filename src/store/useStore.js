import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

const generateUniquePageTitle = (baseTitle = 'New Page', pages = []) => {
  const existingTitles = new Set(pages.map(p => p.title));
  if (!existingTitles.has(baseTitle)) {
    return baseTitle;
  }

  let counter = 1;
  while (existingTitles.has(`${baseTitle} ${counter}`)) {
    counter++;
  }
  return `${baseTitle} ${counter}`;
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const storedSitemapKey = (page) => {
  if (page.pageOrigin === 'manual') return null;
  return page.sitemapKey || (page.url ? page.url.replace(/\/$/, '') : null);
};

const planSnapshot = (state) => {
  const plan = (state.plans || []).find(item => item.id === state.activePlanId) || {};
  return {
    pages: clone(state.pages || []),
    blocks: clone(state.blocks || {}),
    attachments: clone(state.attachments || {}),
    sitemapSettings: clone(plan.sitemapSettings || null),
    sitemapSnapshot: clone(plan.sitemapSnapshot || []),
    lastSitemapRefresh: plan.lastSitemapRefresh || null
  };
};

const createDefaultPlanData = (name = 'Default Sitemap', isDemo = false) => {
  const rootId = 'root';
  const child1Id = uuidv4();
  const child2Id = uuidv4();
  const float1Id = uuidv4();
  const floatChild1Id = uuidv4();

  return {
    id: isDemo ? 'demo-plan' : uuidv4(),
    name: isDemo ? 'Demo Plan' : name,
    isDemo,
    updatedAt: Date.now(),
    pages: [
      { 
        id: rootId, 
        title: 'Homepage', 
        description: 'The main entry point.', 
        parentId: null, 
        order: 0,
        sectionTitle: '',
        sectionDescription: '',
        pageColor: 'default'
      },
      { 
        id: child1Id, 
        title: 'About Us', 
        description: 'Company overview and team details.', 
        parentId: rootId, 
        order: 0,
        sectionTitle: '',
        sectionDescription: '',
        pageColor: 'default'
      },
      { 
        id: child2Id, 
        title: 'Services', 
        description: 'Offered solutions and pricing.', 
        parentId: rootId, 
        order: 1,
        sectionTitle: '',
        sectionDescription: '',
        pageColor: 'default'
      },
      { 
        id: float1Id, 
        title: 'Landing Page', 
        description: 'Standalone marketing funnel.', 
        parentId: null, 
        order: 0,
        sectionTitle: 'Landing Page Section',
        sectionDescription: 'Independent promotional section.',
        pageColor: 'default'
      },
      { 
        id: floatChild1Id, 
        title: 'Promo Special', 
        description: 'Campaign offer details.', 
        parentId: float1Id, 
        order: 0,
        sectionTitle: '',
        sectionDescription: '',
        pageColor: 'default'
      }
    ],
    blocks: {
      [rootId]: [
        { id: uuidv4(), title: 'Hero Banner', description: 'Main CTA section', routesTo: [child1Id] }
      ]
    },
    attachments: {}
  };
};

export const useStore = create(
  persist(
    (set, get) => {
      const demoPlan = createDefaultPlanData('Demo Plan', true);
      const initialDefaultPlan = createDefaultPlanData('Default Sitemap', false);

      return {
        plans: [initialDefaultPlan, demoPlan],
        activePlanId: initialDefaultPlan.id,

        getActivePlan: () => {
          const state = get();
          return state.plans.find(p => p.id === state.activePlanId) || state.plans[0];
        },

        pages: initialDefaultPlan.pages,
        blocks: initialDefaultPlan.blocks,
        attachments: initialDefaultPlan.attachments,
        past: [],
        future: [],
        collapsedNodes: {},
        canEditShared: false,

        setSharedEditor: (canEditShared) => set({ canEditShared: Boolean(canEditShared) }),

        loadSharedPlan: (incomingPlan) => set((state) => {
          if (!incomingPlan || !Array.isArray(incomingPlan.pages)) return state;
          const sharedPlan = {
            ...incomingPlan,
            id: 'shared-public',
            name: incomingPlan.name || 'Shared Sitemap',
            isDemo: false,
            isShared: true,
            blocks: incomingPlan.blocks || {},
            attachments: incomingPlan.attachments || {},
          };
          const plans = [sharedPlan, ...(state.plans || []).filter(plan => plan.id !== sharedPlan.id)];
          return {
            plans,
            activePlanId: sharedPlan.id,
            pages: sharedPlan.pages,
            blocks: sharedPlan.blocks,
            attachments: sharedPlan.attachments,
            past: [],
            future: [],
            collapsedNodes: {},
          };
        }),

        _saveSnapshot: () => {
          const state = get();
          const activePlan = state.plans.find(plan => plan.id === state.activePlanId);
          if (activePlan?.isShared && !state.canEditShared) return;
          const snapshot = planSnapshot(state);
          const currentPast = Array.isArray(state.past) ? state.past : [];
          set({
            past: [...currentPast.slice(-20), snapshot],
            future: []
          });
        },

        undo: () => set((state) => {
          const activePlan = state.plans.find(plan => plan.id === state.activePlanId);
          if (activePlan?.isShared && !state.canEditShared) return state;
          const pastStack = Array.isArray(state.past) ? state.past : [];
          if (pastStack.length === 0) return state;
          const newPast = [...pastStack];
          const previous = newPast.pop();
          if (!previous) return state;

          const currentSnapshot = planSnapshot(state);

          const activeId = state.activePlanId;
          const newPlans = (state.plans || []).map(plan => {
            if (plan.id === activeId) {
              return {
                ...plan,
                pages: previous.pages || [],
                blocks: previous.blocks || {},
                attachments: previous.attachments || {},
                sitemapSettings: previous.sitemapSettings,
                sitemapSnapshot: previous.sitemapSnapshot || [],
                lastSitemapRefresh: previous.lastSitemapRefresh,
                updatedAt: Date.now()
              };
            }
            return plan;
          });

          return {
            plans: newPlans,
            pages: previous.pages || [],
            blocks: previous.blocks || {},
            attachments: previous.attachments || {},
            past: newPast,
            future: [currentSnapshot, ...(Array.isArray(state.future) ? state.future : [])]
          };
        }),

        redo: () => set((state) => {
          const activePlan = state.plans.find(plan => plan.id === state.activePlanId);
          if (activePlan?.isShared && !state.canEditShared) return state;
          const futureStack = Array.isArray(state.future) ? state.future : [];
          if (futureStack.length === 0) return state;
          const newFuture = [...futureStack];
          const next = newFuture.shift();
          if (!next) return state;

          const currentSnapshot = planSnapshot(state);

          const activeId = state.activePlanId;
          const newPlans = (state.plans || []).map(plan => {
            if (plan.id === activeId) {
              return {
                ...plan,
                pages: next.pages || [],
                blocks: next.blocks || {},
                attachments: next.attachments || {},
                sitemapSettings: next.sitemapSettings,
                sitemapSnapshot: next.sitemapSnapshot || [],
                lastSitemapRefresh: next.lastSitemapRefresh,
                updatedAt: Date.now()
              };
            }
            return plan;
          });

          return {
            plans: newPlans,
            pages: next.pages || [],
            blocks: next.blocks || {},
            attachments: next.attachments || {},
            past: [...(Array.isArray(state.past) ? state.past : []), currentSnapshot],
            future: newFuture
          };
        }),

        toggleCollapseNode: (id) => set((state) => ({
          collapsedNodes: {
            ...state.collapsedNodes,
            [id]: !state.collapsedNodes[id]
          }
        })),

        _updateActivePlan: (updater) => set((state) => {
          const activeId = state.activePlanId;
          const activePlan = state.plans.find(plan => plan.id === activeId);
          if (activePlan?.isShared && !state.canEditShared) return state;
          const newPlans = state.plans.map(plan => {
            if (plan.id === activeId) {
              const updatedFields = typeof updater === 'function' ? updater(plan) : updater;
              return { ...plan, ...updatedFields, updatedAt: Date.now() };
            }
            return plan;
          });
          const currentPlan = newPlans.find(p => p.id === activeId) || newPlans[0];
          return {
            plans: newPlans,
            pages: currentPlan.pages || [],
            blocks: currentPlan.blocks || {},
            attachments: currentPlan.attachments || {}
          };
        }),

        // --- MULTI-PLAN MANAGEMENT ---
        createPlan: (name = 'New Plan') => set((state) => {
          const newPlan = createDefaultPlanData(name, false);
          return {
            plans: [...state.plans, newPlan],
            activePlanId: newPlan.id,
            pages: newPlan.pages,
            blocks: newPlan.blocks,
            attachments: newPlan.attachments
          };
        }),

        createPlanFromSitemap: ({ name, sourceUrl, domain, pages: pageDrafts, sitemapSettings }) => set((state) => {
          const idByKey = new Map();
          pageDrafts.forEach((page, index) => {
            idByKey.set(page.key, index === 0 ? 'root' : uuidv4());
          });
          const siblingOrders = new Map();
          const pages = pageDrafts.map((page) => {
            const parentId = page.parentKey ? (idByKey.get(page.parentKey) || 'root') : null;
            const order = siblingOrders.get(parentId) || 0;
            siblingOrders.set(parentId, order + 1);
            return {
              id: idByKey.get(page.key),
              title: page.title,
              description: page.description || '',
              url: page.url || '',
              sitemapKey: page.key,
              pageOrigin: page.isPlaceholder ? 'placeholder' : 'sitemap',
              isPlaceholder: Boolean(page.isPlaceholder),
              parentId,
              order,
              sectionTitle: '',
              sectionDescription: '',
              pageColor: 'default'
            };
          });
          const newPlan = {
            id: uuidv4(),
            name: name || 'Imported Sitemap',
            isDemo: false,
            sourceUrl: sourceUrl || '',
            domain: domain || '',
            sitemapSettings: sitemapSettings || null,
            sitemapSnapshot: pageDrafts.map(page => ({ key: page.key, parentKey: page.parentKey || null })),
            lastSitemapRefresh: Date.now(),
            updatedAt: Date.now(),
            pages,
            blocks: {},
            attachments: {}
          };
          return {
            plans: [...state.plans, newPlan],
            activePlanId: newPlan.id,
            pages,
            blocks: {},
            attachments: {},
            past: [],
            future: []
          };
        }),

        refreshPlanFromSitemap: ({ pages: pageDrafts, sitemapSettings, sitemapAllKeys = [], applyMode = 'match' }) => {
          const state = get();
          state._saveSnapshot();
          state._updateActivePlan((plan) => {
            const currentPages = plan.pages || [];
            const existingByKey = new Map(
              currentPages.map(page => [storedSitemapKey(page), page]).filter(([key]) => key)
            );
            const availableSitemapKeys = new Set(sitemapAllKeys);
            const idByKey = new Map();
            pageDrafts.forEach((draft, index) => {
              const existing = existingByKey.get(draft.key);
              idByKey.set(draft.key, existing?.id || (index === 0 ? 'root' : uuidv4()));
            });

            const untouchedPages = currentPages.filter(page => !storedSitemapKey(page));
            const missingPages = currentPages.filter(page => {
              const key = storedSitemapKey(page);
              return key && !page.isPlaceholder && !availableSitemapKeys.has(key);
            });
            const addedPages = [];
            const siblingOrders = new Map();

            pageDrafts.forEach(draft => {
              if (existingByKey.has(draft.key)) return;
              const parentId = applyMode === 'orphans'
                ? null
                : (draft.parentKey ? (idByKey.get(draft.parentKey) || 'root') : null);
              const order = siblingOrders.get(parentId) || 0;
              siblingOrders.set(parentId, order + 1);
              addedPages.push({
                id: idByKey.get(draft.key),
                title: draft.title,
                description: draft.description || '',
                url: draft.url || '',
                sitemapKey: draft.key,
                pageOrigin: draft.isPlaceholder ? 'placeholder' : 'sitemap',
                isPlaceholder: Boolean(draft.isPlaceholder),
                parentId,
                order,
                sectionTitle: '',
                sectionDescription: '',
                pageColor: 'default'
              });
            });

            let pages;
            if (applyMode === 'orphans') {
              pages = [...currentPages, ...addedPages];
            } else {
              const refreshedExisting = pageDrafts
                .filter(draft => existingByKey.has(draft.key))
                .map(draft => {
                  const existing = existingByKey.get(draft.key);
                  const parentId = draft.parentKey ? (idByKey.get(draft.parentKey) || 'root') : null;
                  const order = siblingOrders.get(parentId) || 0;
                  siblingOrders.set(parentId, order + 1);
                  return {
                    ...existing,
                    ...(existing.isPlaceholder && !draft.isPlaceholder
                      ? { title: draft.title, pageOrigin: 'sitemap', isPlaceholder: false }
                      : {}),
                    parentId,
                    order
                  };
                });
              // Pages no longer listed are preserved as orphans so work is never lost.
              pages = [
                ...refreshedExisting,
                ...addedPages,
                ...missingPages.map(page => ({ ...page, parentId: null })),
                ...untouchedPages
              ];
            }

            return {
              pages,
              sitemapSettings,
              sitemapSnapshot: pageDrafts.map(page => ({ key: page.key, parentKey: page.parentKey || null })),
              lastSitemapRefresh: Date.now()
            };
          });
        },

        switchPlan: (planId) => set((state) => {
          // If switching to demo plan, reset demo plan to fresh state so it's unsaved/transient
          let currentPlans = state.plans;
          if (planId === 'demo-plan') {
            const freshDemo = createDefaultPlanData('Demo Plan', true);
            currentPlans = currentPlans.map(p => p.id === 'demo-plan' ? freshDemo : p);
          }

          const targetPlan = currentPlans.find(p => p.id === planId) || currentPlans[0];
          return {
            plans: currentPlans,
            activePlanId: targetPlan.id,
            pages: targetPlan.pages || [],
            blocks: targetPlan.blocks || {},
            attachments: targetPlan.attachments || {}
          };
        }),

        renamePlan: (planId, newName) => set((state) => {
          const target = state.plans.find(p => p.id === planId);
          if (target && target.isDemo) return state; // Don't rename demo plan
          if (target?.isShared && !state.canEditShared) return state;
          return {
            plans: state.plans.map(p => p.id === planId ? { ...p, name: newName.trim() || p.name } : p)
          };
        }),

        deletePlan: (planId) => set((state) => {
          const target = state.plans.find(p => p.id === planId);
          if (target && target.isDemo) return state; // Don't delete demo plan
          if (target?.isShared && !state.canEditShared) return state;
          if (state.plans.length <= 1) return state;

          const newPlans = state.plans.filter(p => p.id !== planId);
          const nextActive = newPlans[0];
          return {
            plans: newPlans,
            activePlanId: nextActive.id,
            pages: nextActive.pages || [],
            blocks: nextActive.blocks || {},
            attachments: nextActive.attachments || {}
          };
        }),

        // --- PAGE ACTIONS ---
        addPage: (parentId = 'root') => {
          const state = get();
          state._saveSnapshot();
          const title = generateUniquePageTitle('New Page', state.pages);
          const siblings = (state.pages || []).filter(p => p.parentId === parentId);
          const maxOrder = siblings.reduce((max, p) => Math.max(max, p.order || 0), -1);

          const newPageId = uuidv4();
          state._updateActivePlan((plan) => ({
              pages: [...(plan.pages || []), {
              id: newPageId, 
              title, 
              description: '', 
              parentId, 
              order: maxOrder + 1,
              sectionTitle: '',
              sectionDescription: '',
              pageOrigin: 'manual',
              pageColor: 'default'
            }]
          }));
          return newPageId;
        },

        addSiblingPage: (targetPageId) => {
          const state = get();
          const targetPage = (state.pages || []).find(p => p.id === targetPageId);
          if (!targetPage || targetPage.id === 'root') return null;

          state._saveSnapshot();
          const parentId = targetPage.parentId;
          const title = generateUniquePageTitle('New Page', state.pages);
          const targetOrder = targetPage.order || 0;
          const newOrder = targetOrder + 1;

          const newPageId = uuidv4();
          state._updateActivePlan((plan) => ({
            pages: [
              ...(plan.pages || []).map(p => {
                if (p.parentId === parentId && (p.order || 0) > targetOrder) {
                  return { ...p, order: (p.order || 0) + 1 };
                }
                return p;
              }),
              {
                id: newPageId,
                title,
                description: '',
                parentId,
                order: newOrder,
                sectionTitle: '',
                sectionDescription: '',
                pageOrigin: 'manual',
                pageColor: 'default'
              }
            ]
          }));
          return newPageId;
        },

        addDisconnectedPage: () => {
          const state = get();
          state._saveSnapshot();
          const title = generateUniquePageTitle('Floating Page', state.pages);
          const floatingPages = (state.pages || []).filter(p => p.parentId === null && p.id !== 'root');
          const maxOrder = floatingPages.reduce((max, p) => Math.max(max, p.order || 0), -1);

          const newPageId = uuidv4();
          state._updateActivePlan((plan) => ({
            pages: [...(plan.pages || []), {
              id: newPageId,
              title,
              description: 'Standalone page.',
              parentId: null,
              order: maxOrder + 1,
              sectionTitle: title + ' Section',
              sectionDescription: 'Independent group.',
              pageOrigin: 'manual',
              pageColor: 'default'
            }]
          }));
          return newPageId;
        },
        
        updatePage: (id, updates) => {
          get()._updateActivePlan((plan) => ({
            pages: (plan.pages || []).map(p => p.id === id ? { ...p, ...updates } : p)
          }));
        },

        setPageColor: (id, pageColor) => {
          const allowedColors = new Set(['default', 'blue', 'yellow', 'pink']);
          const state = get();
          const page = (state.pages || []).find(item => item.id === id);
          const nextColor = allowedColors.has(pageColor) ? pageColor : 'default';
          if (!page || (page.pageColor || 'default') === nextColor) return;
          state._saveSnapshot();
          state._updateActivePlan((plan) => ({
            pages: (plan.pages || []).map(item => item.id === id ? { ...item, pageColor: nextColor } : item)
          }));
        },

        hasDependencies: (pageId) => {
          const state = get();
          const children = (state.pages || []).filter(p => p.parentId === pageId);
          const blocks = (state.blocks && state.blocks[pageId]) || [];
          const attachments = (state.attachments && state.attachments[pageId]) || [];
          return children.length > 0 || blocks.length > 0 || attachments.length > 0;
        },
        
        deletePage: (id) => {
          const state = get();
          if (id === 'root') return;
          state._saveSnapshot();

          const getAllChildrenIds = (pageId, allPages) => {
            const children = (allPages || []).filter(p => p.parentId === pageId);
            let ids = children.map(c => c.id);
            for (let child of children) {
              ids = [...ids, ...getAllChildrenIds(child.id, allPages)];
            }
            return ids;
          };
          const toDeleteIds = [id, ...getAllChildrenIds(id, state.pages)];
          
          state._updateActivePlan((plan) => {
            const newBlocks = { ...(plan.blocks || {}) };
            const newAttachments = { ...(plan.attachments || {}) };
            toDeleteIds.forEach(deletedId => {
              delete newBlocks[deletedId];
              delete newAttachments[deletedId];
            });

            return {
              pages: (plan.pages || []).filter(p => !toDeleteIds.includes(p.id)),
              blocks: newBlocks,
              attachments: newAttachments
            };
          });
        },

        reparentPage: (id, newParentId) => {
          const state = get();
          if (id === 'root' || id === newParentId) return;
          state._saveSnapshot();
          
          if (newParentId !== null) {
            const getAllChildrenIds = (pageId, allPages) => {
              const children = (allPages || []).filter(p => p.parentId === pageId);
              let ids = children.map(c => c.id);
              for (let child of children) {
                ids = [...ids, ...getAllChildrenIds(child.id, allPages)];
              }
              return ids;
            };
            const invalidParents = [id, ...getAllChildrenIds(id, state.pages)];
            if (invalidParents.includes(newParentId)) return;
          }

          const newSiblings = (state.pages || []).filter(p => p.parentId === newParentId && p.id !== id);
          const nextOrder = newSiblings.length;

          state._updateActivePlan((plan) => ({
            pages: (plan.pages || []).map(p => p.id === id ? { ...p, parentId: newParentId, order: nextOrder } : p)
          }));
        },

        reorderPage: (draggedId, targetId, position = 'child') => {
          const state = get();
          if (draggedId === 'root' || draggedId === targetId) return;
          state._saveSnapshot();
          
          const pages = state.pages || [];
          const draggedPage = pages.find(p => p.id === draggedId);
          const targetPage = pages.find(p => p.id === targetId);
          if (!draggedPage || !targetPage) return;

          if (position === 'child') {
            return get().reparentPage(draggedId, targetId);
          }

          const targetParentId = targetPage.parentId;
          
          if (targetParentId !== null) {
            const getAllChildrenIds = (pageId, allPages) => {
              const children = (allPages || []).filter(p => p.parentId === pageId);
              let ids = children.map(c => c.id);
              for (let child of children) {
                ids = [...ids, ...getAllChildrenIds(child.id, allPages)];
              }
              return ids;
            };
            if ([draggedId, ...getAllChildrenIds(draggedId, pages)].includes(targetParentId)) {
              return;
            }
          }

          const siblings = pages
            .filter(p => p.parentId === targetParentId && p.id !== draggedId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

          const targetIndex = siblings.findIndex(p => p.id === targetId);
          const insertIndex = position === 'before' ? Math.max(0, targetIndex) : targetIndex + 1;

          siblings.splice(insertIndex, 0, { ...draggedPage, parentId: targetParentId });

          const updatedOrdersMap = new Map();
          siblings.forEach((page, index) => {
            updatedOrdersMap.set(page.id, index);
          });

          state._updateActivePlan((plan) => ({
            pages: (plan.pages || []).map(p => {
              if (updatedOrdersMap.has(p.id)) {
                return { ...p, parentId: targetParentId, order: updatedOrdersMap.get(p.id) };
              }
              return p;
            })
          }));
        },

        // --- BLOCK ACTIONS ---
        addBlock: (pageId) => {
          get()._updateActivePlan((plan) => ({
            blocks: {
              ...(plan.blocks || {}),
              [pageId]: [
                ...((plan.blocks && plan.blocks[pageId]) || []),
                { id: uuidv4(), title: 'New Block', description: '', routesTo: [] }
              ]
            }
          }));
        },

        updateBlock: (pageId, blockId, updates) => {
          get()._updateActivePlan((plan) => ({
            blocks: {
              ...(plan.blocks || {}),
              [pageId]: ((plan.blocks && plan.blocks[pageId]) || []).map(b => 
                b.id === blockId ? { ...b, ...updates } : b
              )
            }
          }));
        },

        deleteBlock: (pageId, blockId) => {
          get()._updateActivePlan((plan) => ({
            blocks: {
              ...(plan.blocks || {}),
              [pageId]: ((plan.blocks && plan.blocks[pageId]) || []).filter(b => b.id !== blockId)
            }
          }));
        },

        // --- ATTACHMENT ACTIONS ---
        addAttachment: (pageId, attachment) => {
          get()._updateActivePlan((plan) => ({
            attachments: {
              ...(plan.attachments || {}),
              [pageId]: [
                ...((plan.attachments && plan.attachments[pageId]) || []),
                { id: uuidv4(), ...attachment }
              ]
            }
          }));
        },

        deleteAttachment: (pageId, attachmentId) => {
          get()._updateActivePlan((plan) => ({
            attachments: {
              ...(plan.attachments || {}),
              [pageId]: ((plan.attachments && plan.attachments[pageId]) || []).filter(a => a.id !== attachmentId)
            }
          }));
        },

        // --- IMPORT/EXPORT ---
        exportData: () => {
          const state = get();
          const activePlan = state.plans.find(p => p.id === state.activePlanId) || state.plans[0];
          const data = {
            plans: state.plans,
            activePlanId: state.activePlanId,
            pages: activePlan.pages,
            blocks: activePlan.blocks,
            attachments: activePlan.attachments
          };
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href",     dataStr);
          downloadAnchorNode.setAttribute("download", `${(activePlan.name || 'sitemap').toLowerCase().replace(/\s+/g, '-')}-backup.json`);
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
        },

        importData: (jsonData) => set((state) => {
          try {
            const parsed = JSON.parse(jsonData);
            if (parsed.plans && Array.isArray(parsed.plans)) {
              const activePlan = parsed.plans.find(p => p.id === parsed.activePlanId) || parsed.plans[0];
              return {
                plans: parsed.plans,
                activePlanId: activePlan.id,
                pages: activePlan.pages || [],
                blocks: activePlan.blocks || {},
                attachments: activePlan.attachments || {}
              };
            } else if (parsed.pages) {
              const importedPlan = {
                id: uuidv4(),
                name: 'Imported Plan',
                isDemo: false,
                updatedAt: Date.now(),
                pages: parsed.pages || [],
                blocks: parsed.blocks || {},
                attachments: parsed.attachments || {}
              };
              return {
                plans: [...state.plans, importedPlan],
                activePlanId: importedPlan.id,
                pages: importedPlan.pages,
                blocks: importedPlan.blocks,
                attachments: importedPlan.attachments
              };
            }
          } catch (e) {
            console.error("Failed to import data", e);
          }
          return state;
        })
      };
    },
    {
      name: 'site-planner-storage-v4',
      partialize: (state) => ({
        plans: (state.plans || []).map(plan => {
          if (plan.isDemo) {
            return createDefaultPlanData('Demo Plan', true);
          }
          return plan;
        }),
        activePlanId: state.activePlanId,
        pages: state.pages,
        blocks: state.blocks,
        attachments: state.attachments
      }),
      onRehydrateStorage: () => (state) => {
        if (!state || !Array.isArray(state.plans) || state.plans.length === 0) {
          const freshDemo = createDefaultPlanData('Demo Plan', true);
          const freshDefault = createDefaultPlanData('Default Sitemap', false);
          useStore.setState({
            plans: [freshDefault, freshDemo],
            activePlanId: freshDefault.id,
            pages: freshDefault.pages,
            blocks: freshDefault.blocks,
            attachments: freshDefault.attachments,
            past: [],
            future: [],
            collapsedNodes: {}
          });
          return;
        }

        // Remove the short-lived, hardcoded Chase Oaks starter plan from earlier builds.
        const plans = state.plans.filter(plan => plan.id !== 'chase-oaks-sitemap-v1');
        const currentPlan = plans.find(p => p.id === state.activePlanId) || plans[0];
        if (currentPlan) {
          useStore.setState({
            plans,
            activePlanId: currentPlan.id,
            pages: currentPlan.pages || [],
            blocks: currentPlan.blocks || {},
            attachments: currentPlan.attachments || {},
            past: [],
            future: [],
            collapsedNodes: {}
          });
        }
      }
    }
  )
);

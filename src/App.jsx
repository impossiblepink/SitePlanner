import { useState, useEffect, useRef } from 'react';
import { Download, Upload, LayoutTemplate, ListTree, FolderKanban, Plus, AlertTriangle, HelpCircle, Undo2, Redo2, ChevronDown, FilePlus2, Network, RefreshCw } from 'lucide-react';
import FlowView from './components/FlowView/FlowView';
import ListView from './components/ListView/ListView';
import PageDetails from './components/PageDetails/PageDetails';
import ConfirmModal from './components/ConfirmModal/ConfirmModal';
import PlanSelectorModal from './components/PlanSelectorModal/PlanSelectorModal';
import WelcomeModal from './components/WelcomeModal/WelcomeModal';
import TutorialModal from './components/TutorialModal/TutorialModal';
import SitemapImportModal from './components/SitemapImportModal/SitemapImportModal';
import SitemapRefreshModal from './components/SitemapRefreshModal/SitemapRefreshModal';
import SharedPlanBar, { SharedPlanStatus } from './components/SharedPlanBar/SharedPlanBar';
import { useStore } from './store/useStore';
import { isSharedStorageConfigured, supabase } from './lib/supabase';
import { fetchSharedPlan, publishSharedPlan } from './utils/sharedPlan';

function App() {
  const [view, setView] = useState('flow'); // 'flow' | 'list'
  const [editingPageId, setEditingPageId] = useState(null);
  
  const [isRenamingPlan, setIsRenamingPlan] = useState(false);
  const [planNameInput, setPlanNameInput] = useState('');
  
  const [planToDelete, setPlanToDelete] = useState(null);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);

  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);
  const [isNewPlanMenuOpen, setIsNewPlanMenuOpen] = useState(false);
  const [isSitemapImportOpen, setIsSitemapImportOpen] = useState(false);
  const [isSitemapRefreshOpen, setIsSitemapRefreshOpen] = useState(false);
  const newPlanMenuRef = useRef(null);
  const [sharedStatus, setSharedStatus] = useState(isSharedStorageConfigured ? 'loading' : 'disabled');
  const [sharedUpdatedAt, setSharedUpdatedAt] = useState(null);
  const [sharedOwnerId, setSharedOwnerId] = useState(null);
  const [sharedUser, setSharedUser] = useState(null);
  const [isPublishingShared, setIsPublishingShared] = useState(false);

  const plans = useStore(state => state.plans || []);
  const activePlanId = useStore(state => state.activePlanId);
  const createPlan = useStore(state => state.createPlan);
  const createPlanFromSitemap = useStore(state => state.createPlanFromSitemap);
  const refreshPlanFromSitemap = useStore(state => state.refreshPlanFromSitemap);
  const switchPlan = useStore(state => state.switchPlan);
  const deletePlan = useStore(state => state.deletePlan);

  const undo = useStore(state => state.undo);
  const redo = useStore(state => state.redo);
  const past = useStore(state => state.past || []);
  const future = useStore(state => state.future || []);

  const exportData = useStore(state => state.exportData);
  const importData = useStore(state => state.importData);
  const loadSharedPlan = useStore(state => state.loadSharedPlan);
  const setSharedEditor = useStore(state => state.setSharedEditor);
  const canEditShared = useStore(state => state.canEditShared);
  const fileInputRef = useRef(null);

  const activePlan = plans.find(p => p.id === activePlanId) || plans[0] || {};
  const isSharedReadOnly = Boolean(activePlan.isShared && !canEditShared);

  useEffect(() => {
    if (!supabase) return undefined;
    let cancelled = false;

    const initializeSharedPlan = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        const user = data.session?.user || null;
        setSharedUser(user);
      }
      try {
        const result = await fetchSharedPlan();
        if (cancelled) return;
        if (result.plan) {
          loadSharedPlan(result.plan);
          setSharedOwnerId(result.ownerId);
          setSharedUpdatedAt(result.updatedAt);
          setSharedStatus('ready');
        } else {
          setSharedStatus('empty');
        }
      } catch (error) {
        console.error('Failed to load shared sitemap', error);
        if (!cancelled) setSharedStatus('error');
      }
    };

    initializeSharedPlan();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user || null;
      setSharedUser(user);
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [loadSharedPlan]);

  useEffect(() => {
    const canEdit = Boolean(sharedUser && (sharedStatus === 'empty' || sharedUser.id === sharedOwnerId));
    setSharedEditor(canEdit);
  }, [setSharedEditor, sharedOwnerId, sharedStatus, sharedUser]);

  const handlePublishShared = async () => {
    if (!sharedUser || !canEditShared || !activePlan?.pages) return;
    setIsPublishingShared(true);
    try {
      const sharedPlan = await publishSharedPlan(activePlan, sharedUser.id);
      loadSharedPlan(sharedPlan);
      setSharedOwnerId(sharedUser.id);
      setSharedUpdatedAt(new Date().toISOString());
      setSharedStatus('ready');
    } catch (error) {
      console.error('Failed to publish shared sitemap', error);
      window.alert(`The shared sitemap could not be published. ${error.message || ''}`);
    } finally {
      setIsPublishingShared(false);
    }
  };

  useEffect(() => {
    const closeMenu = (event) => {
      if (newPlanMenuRef.current && !newPlanMenuRef.current.contains(event.target)) {
        setIsNewPlanMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', closeMenu);
    return () => document.removeEventListener('mousedown', closeMenu);
  }, []);

  // Auto-show Welcome modal if only demo plan exists or on first launch
  useEffect(() => {
    const nonDemoPlans = plans.filter(p => !p.isDemo);
    const hasSeenWelcome = localStorage.getItem('site_planner_welcomed');
    
    if (sharedStatus === 'loading') return;
    if (sharedStatus !== 'ready' && (nonDemoPlans.length === 0 || (!hasSeenWelcome && nonDemoPlans.length <= 1))) {
      setIsWelcomeModalOpen(true);
    }
  }, [plans, sharedStatus]);

  const handleCloseWelcome = () => {
    localStorage.setItem('site_planner_welcomed', 'true');
    setIsWelcomeModalOpen(false);
  };

  // Keyboard shortcut listener for Cmd+Z / Cmd+Shift+Z (Undo/Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const openEditDetails = (pageId) => {
    if (isSharedReadOnly) return;
    setEditingPageId(pageId);
    window.history.pushState({ editingPageId: pageId }, '');
  };

  const closeEditDetails = () => {
    setEditingPageId(null);
  };

  useEffect(() => {
    const handlePopState = () => {
      if (editingPageId) {
        setEditingPageId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [editingPageId]);

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        importData(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const handleStartRename = () => {
    if (activePlan.isDemo) return;
    setPlanNameInput(activePlan.name || '');
    setIsRenamingPlan(true);
  };

  const handleSaveRename = () => {
    if (planNameInput.trim()) {
      renamePlan(activePlanId, planNameInput.trim());
    }
    setIsRenamingPlan(false);
  };

  return (
    <>
      <div className="app-container no-print" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Navbar */}
      <nav style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        padding: '10px 24px',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-color)',
        zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        {/* Left Section: Logo & Plan Manager */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--primary-color)', letterSpacing: '-0.02em' }}>
            Site Planner
          </h1>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>
          {/* Multi-Plan Selector Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={() => setIsPlanModalOpen(true)}
              style={{ color: 'var(--text-secondary)', display: 'flex', padding: '4px' }}
              title="Open Saved Plans Manager"
            >
              <FolderKanban size={18} />
            </button>
            
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', padding: '5px 4px' }}>
              {activePlan.name} {activePlan.isDemo ? '(Demo)' : ''}
            </span>

            {activePlan.sourceUrl && !activePlan.isDemo && !isSharedReadOnly && (
              <button
                onClick={() => setIsSitemapRefreshOpen(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px',
                  color: 'var(--primary-color)', border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)', fontSize: '0.78rem', fontWeight: 600
                }}
                title="Check the source sitemap for changes"
              >
                <RefreshCw size={14} /> Refresh Sitemap
              </button>
            )}

            {!isSharedReadOnly && <div ref={newPlanMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setIsNewPlanMenuOpen(open => !open)}
                aria-haspopup="menu"
                aria-expanded={isNewPlanMenuOpen}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  padding: '5px 9px',
                  backgroundColor: 'var(--bg-color)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.8125rem',
                  fontWeight: 500
                }}
                title="Create New Plan"
              >
                <Plus size={14} /> New Plan <ChevronDown size={13} />
              </button>

              {isNewPlanMenuOpen && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute', top: 'calc(100% + 7px)', left: 0, width: '230px',
                    padding: '6px', zIndex: 50, backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.22)'
                  }}
                >
                  <button
                    role="menuitem"
                    onClick={() => {
                      createPlan(`Plan ${plans.length + 1}`);
                      setIsNewPlanMenuOpen(false);
                    }}
                    style={{
                      display: 'flex', width: '100%', gap: '10px', padding: '10px',
                      textAlign: 'left', borderRadius: '6px', color: 'var(--text-primary)'
                    }}
                  >
                    <FilePlus2 size={18} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                    <span>
                      <strong style={{ display: 'block', fontSize: '0.82rem' }}>Build from Scratch</strong>
                      <small style={{ color: 'var(--text-secondary)' }}>Start with the default page structure</small>
                    </span>
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setIsNewPlanMenuOpen(false);
                      setIsSitemapImportOpen(true);
                    }}
                    style={{
                      display: 'flex', width: '100%', gap: '10px', padding: '10px',
                      textAlign: 'left', borderRadius: '6px', color: 'var(--text-primary)'
                    }}
                  >
                    <Network size={18} style={{ color: 'var(--primary-color)', flexShrink: 0 }} />
                    <span>
                      <strong style={{ display: 'block', fontSize: '0.82rem' }}>Build from Sitemap</strong>
                      <small style={{ color: 'var(--text-secondary)' }}>Generate a tree from sitemap XML</small>
                    </span>
                  </button>
                </div>
              )}
            </div>}
          </div>

          {/* Warning Banner for Unsaved Demo Plan */}
          {activePlan.isDemo && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              padding: '4px 10px',
              backgroundColor: 'rgba(234, 179, 8, 0.15)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              borderRadius: 'var(--radius-md)',
              color: '#eab308',
              fontSize: '0.75rem',
              fontWeight: 500
            }}>
              <AlertTriangle size={14} />
              <span>Demo Mode: Changes will not be saved</span>
            </div>
          )}
        </div>

        {/* Center: View Switcher */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-color)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button 
            onClick={() => setView('flow')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: view === 'flow' ? 'var(--bg-surface)' : 'transparent',
              color: view === 'flow' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: view === 'flow' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <LayoutTemplate size={18} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Flow View</span>
          </button>
          <button 
            onClick={() => setView('list')}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: view === 'list' ? 'var(--bg-surface)' : 'transparent',
              color: view === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)',
              boxShadow: view === 'list' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            <ListTree size={18} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>List View</span>
          </button>
        </div>

        {/* Right Section: Import / Export & Theme */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            accept=".json" 
            style={{ display: 'none' }} 
          />
            {!isSharedReadOnly && <button
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}
          >
            <Upload size={18} />
            <span style={{ fontSize: '0.875rem' }}>Import</span>
          </button>}
          <button 
            onClick={exportData}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}
          >
            <Download size={18} />
            <span style={{ fontSize: '0.875rem' }}>Export</span>
          </button>
          
          {/* Undo / Redo Buttons */}
          {!isSharedReadOnly && <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              onClick={undo}
              disabled={past.length === 0}
              style={{
                padding: '6px',
                color: past.length > 0 ? 'var(--text-primary)' : 'var(--border-color)',
                cursor: past.length > 0 ? 'pointer' : 'default',
                borderRadius: 'var(--radius-md)'
              }}
              title="Undo (Cmd+Z / Ctrl+Z)"
            >
              <Undo2 size={18} />
            </button>
            <button
              onClick={redo}
              disabled={future.length === 0}
              style={{
                padding: '6px',
                color: future.length > 0 ? 'var(--text-primary)' : 'var(--border-color)',
                cursor: future.length > 0 ? 'pointer' : 'default',
                borderRadius: 'var(--radius-md)'
              }}
              title="Redo (Cmd+Shift+Z / Ctrl+Y)"
            >
              <Redo2 size={18} />
            </button>
          </div>}

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>
          
          <button onClick={() => setIsTutorialModalOpen(true)} style={{ color: 'var(--text-secondary)' }} title="Open Feature Tutorial">
            <HelpCircle size={20} />
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)' }}></div>

          <SharedPlanBar
            configured={isSharedStorageConfigured}
            user={sharedUser}
            canEdit={canEditShared}
            onPublish={handlePublishShared}
            publishing={isPublishingShared}
          />

        </div>
        </div>
        <SharedPlanStatus
          configured={isSharedStorageConfigured}
          canEdit={canEditShared}
          status={sharedStatus}
          updatedAt={sharedUpdatedAt}
        />
      </nav>

      {/* Main Content Area */}
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {view === 'flow' ? (
          <FlowView onEditNode={openEditDetails} readOnly={isSharedReadOnly} />
        ) : (
          <div style={{ padding: '0 24px', height: '100%', overflowY: 'auto', backgroundColor: 'var(--bg-color)' }}>
            <ListView onEditNode={openEditDetails} readOnly={isSharedReadOnly} />
          </div>
        )}

        {/* Page Details Overlay */}
        {editingPageId && (
          <>
            {/* Backdrop */}
            <div 
              style={{
                position: 'absolute', inset: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                zIndex: 90,
                backdropFilter: 'blur(2px)'
              }}
              onClick={closeEditDetails}
            />
            <PageDetails 
              pageId={editingPageId} 
              onClose={closeEditDetails} 
            />
          </>
        )}

        <ConfirmModal
          isOpen={!!planToDelete}
          onClose={() => setPlanToDelete(null)}
          onConfirm={() => {
            if (planToDelete) deletePlan(planToDelete);
          }}
          title="Delete Plan?"
          isDanger={true}
          confirmText="Delete Plan"
          message="Are you sure you want to delete this plan? This action is permanent and cannot be undone."
        >
          <div style={{ marginTop: '12px' }}>
            We strongly recommend downloading a backup first. <br/>
            <button 
              onClick={(e) => {
                e.preventDefault();
                exportData();
              }} 
              style={{ 
                color: 'var(--primary-color)', 
                background: 'none', 
                border: 'none', 
                padding: 0, 
                textDecoration: 'underline', 
                cursor: 'pointer',
                fontSize: '0.9375rem'
              }}
            >
              Click here to download your data as a JSON file.
            </button>
          </div>
        </ConfirmModal>

        <PlanSelectorModal
          isOpen={isPlanModalOpen}
          onClose={() => setIsPlanModalOpen(false)}
        />

        <WelcomeModal
          isOpen={isWelcomeModalOpen}
          onClose={handleCloseWelcome}
          onStartTutorial={() => {
            handleCloseWelcome();
            setIsTutorialModalOpen(true);
          }}
          onCreatePlan={() => createPlan(`Plan ${plans.length + 1}`)}
        />

        <TutorialModal
          isOpen={isTutorialModalOpen}
          onClose={() => setIsTutorialModalOpen(false)}
        />

        <SitemapImportModal
          isOpen={isSitemapImportOpen}
          onClose={() => setIsSitemapImportOpen(false)}
          onCreate={createPlanFromSitemap}
        />

        <SitemapRefreshModal
          isOpen={isSitemapRefreshOpen}
          plan={activePlan}
          onClose={() => setIsSitemapRefreshOpen(false)}
          onApply={refreshPlanFromSitemap}
        />

      </main>
    </div>

  </>
  );
}

export default App;

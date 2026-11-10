import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { WorkflowSteps } from './components/WorkflowSteps';
import { PlayerUpload } from './components/PlayerUpload';
import { OutfitUpload } from './components/OutfitUpload';
import { SmartAssetReport } from './components/SmartAssetReport';
import { CustomizationPanel } from './components/CustomizationPanel';
import { CenterPreview } from './components/CenterPreview';
import { ExportStudioModal } from './components/ExportStudioModal';
import { SelectiveBrushModal } from './components/SelectiveBrushModal';
import { MyCreations } from './components/MyCreations';
import { OutfitLibraryModal } from './components/OutfitLibraryModal';
import { ApiSettingsModal } from './components/ApiSettingsModal';
import {
  PlayerAsset,
  GarmentAsset,
  GarmentSlotId,
  CustomizationSettings,
  GenerationMode,
  LookVariation,
  ProjectRecord,
  SavedOutfit,
} from './types';
import {
  getAllProjects,
  saveProject,
  deleteProject,
  getAllSavedOutfits,
  saveOutfitToLibrary,
  deleteOutfitFromLibrary,
} from './services/storage';
import { removeBackground, addContactShadow } from './utils/imageProcessing';

export default function App() {
  // Navigation tab: 'create' | 'creations'
  const [currentTab, setCurrentTab] = useState<'create' | 'creations'>('create');

  // Staged Assets (Multi-Person Batch & Single Player)
  const [players, setPlayers] = useState<PlayerAsset[]>([]);
  const [activePlayerIndex, setActivePlayerIndex] = useState<number>(0);
  const playerAsset = players[activePlayerIndex] || null;
  const [garments, setGarments] = useState<Partial<Record<GarmentSlotId, GarmentAsset>>>({});

  // Customization & Mode
  const [mode, setMode] = useState<GenerationMode>('REALISTIC');
  const [customization, setCustomization] = useState<CustomizationSettings>({
    colors: {},
    faceExpression: 'Original',
    hairStyle: 'Original',
    hairColor: 'Original',
    facialHair: 'Original',
    pose: 'Original',
    lighting: 'Original',
    customPrompt: '',
    editTarget: 'Overall',
  });
  const [variationsCount, setVariationsCount] = useState<number>(1);

  // Generation Results
  const [variations, setVariations] = useState<LookVariation[]>([]);
  const [activeVariationIndex, setActiveVariationIndex] = useState<number>(0);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatingStage, setGeneratingStage] = useState<string>('Preparing virtual try-on...');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [pipelineWarnings, setPipelineWarnings] = useState<string[]>([]);
  const [garmentStatusMap, setGarmentStatusMap] = useState<Record<string, { applied: boolean; model?: string; note: string }>>({});
  const [isQuotaError, setIsQuotaError] = useState<boolean>(false);
  const [requiresCredentials, setRequiresCredentials] = useState<boolean>(false);

  // Modals
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isBrushOpen, setIsBrushOpen] = useState<boolean>(false);
  const [isOutfitLibraryOpen, setIsOutfitLibraryOpen] = useState<boolean>(false);
  const [isApiSettingsOpen, setIsApiSettingsOpen] = useState<boolean>(false);

  // Persistent Project records & Outfit Library
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Mobile drawer/view tab for small screens: 'assets' | 'preview' | 'controls'
  const [mobileTab, setMobileTab] = useState<'assets' | 'preview' | 'controls'>('preview');

  // Initial load from storage
  useEffect(() => {
    async function loadData() {
      try {
        const storedProjects = await getAllProjects();
        setProjects(storedProjects);
        const storedOutfits = await getAllSavedOutfits();
        setSavedOutfits(storedOutfits);
      } catch (err) {
        console.error('Failed to load stored records:', err);
      }
    }
    loadData();
  }, []);

  // Background Asset Analysis
  const triggerAssetAnalysis = useCallback(
    async (newPlayer: PlayerAsset | null, newGarments: Partial<Record<GarmentSlotId, GarmentAsset>>) => {
      if (!newPlayer || !newPlayer.dataUrl) return;

      setIsAnalyzing(true);
      try {
        const garmentPayload: Record<string, any> = {};
        for (const [k, v] of Object.entries(newGarments)) {
          if (v && v.dataUrl) {
            garmentPayload[k] = {
              data: v.dataUrl,
              mimeType: 'image/jpeg',
              name: v.name || v.fileName,
            };
          }
        }

        const resp = await fetch('/api/analyze-assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player: { data: newPlayer.dataUrl, mimeType: 'image/jpeg' },
            garments: garmentPayload,
          }),
        });

        if (resp.ok) {
          const report = await resp.json();
          if (report.player) {
            setPlayers((prev) =>
              prev.map((p, idx) => (idx === activePlayerIndex ? { ...p, analysis: report.player } : p))
            );
          }
          if (report.garments) {
            setGarments((prev) => {
              const updated = { ...prev };
              for (const [slotKey, gAnalysis] of Object.entries(report.garments)) {
                const sKey = slotKey as GarmentSlotId;
                if (updated[sKey]) {
                  updated[sKey] = {
                    ...updated[sKey]!,
                    analysis: gAnalysis as any,
                  };
                }
              }
              return updated;
            });
          }
        }
      } catch (e) {
        console.warn('Asset analysis non-fatal warning:', e);
      } finally {
        setIsAnalyzing(false);
      }
    },
    []
  );

  // Player Asset Batch & Single Handlers
  const handleAddPlayers = (newAssets: PlayerAsset[]) => {
    setPlayers((prev) => [...prev, ...newAssets]);
    setErrorNotice(null);
    if (newAssets.length > 0) {
      triggerAssetAnalysis(newAssets[0], garments);
    }
  };

  const handleRemovePlayer = (index: number) => {
    setPlayers((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      if (activePlayerIndex >= updated.length) {
        setActivePlayerIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const handleClearAllPlayers = () => {
    setPlayers([]);
    setActivePlayerIndex(0);
    setErrorNotice(null);
  };

  const handleSelectPlayer = (asset: PlayerAsset | null) => {
    if (asset) {
      setPlayers([asset]);
      setActivePlayerIndex(0);
      triggerAssetAnalysis(asset, garments);
    } else {
      setPlayers([]);
      setActivePlayerIndex(0);
    }
    setErrorNotice(null);
  };

  // Update Garment Asset
  const handleUpdateGarment = (slot: GarmentSlotId, asset: GarmentAsset | null) => {
    const updated = { ...garments, [slot]: asset || undefined };
    if (!asset) delete updated[slot];
    setGarments(updated);
    setErrorNotice(null);

    if (playerAsset && asset) {
      triggerAssetAnalysis(playerAsset, updated);
    }
  };

  // Check validation rules
  const hasPlayer = players.length > 0 && Boolean(playerAsset?.dataUrl);
  const activeGarmentsCount = Object.keys(garments).filter((k) => garments[k as GarmentSlotId]).length;
  const hasGarment = activeGarmentsCount > 0;
  const hasCustomPrompt = Boolean(customization.customPrompt?.trim());
  const hasColorOverride = Object.keys(customization.colors).length > 0;
  const hasStylingAdjustment =
    customization.faceExpression !== 'Original' ||
    customization.hairStyle !== 'Original' ||
    customization.pose !== 'Original';

  // Can generate if player is present + at least one modification source is available
  const canGenerate = hasPlayer && (hasGarment || hasCustomPrompt || hasColorOverride || hasStylingAdjustment);

  let validationNotice = '';
  if (hasPlayer && !canGenerate) {
    validationNotice = 'Upload at least one outfit item or type an instruction in the Custom Edit Prompt to transform this character.';
  }

  // Active Generated Look
  const activeVariation = variations[activeVariationIndex] || null;
  const currentGeneratedImage = activeVariation?.imageUrl || null;
  const currentTransparentImage = activeVariation?.transparentUrl || null;
  const currentShadowImage = activeVariation?.shadowTransparentUrl || null;

  // GENERATE LOOK (Supports Single Person or Multi-Person Batch with Shared Outfit Kit)
  const handleGenerateLook = async () => {
    if (!canGenerate || players.length === 0 || isGenerating) return;

    setIsGenerating(true);
    setGeneratingStage(players.length > 1
      ? `Batch: Preparing virtual try-on for ${players.length} people with shared Outfit Kit...`
      : 'Stage 1/5: Locking body proportions & preparing canvas...');
    setErrorNotice(null);
    setPipelineWarnings([]);
    setGarmentStatusMap({});
    setIsQuotaError(false);
    setRequiresCredentials(false);

    // Switch to preview view on mobile
    setMobileTab('preview');

    try {
      // Build shared garments dictionary (identical Outfit Kit shared across all people)
      const garmentsPayload: Record<string, any> = {};
      for (const [slotKey, garment] of Object.entries(garments)) {
        if (garment && garment.dataUrl) {
          garmentsPayload[slotKey] = {
            data: garment.dataUrl,
            mimeType: 'image/jpeg',
            name: garment.name || garment.fileName,
          };
        }
      }

      // Retrieve custom space preference if configured in browser
      const userSpaceId = localStorage.getItem('mxm_hf_space_id')?.trim() || '';

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (userSpaceId) {
        requestHeaders['x-hf-space-id'] = userSpaceId;
      }

      const newVariations: LookVariation[] = [];

      // Process each person in the batch with the exact same shared 4-slot Outfit Kit
      for (let pIdx = 0; pIdx < players.length; pIdx++) {
        const person = players[pIdx];
        const personLabel = players.length > 1 ? `[Person ${pIdx + 1}/${players.length}: ${person.fileName}] ` : '';

        setGeneratingStage(`${personLabel}Stage 1/5: Submitting try-on with shared Outfit Kit...`);

        const response = await fetch('/.netlify/functions/generate-image', {
          method: 'POST',
          headers: requestHeaders,
          body: JSON.stringify({
            player: { data: person.dataUrl, mimeType: 'image/jpeg' },
            garments: garmentsPayload,
            customization,
            mode,
            aspectRatio: '3:4',
            variationsCount: 1,
            spaceId: userSpaceId || undefined,
          }),
        });

        let data: any = {};
        try {
          data = await response.json();
        } catch {
          data = { error: `Server returned HTTP ${response.status}` };
        }

        // Asynchronous Background Processing: Handle HTTP 202 and queued/processing jobs
        if ((response.status === 202 || response.ok) && data.jobId && data.status !== 'completed') {
          let attempts = 0;
          const maxAttempts = 240; // 240 attempts * 2.5s = 600s (10 minutes)
          let isComplete = false;

          while (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, 2500));
            const checkResp = await fetch(`/.netlify/functions/check-job?jobId=${data.jobId}`);
            if (checkResp.ok) {
              const checkData = await checkResp.json();
              if (checkData.stage) {
                setGeneratingStage(`${personLabel}${checkData.stage}`);
              }
              if (checkData.status === 'completed') {
                if (checkData.result && checkData.result.images?.length) {
                  data = { ...checkData.result, success: true };
                  isComplete = true;
                  break;
                } else {
                  // Secondary check via get-job-result
                  const resultResp = await fetch(`/.netlify/functions/get-job-result?jobId=${data.jobId}`);
                  if (resultResp.ok) {
                    const resultData = await resultResp.json();
                    if (resultData.images?.length) {
                      data = { ...resultData, success: true };
                      isComplete = true;
                      break;
                    }
                  }
                }
              } else if (checkData.status === 'failed') {
                if (checkData.requiresCredentials) setRequiresCredentials(true);
                if (checkData.isQuotaExhausted) setIsQuotaError(true);
                setErrorNotice(checkData.error || `Virtual Try-On generation failed for ${person.fileName}`);
                setIsGenerating(false);
                return;
              }
            }
            attempts++;
          }

          if (!isComplete && (!data.images || data.images.length === 0)) {
            setErrorNotice(`Virtual Try-On timed out waiting for Hugging Face ZeroGPU queue for ${person.fileName}`);
            setIsGenerating(false);
            return;
          }
        }

        if ((!response.ok && response.status !== 202) || !data.images || data.images.length === 0) {
          if (data.requiresCredentials || response.status === 401) {
            setRequiresCredentials(true);
          } else if (data.isQuotaExhausted || response.status === 429) {
            setIsQuotaError(true);
          }

          const detailMsg = data.error ||
            (data.statusText ? `${data.statusText} (${response.status})` : `Server returned status ${response.status}`);

          const isExpectedNotice =
            data.isQuotaExhausted ||
            response.status === 429 ||
            data.isAuthError ||
            data.requiresCredentials ||
            response.status === 401;

          if (isExpectedNotice) {
            console.warn('[Look Generation Status Notice]', { status: response.status, data });
          } else {
            console.error('[Look Generation Error]', { status: response.status, data });
          }
          setErrorNotice(`Virtual Try-On Error: ${detailMsg}`);
          setIsGenerating(false);
          return;
        }

        // Quality control: capture warnings and status per category
        if (data.warnings && Array.isArray(data.warnings)) {
          setPipelineWarnings(data.warnings);
        }
        if (data.garmentStatus) {
          setGarmentStatusMap(data.garmentStatus);
        }

        // Process transparent cutout and studio contact shadow for this person
        for (let i = 0; i < data.images.length; i++) {
          const item = data.images[i];
          let transUrl: string | undefined = undefined;
          let shadowUrl: string | undefined = undefined;

          try {
            transUrl = await removeBackground(item.imageUrl, { tolerance: 30, feather: 2 });
            shadowUrl = await addContactShadow(transUrl);
          } catch (segmentationErr) {
            console.warn('Background removal non-fatal fallback:', segmentationErr);
            transUrl = item.imageUrl;
          }

          newVariations.push({
            id: `var_${Date.now()}_p${pIdx}_${i}`,
            imageUrl: item.imageUrl,
            label: players.length > 1
              ? `Person ${pIdx + 1}: ${person.fileName.replace(/\.[^/.]+$/, '')}`
              : (item.label || 'Virtual Try-On Look'),
            index: newVariations.length,
            transparentUrl: transUrl,
            shadowTransparentUrl: shadowUrl,
          });
        }
      }

      setVariations(newVariations);
      setActiveVariationIndex(0);

      // Persist to IndexedDB project
      const projectId = currentProjectId || `proj_${Date.now()}`;
      const projectName = playerAsset.fileName
        ? `${playerAsset.fileName.replace(/\.[^/.]+$/, '')} — ${mode} Look`
        : `Studio Look ${new Date().toLocaleDateString()}`;

      const newVersion = {
        id: `v_${Date.now()}`,
        name: `Version ${projects.find((p) => p.id === projectId)?.versions.length ? projects.find((p) => p.id === projectId)!.versions.length + 1 : 1}`,
        createdAt: Date.now(),
        originalImage: playerAsset.dataUrl,
        generatedImage: newVariations[0].imageUrl,
        transparentImage: newVariations[0].transparentUrl,
        shadowTransparentImage: newVariations[0].shadowTransparentUrl,
        mode,
        aspectRatio: '3:4',
        settingsSnapshot: { ...customization },
      };

      const projectRecord: ProjectRecord = {
        id: projectId,
        name: projectName,
        createdAt: projects.find((p) => p.id === projectId)?.createdAt || Date.now(),
        updatedAt: Date.now(),
        playerAsset,
        garments,
        activeVersionIndex: 0,
        versions: [
          newVersion,
          ...(projects.find((p) => p.id === projectId)?.versions || []),
        ],
        customization,
        mode,
      };

      await saveProject(projectRecord);
      setCurrentProjectId(projectId);
      setProjects((prev) => [projectRecord, ...prev.filter((p) => p.id !== projectId)]);
    } catch (err: any) {
      console.warn('[Look Generation]', err?.message || err);
      setErrorNotice(err?.message || 'Generation encountered an unexpected issue. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Workspace Reset
  const handleResetWorkspace = () => {
    setPlayers([]);
    setActivePlayerIndex(0);
    setGarments({});
    setVariations([]);
    setActiveVariationIndex(0);
    setCurrentProjectId(null);
    setErrorNotice(null);
    setCustomization({
      colors: {},
      faceExpression: 'Original',
      hairStyle: 'Original',
      hairColor: 'Original',
      facialHair: 'Original',
      pose: 'Original',
      lighting: 'Original',
      customPrompt: '',
      editTarget: 'Overall',
    });
  };

  // Open Project from My Creations
  const handleOpenProject = (proj: ProjectRecord) => {
    setPlayers(proj.playerAsset ? [proj.playerAsset] : []);
    setActivePlayerIndex(0);
    setGarments(proj.garments || {});
    setCustomization(proj.customization || {
      colors: {},
      faceExpression: 'Original',
      hairStyle: 'Original',
      hairColor: 'Original',
      facialHair: 'Original',
      pose: 'Original',
      lighting: 'Original',
      customPrompt: '',
      editTarget: 'Overall',
    });
    setMode(proj.mode || 'REALISTIC');
    setCurrentProjectId(proj.id);

    // Reconstruct variations from versions
    if (proj.versions && proj.versions.length > 0) {
      const vars: LookVariation[] = proj.versions.map((v, i) => ({
        id: v.id,
        imageUrl: v.generatedImage,
        label: v.name,
        index: i,
        transparentUrl: v.transparentImage,
        shadowTransparentUrl: v.shadowTransparentImage,
      }));
      setVariations(vars);
      setActiveVariationIndex(0);
    }

    setCurrentTab('create');
  };

  // Duplicate Project
  const handleDuplicateProject = async (proj: ProjectRecord) => {
    const copy: ProjectRecord = {
      ...proj,
      id: `proj_${Date.now()}`,
      name: `${proj.name} (Copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveProject(copy);
    setProjects((prev) => [copy, ...prev]);
  };

  // Delete Project
  const handleDeleteProject = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (currentProjectId === id) {
      setCurrentProjectId(null);
    }
  };

  // Save current staged garments into Outfit Library
  const handleSaveCurrentAsOutfit = async (name: string) => {
    const active: Partial<Record<GarmentSlotId, { name: string; dataUrl: string }>> = {};
    for (const [slot, g] of Object.entries(garments)) {
      if (g && g.dataUrl) {
        active[slot as GarmentSlotId] = {
          name: g.name || g.fileName,
          dataUrl: g.dataUrl,
        };
      }
    }
    const newOutfit: SavedOutfit = {
      id: `outfit_${Date.now()}`,
      name,
      createdAt: Date.now(),
      garments: active,
      colors: { ...customization.colors },
    };
    await saveOutfitToLibrary(newOutfit);
    setSavedOutfits((prev) => [newOutfit, ...prev]);
  };

  // Apply Outfit from Outfit Library
  const handleApplyOutfit = (outfit: SavedOutfit) => {
    const restoredGarments: Partial<Record<GarmentSlotId, GarmentAsset>> = {};
    for (const [slot, item] of Object.entries(outfit.garments)) {
      if (item) {
        const sKey = slot as GarmentSlotId;
        restoredGarments[sKey] = {
          slot: sKey,
          dataUrl: item.dataUrl,
          fileName: `${item.name}.jpg`,
          name: item.name,
          analysis: {
            garmentType: item.name,
            shapeDetected: true,
            status: 'GOOD',
          },
        };
      }
    }
    setGarments(restoredGarments);
    if (outfit.colors) {
      setCustomization((prev) => ({
        ...prev,
        colors: { ...prev.colors, ...outfit.colors },
      }));
    }
  };

  // Delete Outfit
  const handleDeleteOutfit = async (id: string) => {
    await deleteOutfitFromLibrary(id);
    setSavedOutfits((prev) => prev.filter((o) => o.id !== id));
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0d0e] font-sans text-neutral-200">
      {/* 1. Header (Top Bar Contract: 3 Zones) */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenExport={() => setIsExportOpen(true)}
        canExport={Boolean(currentGeneratedImage)}
        onResetWorkspace={handleResetWorkspace}
        onOpenSettings={() => setIsApiSettingsOpen(true)}
        savedCreationsCount={projects.length}
      />

      {/* Main Content Area */}
      {currentTab === 'creations' ? (
        <main className="flex-1">
          <MyCreations
            projects={projects}
            onOpenProject={handleOpenProject}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            onCreateNew={() => setCurrentTab('create')}
          />
        </main>
      ) : (
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* 2. Workflow Guidance Steps (Non-linear) */}
          <WorkflowSteps
            hasPlayer={hasPlayer}
            hasGarment={hasGarment}
            hasCustomization={Boolean(customization.customPrompt || Object.keys(customization.colors).length > 0)}
            isReadyToGenerate={canGenerate}
          />

          {/* Mobile Tab Switcher */}
          <div className="flex border-b border-white/[0.08] bg-[#121417] p-1 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileTab('assets')}
              className={`flex-1 py-2 text-center text-xs font-semibold uppercase tracking-wider rounded ${
                mobileTab === 'assets' ? 'bg-[#1e2329] text-[#00e599]' : 'text-neutral-400'
              }`}
            >
              Assets
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`flex-1 py-2 text-center text-xs font-semibold uppercase tracking-wider rounded ${
                mobileTab === 'preview' ? 'bg-[#1e2329] text-[#00e599]' : 'text-neutral-400'
              }`}
            >
              Preview
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('controls')}
              className={`flex-1 py-2 text-center text-xs font-semibold uppercase tracking-wider rounded ${
                mobileTab === 'controls' ? 'bg-[#1e2329] text-[#00e599]' : 'text-neutral-400'
              }`}
            >
              Customize
            </button>
          </div>

          {/* 3. Three-Zone Desktop Creative Workspace */}
          <div className="mx-auto flex w-full max-w-7xl flex-1 gap-4 p-3 sm:p-5 overflow-hidden">
            {/* LEFT AREA: Uploaded Assets */}
            <aside
              className={`w-full lg:w-80 shrink-0 flex-col space-y-4 overflow-y-auto pr-1 no-scrollbar ${
                mobileTab === 'assets' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {/* Multi-Person Batch & Single Player Upload */}
              <PlayerUpload
                players={players}
                activePlayerIndex={activePlayerIndex}
                onSelectActivePlayer={setActivePlayerIndex}
                onAddPlayers={handleAddPlayers}
                onRemovePlayer={handleRemovePlayer}
                onClearAllPlayers={handleClearAllPlayers}
                isAnalyzing={isAnalyzing}
              />

              {/* Garment Uploads (4 optional slots) */}
              <OutfitUpload
                garments={garments}
                onUpdateGarment={handleUpdateGarment}
                onOpenOutfitLibrary={() => setIsOutfitLibraryOpen(true)}
                savedOutfitsCount={savedOutfits.length}
              />

              {/* Compact Smart Asset Report */}
              <SmartAssetReport
                playerAsset={playerAsset}
                garments={garments}
                isAnalyzing={isAnalyzing}
              />
            </aside>

            {/* CENTER AREA: Dominant Visual Preview */}
            <section
              className={`flex-1 min-w-0 flex-col overflow-hidden ${
                mobileTab === 'preview' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              {errorNotice && (
                <div className="mb-3 rounded-lg border border-amber-500/30 bg-[#1a1614] px-4 py-3 text-xs text-amber-200 flex items-start justify-between gap-3 shadow-lg">
                  <div className="space-y-1">
                    <p className="font-semibold uppercase tracking-wider text-[11px] text-amber-300">
                      API Quota / Plan Notice
                    </p>
                    <p className="text-neutral-300 leading-relaxed">{errorNotice}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setErrorNotice(null)}
                    className="shrink-0 rounded bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              <CenterPreview
                playerAsset={playerAsset}
                generatedImage={currentGeneratedImage}
                transparentImage={currentTransparentImage}
                shadowImage={currentShadowImage}
                variations={variations}
                activeVariationIndex={activeVariationIndex}
                onSelectVariation={setActiveVariationIndex}
                isGenerating={isGenerating}
                generatingStage={generatingStage}
                pipelineWarnings={pipelineWarnings}
                garmentStatusMap={garmentStatusMap}
                onOpenExport={() => setIsExportOpen(true)}
                onOpenBrushTool={() => setIsBrushOpen(true)}
                hasMask={Boolean(customization.maskDataUrl)}
                requiresCredentials={requiresCredentials}
                isQuotaError={isQuotaError}
                setupErrorMessage={errorNotice}
                onRetry={handleGenerateLook}
                onDismissError={() => {
                  setRequiresCredentials(false);
                  setIsQuotaError(false);
                  setErrorNotice(null);
                }}
                onOpenSettings={() => setIsApiSettingsOpen(true)}
              />
            </section>

            {/* RIGHT AREA: Customization & Controls */}
            <aside
              className={`w-full lg:w-80 shrink-0 flex-col overflow-y-auto pl-1 no-scrollbar ${
                mobileTab === 'controls' ? 'flex' : 'hidden lg:flex'
              }`}
            >
              <CustomizationPanel
                customization={customization}
                onChangeCustomization={setCustomization}
                mode={mode}
                onChangeMode={setMode}
                variationsCount={variationsCount}
                onChangeVariationsCount={setVariationsCount}
                isGenerating={isGenerating}
                onGenerate={handleGenerateLook}
                canGenerate={canGenerate}
                validationNotice={validationNotice}
                hasPlayer={hasPlayer}
              />
            </aside>
          </div>
        </main>
      )}

      {/* MODALS */}
      {/* 1. Export Studio Modal */}
      {isExportOpen && currentGeneratedImage && (
        <ExportStudioModal
          isOpen={isExportOpen}
          onClose={() => setIsExportOpen(false)}
          sourceImage={currentGeneratedImage}
          transparentImage={currentTransparentImage || undefined}
          shadowImage={currentShadowImage || undefined}
          projectName={playerAsset?.fileName ? playerAsset.fileName.replace(/\.[^/.]+$/, '') : 'mxm_look'}
        />
      )}

      {/* 2. Selective Area Brush Tool */}
      {isBrushOpen && currentGeneratedImage && (
        <SelectiveBrushModal
          isOpen={isBrushOpen}
          onClose={() => setIsBrushOpen(false)}
          baseImage={currentGeneratedImage}
          initialMask={customization.maskDataUrl}
          onSaveMask={(mask) => setCustomization({ ...customization, maskDataUrl: mask })}
        />
      )}

      {/* 3. Outfit Library Modal */}
      {isOutfitLibraryOpen && (
        <OutfitLibraryModal
          isOpen={isOutfitLibraryOpen}
          onClose={() => setIsOutfitLibraryOpen(false)}
          savedOutfits={savedOutfits}
          currentGarments={garments}
          currentColors={customization.colors}
          onSaveCurrentAsOutfit={handleSaveCurrentAsOutfit}
          onApplyOutfit={handleApplyOutfit}
          onDeleteOutfit={handleDeleteOutfit}
        />
      )}

      {/* 4. Gemini API Connection Settings Modal */}
      {isApiSettingsOpen && (
        <ApiSettingsModal
          isOpen={isApiSettingsOpen}
          onClose={() => setIsApiSettingsOpen(false)}
        />
      )}
    </div>
  );
}

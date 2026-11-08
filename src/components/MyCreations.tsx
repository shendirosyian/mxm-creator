import React from 'react';
import {
  FolderKanban,
  Calendar,
  Layers,
  ArrowRight,
  Trash2,
  Copy,
  Download,
  Plus,
  Grid,
} from 'lucide-react';
import { ProjectRecord } from '../types';

interface MyCreationsProps {
  projects: ProjectRecord[];
  onOpenProject: (project: ProjectRecord) => void;
  onDuplicateProject: (project: ProjectRecord) => void;
  onDeleteProject: (id: string) => void;
  onCreateNew: () => void;
}

export const MyCreations: React.FC<MyCreationsProps> = ({
  projects,
  onOpenProject,
  onDuplicateProject,
  onDeleteProject,
  onCreateNew,
}) => {
  if (projects.length === 0) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#121417] text-neutral-500">
          <FolderKanban className="h-8 w-8 text-neutral-400" />
        </div>
        <h2 className="text-base font-bold uppercase tracking-wider text-white">
          No Saved Creations Yet
        </h2>
        <p className="mt-2 text-xs text-neutral-400 max-w-sm">
          Generate virtual styling looks and save your character transformations to
          access them here anytime.
        </p>
        <button
          type="button"
          onClick={onCreateNew}
          className="mt-6 flex items-center gap-2 rounded-lg bg-[#00e599] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black hover:bg-[#00ffaa] transition-colors"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>Create Your First Look</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Page Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wider text-white">
            My Creations
          </h1>
          <p className="text-xs text-neutral-400">
            {projects.length} saved visual production {projects.length === 1 ? 'project' : 'projects'}
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="flex items-center gap-2 rounded-lg bg-[#00e599] px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-black hover:bg-[#00ffaa] transition-colors"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>New Look</span>
        </button>
      </div>

      {/* Grid of Projects */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {projects.map((proj) => {
          const activeVersion = proj.versions[proj.activeVersionIndex] || proj.versions[0];
          const displayImg = activeVersion?.transparentImage || activeVersion?.generatedImage || proj.playerAsset?.dataUrl;
          const isTransparent = Boolean(activeVersion?.transparentImage);
          const dateStr = new Date(proj.updatedAt || proj.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });

          return (
            <div
              key={proj.id}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#121417] transition-all hover:border-white/20 hover:shadow-xl"
            >
              {/* Thumbnail Container */}
              <div
                onClick={() => onOpenProject(proj)}
                className={`relative aspect-3/4 w-full cursor-pointer overflow-hidden ${
                  isTransparent ? 'bg-checkerboard' : 'bg-[#0b0d0e]'
                }`}
              >
                {displayImg && (
                  <img
                    src={displayImg}
                    alt={proj.name}
                    className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                  />
                )}

                {/* Badge: Versions count */}
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono text-neutral-300 backdrop-blur-xs">
                  <Layers className="h-3 w-3" />
                  <span>{proj.versions.length} v</span>
                </div>

                {isTransparent && (
                  <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-[10px] font-mono text-[#00e599] backdrop-blur-xs">
                    <Grid className="h-3 w-3" />
                    <span>Alpha PNG</span>
                  </div>
                )}
              </div>

              {/* Card Meta & Actions */}
              <div className="flex flex-1 flex-col justify-between p-3.5">
                <div>
                  <h3 className="truncate text-xs font-semibold text-white">
                    {proj.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-neutral-500" />
                      <span>{dateStr}</span>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{proj.mode.toLowerCase()}</span>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => onOpenProject(proj)}
                    className="flex items-center gap-1 text-xs font-medium text-[#00e599] hover:underline"
                  >
                    <span>Open Look</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>

                  <div className="flex items-center gap-1 text-neutral-400">
                    <button
                      type="button"
                      onClick={() => onDuplicateProject(proj)}
                      title="Duplicate project"
                      className="rounded p-1.5 hover:bg-white/[0.06] hover:text-white transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteProject(proj.id)}
                      title="Delete project"
                      className="rounded p-1.5 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import React from 'react';

interface WorkflowStepsProps {
  hasPlayer: boolean;
  hasGarment: boolean;
  hasCustomization: boolean;
  isReadyToGenerate: boolean;
}

export const WorkflowSteps: React.FC<WorkflowStepsProps> = ({
  hasPlayer,
  hasGarment,
  hasCustomization,
  isReadyToGenerate,
}) => {
  const steps = [
    { num: '01', label: 'Player', done: hasPlayer },
    { num: '02', label: 'Outfit', done: hasGarment },
    { num: '03', label: 'Customize', done: hasCustomization },
    { num: '04', label: 'Generate', done: isReadyToGenerate },
  ];

  return (
    <div className="w-full border-b border-white/[0.06] bg-[#0e1012] px-4 py-2 sm:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-6 overflow-x-auto py-1 no-scrollbar">
          {steps.map((step, idx) => (
            <div key={step.num} className="flex items-center gap-2 whitespace-nowrap">
              <span
                className={`font-mono text-[11px] tabular-nums font-medium ${
                  step.done ? 'text-[#00e599]' : 'text-neutral-300'
                }`}
              >
                {step.num}
              </span>
              <span
                className={`uppercase tracking-wider text-[11px] ${
                  step.done ? 'text-neutral-200 font-medium' : 'text-neutral-400'
                }`}
              >
                {step.label}
              </span>
              {idx < steps.length - 1 && (
                <span className="text-neutral-700" aria-hidden="true">
                  /
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2 text-[11px] text-neutral-400">
          <span>Non-linear creative workflow</span>
          <span aria-hidden="true">·</span>
          <span>Only player photo is mandatory</span>
        </div>
      </div>
    </div>
  );
};

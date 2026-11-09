import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Server,
  Cpu,
  Layers,
  Save,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface HfDiagnosticData {
  success: boolean;
  spaceId: string;
  hardware: string;
  hasHfToken: boolean;
  maskedToken: string;
  statusCode: number;
  statusText: string;
  sanitizedMessage: string;
  spaceStatus: string;
  endpointTested: string;
  timestamp?: string;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [diagnostic, setDiagnostic] = useState<HfDiagnosticData | null>(null);
  const [spaceId, setSpaceId] = useState<string>(() => {
    return localStorage.getItem('mxm_hf_space_id') || 'Nymbo/Virtual-Try-On';
  });
  const [isSaved, setIsSaved] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Run initial lightweight status check when opening modal if not yet checked
  useEffect(() => {
    if (isOpen && !diagnostic && !isTesting) {
      handleTestConnection();
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setIsSaved(false);
    try {
      const res = await fetch('/.netlify/functions/hf-diagnostic');
      const data: HfDiagnosticData = await res.json();
      setDiagnostic(data);
    } catch (err: any) {
      setDiagnostic({
        success: false,
        spaceId: 'Nymbo/Virtual-Try-On',
        hardware: 'zero-a10g',
        hasHfToken: false,
        maskedToken: 'NONE',
        statusCode: 500,
        statusText: 'Diagnostic Failed',
        sanitizedMessage: err?.message || 'Could not connect to Hugging Face diagnostic endpoint.',
        spaceStatus: 'ERROR',
        endpointTested: 'https://huggingface.co/spaces/Nymbo/Virtual-Try-On',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('mxm_hf_space_id', spaceId.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg rounded-xl border border-white/[0.08] bg-[#121417] p-6 shadow-2xl text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00e599]/30 bg-[#00e599]/10 text-[#00e599]">
              <Server className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Hugging Face ZeroGPU Try-On Settings
              </h2>
              <p className="text-[11px] text-neutral-400">
                Gradio API proxy via Netlify Functions · Nymbo/Virtual-Try-On
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="mt-5 space-y-4">
          {/* Card 1: Connection Status & Real HTTP Result */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Space Status
              </span>
              {diagnostic && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium ${
                    diagnostic.success
                      ? 'border border-[#00e599]/40 bg-[#00e599]/10 text-[#00e599]'
                      : diagnostic.statusCode === 429
                      ? 'border border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border border-rose-500/40 bg-rose-500/10 text-rose-400'
                  }`}
                >
                  {diagnostic.success ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Ready · {diagnostic.spaceStatus}
                    </>
                  ) : diagnostic.statusCode === 429 ? (
                    <>
                      <AlertTriangle className="h-3 w-3" /> ZeroGPU Quota Reached
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" /> Status: {diagnostic.statusCode}
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Diagnostic Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                  ZeroGPU Hardware
                </span>
                <span className="font-mono text-[11px] text-[#00e599] font-medium">
                  {diagnostic ? diagnostic.hardware : 'zero-a10g'}
                </span>
              </div>
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                  HF Token (Netlify)
                </span>
                <span className="font-mono text-[11px] text-neutral-200">
                  {diagnostic ? (diagnostic.hasHfToken ? diagnostic.maskedToken : 'Optional (Public)') : 'Checking...'}
                </span>
              </div>
            </div>

            {/* Live Message & Endpoint Feedback */}
            {diagnostic && (
              <div
                className={`rounded border p-2.5 text-xs ${
                  diagnostic.success
                    ? 'border-[#00e599]/20 bg-[#00e599]/5 text-neutral-200'
                    : diagnostic.statusCode === 429
                    ? 'border-amber-500/20 bg-amber-500/5 text-amber-200'
                    : 'border-rose-500/20 bg-rose-500/5 text-rose-200'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {diagnostic.success ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#00e599] shrink-0" />
                    ) : diagnostic.statusCode === 429 ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium leading-relaxed">
                      {diagnostic.sanitizedMessage}
                    </p>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-400">
                      <span>Space: {diagnostic.spaceId}</span>
                      <span>·</span>
                      <span>Status: {diagnostic.spaceStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Action: Test Connection Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#20252b] py-2 text-xs font-semibold text-white hover:bg-[#282e36] hover:border-white/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#00e599] ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Checking Hugging Face ZeroGPU Space...' : 'TEST SPACE CONNECTION'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Space Configuration */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-neutral-400" />
                <span>Target Hugging Face Space</span>
              </span>
              <span className="font-mono text-[10px] text-[#00e599] bg-[#00e599]/10 px-2 py-0.5 rounded border border-[#00e599]/30">
                zero-a10g
              </span>
            </div>

            <div>
              <input
                type="text"
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
                placeholder="Nymbo/Virtual-Try-On"
                className="w-full rounded-lg border border-white/10 bg-[#121417] px-3 py-2 font-mono text-xs text-white placeholder-neutral-500 focus:border-[#00e599] focus:outline-hidden"
              />
              <p className="mt-1.5 text-[10px] text-neutral-400 leading-relaxed">
                Default candidate: <span className="font-mono text-neutral-200">Nymbo/Virtual-Try-On</span>. Server proxy connects securely via <span className="font-mono text-neutral-200">@gradio/client</span> to the <span className="font-mono text-[#00e599]">/tryon</span> endpoint.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-neutral-400">
                {isSaved ? <span className="text-[#00e599] font-medium">✓ Settings Saved</span> : 'Saved to browser preference'}
              </span>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex items-center gap-1.5 rounded-lg bg-[#00e599] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#00ffaa] transition-colors"
              >
                <Save className="h-3 w-3 stroke-[2.5]" />
                <span>SAVE SETTINGS</span>
              </button>
            </div>
          </div>

          {/* Card 3: Security & Netlify Token Instructions */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-3 text-[11px] text-neutral-300 space-y-1.5">
            <div className="flex items-center gap-2 text-white font-medium text-xs">
              <ShieldCheck className="h-4 w-4 text-[#00e599]" />
              <span>Secure Server-Side Architecture</span>
            </div>
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Hugging Face API requests are proxied securely through Netlify Functions. To increase ZeroGPU quota limits or use your own Hugging Face tier, set <span className="font-mono text-white">HF_TOKEN</span> in Netlify environment variables (<strong className="text-neutral-200">Site configuration &gt; Environment variables</strong>).
            </p>
            <div className="pt-1 flex items-center justify-between">
              <a
                href="https://huggingface.co/spaces/Nymbo/Virtual-Try-On"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[#00e599] hover:underline"
              >
                <span>View Nymbo/Virtual-Try-On Space</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-white hover:underline"
              >
                <span>HF Access Tokens</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex justify-end border-t border-white/[0.08] pt-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-[#181b1f] px-4 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

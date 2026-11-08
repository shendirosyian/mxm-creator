import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
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

export interface DiagnosticData {
  success: boolean;
  hasApiKey: boolean;
  maskedKey: string;
  statusCode: number;
  statusText: string;
  authMethod: string;
  endpointTested: string;
  modelTested: string;
  sanitizedMessage: string;
  timestamp?: string;
  conflictingEnv?: {
    hasGoogleApiKey: boolean;
    hasGoogleGenAiUseVertexAi: boolean;
    hasGoogleAppCredentials: boolean;
    hasAnyConflict: boolean;
  };
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [modelName, setModelName] = useState<string>(() => {
    return localStorage.getItem('mxm_gemini_image_model') || 'gemini-3.1-flash-lite-image';
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
      const res = await fetch('/.netlify/functions/gemini-diagnostic');
      const data: DiagnosticData = await res.json();
      setDiagnostic(data);
    } catch (err: any) {
      setDiagnostic({
        success: false,
        hasApiKey: false,
        maskedKey: 'UNKNOWN',
        statusCode: 500,
        statusText: 'Diagnostic Failed',
        authMethod: 'x-goog-api-key',
        endpointTested: 'https://generativelanguage.googleapis.com',
        modelTested: 'gemini-3.8-flash',
        sanitizedMessage: err?.message || 'Could not connect to Netlify diagnostic endpoint.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('mxm_gemini_image_model', modelName.trim());
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
                Gemini API Connection & Settings
              </h2>
              <p className="text-[11px] text-neutral-400">
                Official Google Generative Language Developer API
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
                Connection Status
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
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </>
                  ) : diagnostic.statusCode === 429 ? (
                    <>
                      <AlertTriangle className="h-3 w-3" /> Quota Reached
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3" /> HTTP {diagnostic.statusCode}
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Diagnostic Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                  Auth Method
                </span>
                <span className="font-mono text-[11px] text-[#00e599] font-medium">
                  x-goog-api-key
                </span>
              </div>
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                  Server Key Status
                </span>
                <span className="font-mono text-[11px] text-neutral-200">
                  {diagnostic ? diagnostic.maskedKey : 'Checking...'}
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
                      <span>HTTP Status: {diagnostic.statusCode}</span>
                      <span>·</span>
                      <span>Target: {diagnostic.modelTested}</span>
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
                <span>{isTesting ? 'Testing Native Gemini Connection...' : 'TEST CONNECTION'}</span>
              </button>
            </div>
          </div>

          {/* Environment Conflict Audit */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-3 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-semibold text-neutral-400 tracking-wider">
                Environment Conflict Audit
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                  diagnostic?.conflictingEnv?.hasAnyConflict
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                    : 'bg-[#00e599]/10 text-[#00e599] border border-[#00e599]/30'
                }`}
              >
                {diagnostic?.conflictingEnv?.hasAnyConflict ? 'Conflicting Env Detected' : 'No Conflicting Vars'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-[10px]">
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2">
                <span className="text-neutral-400 block truncate">GOOGLE_API_KEY</span>
                <span className={diagnostic?.conflictingEnv?.hasGoogleApiKey ? 'text-amber-400 font-semibold' : 'text-neutral-500'}>
                  {diagnostic?.conflictingEnv?.hasGoogleApiKey ? 'Present (Ignored)' : 'None'}
                </span>
              </div>
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2">
                <span className="text-neutral-400 block truncate">USE_VERTEXAI</span>
                <span className={diagnostic?.conflictingEnv?.hasGoogleGenAiUseVertexAi ? 'text-amber-400 font-semibold' : 'text-neutral-500'}>
                  {diagnostic?.conflictingEnv?.hasGoogleGenAiUseVertexAi ? 'Present (Ignored)' : 'None'}
                </span>
              </div>
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2">
                <span className="text-neutral-400 block truncate">APP_CREDENTIALS</span>
                <span className={diagnostic?.conflictingEnv?.hasGoogleAppCredentials ? 'text-amber-400 font-semibold' : 'text-neutral-500'}>
                  {diagnostic?.conflictingEnv?.hasGoogleAppCredentials ? 'Present (Ignored)' : 'None'}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Native authentication strictly uses <span className="text-white font-mono">GEMINI_API_KEY</span>. Any conflicting variables are safely ignored and values are never exposed.
            </p>
          </div>

          {/* Card 2: Image Model Configuration */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-neutral-400" />
                <span>Active Image Model</span>
              </span>
              <span className="font-mono text-[10px] text-[#00e599] bg-[#00e599]/10 px-2 py-0.5 rounded border border-[#00e599]/30">
                Free Tier Default
              </span>
            </div>

            <div>
              <input
                type="text"
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="gemini-3.1-flash-lite-image"
                className="w-full rounded-lg border border-white/10 bg-[#121417] px-3 py-2 font-mono text-xs text-white placeholder-neutral-500 focus:border-[#00e599] focus:outline-hidden"
              />
              <p className="mt-1.5 text-[10px] text-neutral-400 leading-relaxed">
                Standard image generation & virtual styling uses <span className="font-mono text-neutral-200">gemini-3.1-flash-lite-image</span>. Can also be overridden in Netlify via <span className="font-mono text-neutral-200">GEMINI_IMAGE_MODEL</span>.
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

          {/* Card 3: Security & Netlify Environment Notice */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-3 text-[11px] text-neutral-300 space-y-1.5">
            <div className="flex items-center gap-2 text-white font-medium text-xs">
              <ShieldCheck className="h-4 w-4 text-[#00e599]" />
              <span>Zero Browser API Key Exposure</span>
            </div>
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Your API key is never exposed or requested in the frontend browser. Set <span className="font-mono text-white">GEMINI_API_KEY</span> in your Netlify site settings (<strong className="text-neutral-200">Site configuration &gt; Environment variables</strong>) or AI Studio Secrets.
            </p>
            <div className="pt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[#00e599] hover:underline"
              >
                <span>Get Google AI Studio API Key</span>
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

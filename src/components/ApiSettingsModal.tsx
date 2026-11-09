import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Server,
  Cpu,
  Save,
  RefreshCw,
  ExternalLink,
  Key,
  Info,
  Check,
} from 'lucide-react';

interface ApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface HfDiagnosticData {
  success: boolean;
  spaceId: string;
  hardware: string;
  tokenConfigured: boolean;
  tokenValidity: 'VALID' | 'INVALID' | 'UNCHECKED' | 'NOT_CONFIGURED';
  authType: 'PERSONAL_TOKEN' | 'ANONYMOUS_PUBLIC';
  statusCode: number;
  statusText: string;
  sanitizedMessage: string;
  stage: string;
  quotaNote?: string;
  endpointsFound?: string[];
  timestamp?: string;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [diagnostic, setDiagnostic] = useState<HfDiagnosticData | null>(null);
  const [spaceId, setSpaceId] = useState<string>(() => {
    return localStorage.getItem('mxm_hf_space_id') || 'Nymbo/Virtual-Try-On';
  });
  const [isSaved, setIsSaved] = useState(false);

  // Transient token input for server environment configuration (never stored in browser)
  const [tokenInput, setTokenInput] = useState('');
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [tokenUpdateMsg, setTokenUpdateMsg] = useState<{ success: boolean; message: string } | null>(null);

  // Security guarantee: Purge any legacy client-side token from localStorage / sessionStorage
  useEffect(() => {
    try {
      localStorage.removeItem('mxm_hf_token');
      sessionStorage.removeItem('mxm_hf_token');
    } catch {
      // storage unavailable
    }
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Run initial server status check when opening modal if not yet checked
  useEffect(() => {
    if (isOpen && !diagnostic && !isTesting) {
      handleTestConnection();
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setIsSaved(false);
    try {
      const res = await fetch(`/.netlify/functions/hf-diagnostic?spaceId=${encodeURIComponent(spaceId.trim())}`);
      const data: HfDiagnosticData = await res.json();
      setDiagnostic(data);
    } catch (err: any) {
      setDiagnostic({
        success: false,
        spaceId: spaceId || 'Nymbo/Virtual-Try-On',
        hardware: 'zero-a10g',
        tokenConfigured: false,
        tokenValidity: 'UNCHECKED',
        authType: 'ANONYMOUS_PUBLIC',
        statusCode: 500,
        statusText: 'Diagnostic Failed',
        sanitizedMessage: err?.message || 'Could not connect to Netlify Hugging Face diagnostic endpoint.',
        stage: 'ERROR',
        quotaNote: 'Check server logs or network connectivity.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConfigureServerToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;
    setIsUpdatingToken(true);
    setTokenUpdateMsg(null);
    try {
      const res = await fetch('/api/configure-server-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTokenUpdateMsg({ success: false, message: data.error || 'Failed to configure server token.' });
      } else {
        setTokenInput(''); // Clear immediately so it never resides in client memory
        setTokenUpdateMsg({
          success: true,
          message: 'Server HF_TOKEN verified with Hugging Face and saved to server environment.',
        });
        handleTestConnection();
      }
    } catch (err: any) {
      setTokenUpdateMsg({ success: false, message: err?.message || 'Network error updating server token.' });
    } finally {
      setIsUpdatingToken(false);
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
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-white/[0.08] bg-[#121417] p-6 shadow-2xl text-neutral-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#00e599]/30 bg-[#00e599]/10 text-[#00e599]">
              <Server className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Hugging Face ZeroGPU &amp; Auth Settings
              </h2>
              <p className="text-[11px] text-neutral-400">
                Server-side Netlify Functions Proxy · ZeroGPU Try-On Pipeline
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
          {/* Card 1: Server Authentication Status */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                Server Authentication Status
              </span>
              {diagnostic && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium ${
                    diagnostic.tokenConfigured && diagnostic.tokenValidity === 'VALID'
                      ? 'border border-[#00e599]/40 bg-[#00e599]/10 text-[#00e599]'
                      : diagnostic.statusCode === 401 || diagnostic.tokenValidity === 'INVALID'
                      ? 'border border-rose-500/40 bg-rose-500/10 text-rose-400'
                      : diagnostic.statusCode === 429
                      ? 'border border-amber-500/40 bg-amber-500/10 text-amber-400'
                      : 'border border-neutral-600 bg-neutral-800 text-neutral-300'
                  }`}
                >
                  {diagnostic.tokenConfigured && diagnostic.tokenValidity === 'VALID' ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Authenticated · Personal Quota
                    </>
                  ) : diagnostic.statusCode === 401 || diagnostic.tokenValidity === 'INVALID' ? (
                    <>
                      <XCircle className="h-3 w-3" /> Invalid Token (HTTP 401)
                    </>
                  ) : diagnostic.statusCode === 429 ? (
                    <>
                      <AlertTriangle className="h-3 w-3" /> ZeroGPU Quota Limit (429)
                    </>
                  ) : diagnostic.tokenConfigured ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" /> Token Configured
                    </>
                  ) : (
                    <>
                      <Info className="h-3 w-3" /> Anonymous Public Access
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Diagnostic Details Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2.5">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                  Server HF_TOKEN
                </span>
                <span className="font-mono text-[11px] text-white font-medium">
                  {diagnostic
                    ? diagnostic.tokenConfigured
                      ? diagnostic.tokenValidity === 'VALID'
                        ? 'Configured & Verified'
                        : diagnostic.tokenValidity === 'INVALID'
                        ? 'Configured (Invalid 401)'
                        : 'Configured (Server)'
                      : 'Not Configured (Public Pool)'
                    : 'Checking server...'}
                </span>
              </div>
              <div className="rounded border border-white/[0.04] bg-[#1a1d22] p-2.5">
                <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                  ZeroGPU Quota Type
                </span>
                <span className="font-mono text-[11px] text-[#00e599] font-medium">
                  {diagnostic?.authType === 'PERSONAL_TOKEN'
                    ? 'Personal Account Quota'
                    : 'Shared Anonymous IP Pool'}
                </span>
              </div>
            </div>

            {/* Status Message Feedback */}
            {diagnostic && (
              <div
                className={`rounded border p-2.5 text-xs ${
                  diagnostic.statusCode === 401 || diagnostic.tokenValidity === 'INVALID'
                    ? 'border-rose-500/20 bg-rose-500/5 text-rose-200'
                    : diagnostic.statusCode === 429
                    ? 'border-amber-500/20 bg-amber-500/5 text-amber-200'
                    : diagnostic.success
                    ? 'border-[#00e599]/20 bg-[#00e599]/5 text-neutral-200'
                    : 'border-white/10 bg-white/5 text-neutral-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">
                    {diagnostic.statusCode === 401 || diagnostic.tokenValidity === 'INVALID' ? (
                      <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                    ) : diagnostic.statusCode === 429 ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#00e599] shrink-0" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium leading-relaxed">
                      {diagnostic.sanitizedMessage}
                    </p>
                    {diagnostic.quotaNote && (
                      <p className="text-[10px] text-neutral-400 leading-relaxed">
                        {diagnostic.quotaNote}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action: Test Server Connection Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#20252b] py-2 text-xs font-semibold text-white hover:bg-[#282e36] hover:border-white/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#00e599] ${isTesting ? 'animate-spin' : ''}`} />
                <span>{isTesting ? 'Verifying Server Authentication...' : 'TEST SERVER CONNECTION'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Set Server-Side HF_TOKEN */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-[#00e599]" />
                <span>Configure Server HF_TOKEN</span>
              </span>
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#00e599] hover:underline"
              >
                <span>Get Free Token</span>
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>

            <form onSubmit={handleConfigureServerToken} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  className="flex-1 rounded-lg border border-white/10 bg-[#121417] px-3 py-2 font-mono text-xs text-white placeholder-neutral-500 focus:border-[#00e599] focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={isUpdatingToken || !tokenInput.trim()}
                  className="rounded-lg bg-[#00e599] px-3.5 py-2 text-xs font-semibold text-black hover:bg-[#00ffaa] transition-colors disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{isUpdatingToken ? 'Verifying...' : 'Set Token'}</span>
                </button>
              </div>

              {tokenUpdateMsg && (
                <div
                  className={`rounded p-2 text-xs ${
                    tokenUpdateMsg.success
                      ? 'border border-[#00e599]/30 bg-[#00e599]/10 text-[#00e599]'
                      : 'border border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  {tokenUpdateMsg.message}
                </div>
              )}

              <p className="text-[10px] text-neutral-400 leading-relaxed">
                Tokens are validated with Hugging Face and saved directly to server-side environment storage (<code className="text-[#00e599]">.env</code>). Never stored in browser localStorage or client JavaScript.
              </p>
            </form>
          </div>

          {/* Card 3: Instructions for Netlify Dashboard Deployment */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300 block border-b border-white/[0.06] pb-2">
              Production Netlify Instructions
            </span>

            <ol className="space-y-1.5 text-xs text-neutral-300 list-decimal pl-4">
              <li className="leading-relaxed">
                Create a token at <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-[#00e599] hover:underline">huggingface.co/settings/tokens</a> with role <strong className="text-white">"Read"</strong>.
              </li>
              <li className="leading-relaxed">
                In Netlify Dashboard: <strong className="text-white">Site configuration &gt; Environment variables &gt; Add a variable</strong>.
              </li>
              <li className="leading-relaxed">
                Key: <code className="text-[#00e599] font-mono">HF_TOKEN</code>, Value: your token (<code className="font-mono">hf_...</code>).
              </li>
            </ol>
          </div>

          {/* Card 4: Target Hugging Face Space & Presets */}
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
            </div>

            {/* Quick Space Presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-neutral-500">Presets:</span>
              <button
                type="button"
                onClick={() => setSpaceId('Nymbo/Virtual-Try-On')}
                className={`rounded px-2 py-1 font-mono text-[10px] border transition-colors ${
                  spaceId === 'Nymbo/Virtual-Try-On'
                    ? 'border-[#00e599] bg-[#00e599]/10 text-[#00e599]'
                    : 'border-white/10 bg-[#1a1d22] text-neutral-400 hover:text-white'
                }`}
              >
                Nymbo/Virtual-Try-On (Default)
              </button>
              <button
                type="button"
                onClick={() => setSpaceId('yisol/IDM-VTON')}
                className={`rounded px-2 py-1 font-mono text-[10px] border transition-colors ${
                  spaceId === 'yisol/IDM-VTON'
                    ? 'border-[#00e599] bg-[#00e599]/10 text-[#00e599]'
                    : 'border-white/10 bg-[#1a1d22] text-neutral-400 hover:text-white'
                }`}
              >
                yisol/IDM-VTON (Alt Space)
              </button>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
              <span className="text-[10px] text-neutral-400">
                {isSaved ? <span className="text-[#00e599] font-medium">✓ Space Preference Saved</span> : 'Target Space Preference'}
              </span>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex items-center gap-1.5 rounded-lg bg-[#00e599] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#00ffaa] transition-colors"
              >
                <Save className="h-3 w-3 stroke-[2.5]" />
                <span>SAVE SPACE</span>
              </button>
            </div>
          </div>

          {/* Card 5: Security Guarantee */}
          <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-3 text-[11px] text-neutral-300 space-y-1.5">
            <div className="flex items-center gap-2 text-white font-medium text-xs">
              <ShieldCheck className="h-4 w-4 text-[#00e599]" />
              <span>Strict Server-Side Security</span>
            </div>
            <p className="text-[10px] text-neutral-400 leading-relaxed">
              Your Hugging Face token is stored solely in Netlify server-side environment variables and used exclusively by Netlify Functions. Tokens are never placed in browser storage, client bundles, or API responses.
            </p>
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

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
  Sparkles,
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
}

export interface GeminiDiagnosticData {
  success: boolean;
  hasApiKey: boolean;
  statusCode: number;
  statusText: string;
  sanitizedMessage: string;
}

export const ApiSettingsModal: React.FC<ApiSettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'huggingface' | 'gemini'>('huggingface');
  const [isTestingHf, setIsTestingHf] = useState(false);
  const [diagnosticHf, setDiagnosticHf] = useState<HfDiagnosticData | null>(null);

  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [diagnosticGemini, setDiagnosticGemini] = useState<GeminiDiagnosticData | null>(null);

  const [spaceId, setSpaceId] = useState<string>(() => {
    return localStorage.getItem('mxm_hf_space_id') || 'Nymbo/Virtual-Try-On';
  });
  const [isSaved, setIsSaved] = useState(false);

  // HF Token input
  const [tokenInput, setTokenInput] = useState('');
  const [isUpdatingToken, setIsUpdatingToken] = useState(false);
  const [tokenUpdateMsg, setTokenUpdateMsg] = useState<{ success: boolean; message: string } | null>(null);

  // Gemini API Key input
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [isUpdatingGeminiKey, setIsUpdatingGeminiKey] = useState(false);
  const [geminiKeyUpdateMsg, setGeminiKeyUpdateMsg] = useState<{ success: boolean; message: string } | null>(null);

  // Security guarantee: Purge any legacy client tokens
  useEffect(() => {
    try {
      localStorage.removeItem('mxm_hf_token');
      localStorage.removeItem('gemini_api_key');
      sessionStorage.removeItem('mxm_hf_token');
    } catch {
      // ignore
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

  useEffect(() => {
    if (isOpen) {
      handleTestHfConnection();
      handleTestGeminiConnection();
    }
  }, [isOpen]);

  const handleTestHfConnection = async () => {
    setIsTestingHf(true);
    try {
      const res = await fetch(`/.netlify/functions/hf-diagnostic?spaceId=${encodeURIComponent(spaceId.trim())}`);
      const data: HfDiagnosticData = await res.json();
      setDiagnosticHf(data);
    } catch (err: any) {
      setDiagnosticHf({
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
      });
    } finally {
      setIsTestingHf(false);
    }
  };

  const handleTestGeminiConnection = async () => {
    setIsTestingGemini(true);
    try {
      const res = await fetch('/api/gemini-diagnostic');
      const data: GeminiDiagnosticData = await res.json();
      setDiagnosticGemini(data);
    } catch (err: any) {
      setDiagnosticGemini({
        success: false,
        hasApiKey: false,
        statusCode: 500,
        statusText: 'Failed',
        sanitizedMessage: err?.message || 'Could not connect to Gemini diagnostic endpoint.',
      });
    } finally {
      setIsTestingGemini(false);
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
        setTokenInput('');
        setTokenUpdateMsg({
          success: true,
          message: 'Server HF_TOKEN verified with Hugging Face and saved to server environment.',
        });
        handleTestHfConnection();
      }
    } catch (err: any) {
      setTokenUpdateMsg({ success: false, message: err?.message || 'Network error updating server token.' });
    } finally {
      setIsUpdatingToken(false);
    }
  };

  const handleConfigureServerGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiKeyInput.trim()) return;
    setIsUpdatingGeminiKey(true);
    setGeminiKeyUpdateMsg(null);
    try {
      const res = await fetch('/api/configure-server-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: geminiKeyInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGeminiKeyUpdateMsg({ success: false, message: data.error || 'Failed to configure server API key.' });
      } else {
        setGeminiKeyInput('');
        setGeminiKeyUpdateMsg({
          success: true,
          message: 'Server GEMINI_API_KEY verified with Google AI Studio and saved to server environment.',
        });
        handleTestGeminiConnection();
      }
    } catch (err: any) {
      setGeminiKeyUpdateMsg({ success: false, message: err?.message || 'Network error updating server key.' });
    } finally {
      setIsUpdatingGeminiKey(false);
    }
  };

  const handleSaveSpaceSettings = () => {
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
                Inference Engines &amp; API Keys
              </h2>
              <p className="text-[11px] text-neutral-400">
                Server-side Virtual Try-On &amp; Multi-Category Inpainting Credentials
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

        {/* Provider Tabs */}
        <div className="mt-4 flex rounded-lg border border-white/[0.08] bg-[#16181b] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('huggingface')}
            className={`flex-1 rounded py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'huggingface'
                ? 'bg-[#22272e] text-[#00e599] shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span>Hugging Face (IDM-VTON)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('gemini')}
            className={`flex-1 rounded py-1.5 text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'gemini'
                ? 'bg-[#22272e] text-[#00e599] shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Google Gemini (Shoes/Pants/Acc)</span>
          </button>
        </div>

        {/* Tab 1: Hugging Face ZeroGPU */}
        {activeTab === 'huggingface' && (
          <div className="mt-4 space-y-4">
            {/* Server Authentication Status */}
            <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  ZeroGPU Status
                </span>
                {diagnosticHf && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium ${
                      diagnosticHf.tokenConfigured && diagnosticHf.tokenValidity === 'VALID'
                        ? 'border border-[#00e599]/40 bg-[#00e599]/10 text-[#00e599]'
                        : diagnosticHf.statusCode === 401 || diagnosticHf.tokenValidity === 'INVALID'
                        ? 'border border-rose-500/40 bg-rose-500/10 text-rose-400'
                        : diagnosticHf.statusCode === 429
                        ? 'border border-amber-500/40 bg-amber-500/10 text-amber-400'
                        : 'border border-neutral-600 bg-neutral-800 text-neutral-300'
                    }`}
                  >
                    {diagnosticHf.tokenConfigured && diagnosticHf.tokenValidity === 'VALID' ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Authenticated · Personal Quota
                      </>
                    ) : diagnosticHf.statusCode === 401 || diagnosticHf.tokenValidity === 'INVALID' ? (
                      <>
                        <XCircle className="h-3 w-3" /> Invalid Token (HTTP 401)
                      </>
                    ) : diagnosticHf.statusCode === 429 ? (
                      <>
                        <AlertTriangle className="h-3 w-3" /> ZeroGPU Quota Limit (429)
                      </>
                    ) : diagnosticHf.tokenConfigured ? (
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

              {diagnosticHf && (
                <div className="rounded border p-2.5 text-xs border-white/10 bg-white/5 text-neutral-300">
                  <p className="text-[11px] leading-relaxed">{diagnosticHf.sanitizedMessage}</p>
                </div>
              )}

              <button
                type="button"
                onClick={handleTestHfConnection}
                disabled={isTestingHf}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#20252b] py-2 text-xs font-semibold text-white hover:bg-[#282e36] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#00e599] ${isTestingHf ? 'animate-spin' : ''}`} />
                <span>{isTestingHf ? 'Verifying ZeroGPU...' : 'TEST HUGGING FACE CONNECTION'}</span>
              </button>
            </div>

            {/* Set Server-Side HF_TOKEN */}
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
                    className="rounded-lg bg-[#00e599] px-3.5 py-2 text-xs font-semibold text-black hover:bg-[#00ffaa] transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <span>{isUpdatingToken ? 'Verifying...' : 'Set Token'}</span>
                  </button>
                </div>

                {tokenUpdateMsg && (
                  <div className={`rounded p-2 text-xs ${tokenUpdateMsg.success ? 'bg-[#00e599]/10 text-[#00e599]' : 'bg-rose-500/10 text-rose-300'}`}>
                    {tokenUpdateMsg.message}
                  </div>
                )}
              </form>
            </div>

            {/* Target Space */}
            <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
                Target Space ID
              </span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  placeholder="Nymbo/Virtual-Try-On"
                  className="flex-1 rounded-lg border border-white/10 bg-[#121417] px-3 py-2 font-mono text-xs text-white"
                />
                <button
                  type="button"
                  onClick={handleSaveSpaceSettings}
                  className="rounded-lg bg-[#00e599] px-3 py-2 text-xs font-semibold text-black hover:bg-[#00ffaa]"
                >
                  {isSaved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Google Gemini AI */}
        {activeTab === 'gemini' && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                  Google Gemini API Status
                </span>
                {diagnosticGemini && (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium ${
                      diagnosticGemini.hasApiKey && diagnosticGemini.success
                        ? 'border border-[#00e599]/40 bg-[#00e599]/10 text-[#00e599]'
                        : 'border border-amber-500/40 bg-amber-500/10 text-amber-400'
                    }`}
                  >
                    {diagnosticGemini.hasApiKey && diagnosticGemini.success ? (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Configured &amp; Active
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3" /> Key Not Configured
                      </>
                    )}
                  </span>
                )}
              </div>

              <div className="rounded border border-white/10 bg-white/5 p-2.5 text-xs text-neutral-300">
                <p className="text-[11px] leading-relaxed">
                  Powers genuine AI footwear replacement, accessories placement (hats, glasses, watches, bags), and lower-body pants inpainting.
                </p>
                {diagnosticGemini && (
                  <p className="mt-1 font-mono text-[10px] text-neutral-400">
                    Status: {diagnosticGemini.sanitizedMessage}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleTestGeminiConnection}
                disabled={isTestingGemini}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#20252b] py-2 text-xs font-semibold text-white hover:bg-[#282e36] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 text-[#00e599] ${isTestingGemini ? 'animate-spin' : ''}`} />
                <span>{isTestingGemini ? 'Verifying Gemini...' : 'TEST GEMINI API CONNECTION'}</span>
              </button>
            </div>

            {/* Set Server-Side GEMINI_API_KEY */}
            <div className="rounded-lg border border-white/[0.06] bg-[#16181b] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-[#00e599]" />
                  <span>Configure Server GEMINI_API_KEY</span>
                </span>
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-[#00e599] hover:underline"
                >
                  <span>Get API Key</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>

              <form onSubmit={handleConfigureServerGeminiKey} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={geminiKeyInput}
                    onChange={(e) => setGeminiKeyInput(e.target.value)}
                    placeholder="AIzaSy..."
                    className="flex-1 rounded-lg border border-white/10 bg-[#121417] px-3 py-2 font-mono text-xs text-white placeholder-neutral-500 focus:border-[#00e599] focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingGeminiKey || !geminiKeyInput.trim()}
                    className="rounded-lg bg-[#00e599] px-3.5 py-2 text-xs font-semibold text-black hover:bg-[#00ffaa] transition-colors disabled:opacity-50 whitespace-nowrap"
                  >
                    <span>{isUpdatingGeminiKey ? 'Verifying...' : 'Set Key'}</span>
                  </button>
                </div>

                {geminiKeyUpdateMsg && (
                  <div className={`rounded p-2 text-xs ${geminiKeyUpdateMsg.success ? 'bg-[#00e599]/10 text-[#00e599]' : 'bg-rose-500/10 text-rose-300'}`}>
                    {geminiKeyUpdateMsg.message}
                  </div>
                )}

                <p className="text-[10px] text-neutral-400 leading-relaxed">
                  Keys are stored exclusively in Netlify/server environment variables (<code className="text-[#00e599]">GEMINI_API_KEY</code>). Never exposed to client-side bundles or browser storage.
                </p>
              </form>
            </div>
          </div>
        )}

        {/* Security Guarantee Banner */}
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-[#16181b] p-3 text-[11px] text-neutral-300 space-y-1">
          <div className="flex items-center gap-2 text-white font-medium text-xs">
            <ShieldCheck className="h-4 w-4 text-[#00e599]" />
            <span>Strict Server-Side Key Isolation</span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-relaxed">
            API keys and tokens are restricted to server-side Netlify Functions. No private credentials are ever transmitted to the client browser.
          </p>
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

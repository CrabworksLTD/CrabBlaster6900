import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useSettingsStore } from '../stores/settings-store'
import { Spinner } from '../components/common/Spinner'

export function SettingsPage() {
  const {
    rpcEndpoint, defaultSlippageBps, defaultPriorityFee,
    fetchSettings, setRpcEndpoint, testRpcEndpoint, setSetting
  } = useSettingsStore()

  const [rpcInput, setRpcInput] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; latencyMs: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [slippage, setSlippage] = useState(defaultSlippageBps)
  const [priority, setPriority] = useState(defaultPriorityFee)

  useEffect(() => { fetchSettings() }, [fetchSettings])
  useEffect(() => {
    setRpcInput(rpcEndpoint); setSlippage(defaultSlippageBps); setPriority(defaultPriorityFee)
  }, [rpcEndpoint, defaultSlippageBps, defaultPriorityFee])

  const handleTestRpc = async () => {
    setTesting(true); setTestResult(null)
    try {
      const result = await testRpcEndpoint(rpcInput)
      setTestResult(result)
      toast[result.ok ? 'success' : 'error'](result.ok ? `Connected (${result.latencyMs}ms)` : 'Connection failed')
    } catch { setTestResult({ ok: false, latencyMs: -1 }); toast.error('Connection failed') }
    setTesting(false)
  }

  const handleSaveRpc = async () => {
    setSaving(true)
    try { await setRpcEndpoint(rpcInput); toast.success('RPC endpoint saved') } catch (err: any) { toast.error(err?.message || 'Failed') }
    setSaving(false)
  }

  const handleSaveDefaults = async () => {
    setSaving(true)
    try {
      await setSetting('default_slippage_bps', slippage.toString())
      await setSetting('default_priority_fee', priority.toString())
      toast.success('Defaults saved')
    } catch (err: any) { toast.error(err?.message || 'Failed') }
    setSaving(false)
  }

  return (
    <div className="space-y-3 max-w-lg">
      {/* RPC */}
      <div className="win-groupbox">
        <span className="win-groupbox-label">RPC Endpoint</span>
        <div className="mt-2 space-y-2">
          <div>
            <label className="label">Endpoint URL:</label>
            <div className="flex gap-1">
              <input className="input flex-1" value={rpcInput} onChange={(e) => { setRpcInput(e.target.value); setTestResult(null) }} placeholder="https://api.mainnet-beta.solana.com" />
              <button onClick={handleTestRpc} disabled={testing || !rpcInput} className="btn-secondary">
                {testing ? <Spinner /> : 'Test'}
              </button>
            </div>
          </div>
          {testResult && (
            <p className={`text-[11px] ${testResult.ok ? 'text-success' : 'text-danger'}`}>
              {testResult.ok ? `OK - ${testResult.latencyMs}ms latency` : 'FAILED - Could not connect'}
            </p>
          )}
          <button onClick={handleSaveRpc} disabled={saving || !rpcInput} className="btn-primary">
            {saving ? <Spinner /> : 'Save'}
          </button>
        </div>
      </div>

      {/* Defaults */}
      <div className="win-groupbox">
        <span className="win-groupbox-label">Default Trading Settings</span>
        <div className="mt-2 space-y-2">
          <div>
            <label className="label">Default Slippage: {slippage / 100}%</label>
            <input type="range" className="w-full" value={slippage} onChange={(e) => setSlippage(parseInt(e.target.value))} min={50} max={5000} step={50} />
          </div>
          <div>
            <label className="label">Default Priority Fee (microLamports):</label>
            <input type="number" className="input" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)} min={0} />
          </div>
          <button onClick={handleSaveDefaults} disabled={saving} className="btn-primary">
            {saving ? <Spinner /> : 'Save Defaults'}
          </button>
        </div>
      </div>

      {/* Security */}
      <div className="win-groupbox">
        <span className="win-groupbox-label">Security Information</span>
        <div className="mt-2 shadow-win-field bg-white p-2 text-[11px] space-y-1">
          <p>Private keys encrypted via OS Keychain (Electron safeStorage API).</p>
          <p>Keys decrypted only in main process for transaction signing.</p>
          <p>Renderer: contextIsolation=true, sandbox=true, nodeIntegration=false.</p>
        </div>
      </div>
    </div>
  )
}

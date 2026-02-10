import { useEffect, useState } from 'react'
import { Wallet, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useWalletStore } from '../stores/wallet-store'
import { Modal } from '../components/common/Modal'
import { EmptyState } from '../components/common/EmptyState'
import { Spinner } from '../components/common/Spinner'

export function WalletsPage() {
  const {
    wallets,
    loading,
    fetchWallets,
    importWallet,
    generateWallets,
    deleteWallet,
    fundWallets,
    reclaimWallets,
    refreshBalances
  } = useWalletStore()

  const [showImport, setShowImport] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showFund, setShowFund] = useState(false)
  const [showReclaim, setShowReclaim] = useState(false)

  const [importKey, setImportKey] = useState('')
  const [importLabel, setImportLabel] = useState('')
  const [genCount, setGenCount] = useState(5)
  const [genPrefix, setGenPrefix] = useState('Sub')
  const [fundAmount, setFundAmount] = useState('0.01')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  const mainWallet = wallets.find((w) => w.isMain)
  const subWallets = wallets.filter((w) => !w.isMain)

  const handleImport = async () => {
    setProcessing(true)
    try {
      await importWallet(importKey, importLabel)
      toast.success('Wallet imported successfully')
      setShowImport(false)
      setImportKey('')
      setImportLabel('')
    } catch (err: any) {
      toast.error(err?.message || 'Import failed')
    }
    setProcessing(false)
  }

  const handleGenerate = async () => {
    setProcessing(true)
    try {
      await generateWallets(genCount, genPrefix)
      toast.success(`Generated ${genCount} wallets`)
      setShowGenerate(false)
    } catch (err: any) {
      toast.error(err?.message || 'Generation failed')
    }
    setProcessing(false)
  }

  const handleFund = async () => {
    if (!mainWallet) return
    setProcessing(true)
    try {
      await fundWallets(mainWallet.id, subWallets.map((w) => w.id), parseFloat(fundAmount))
      toast.success('Wallets funded successfully')
      setShowFund(false)
    } catch (err: any) {
      toast.error(err?.message || 'Funding failed')
    }
    setProcessing(false)
  }

  const handleReclaim = async () => {
    if (!mainWallet) return
    setProcessing(true)
    try {
      await reclaimWallets(subWallets.map((w) => w.id), mainWallet.id)
      toast.success('SOL reclaimed successfully')
      setShowReclaim(false)
    } catch (err: any) {
      toast.error(err?.message || 'Reclaim failed')
    }
    setProcessing(false)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="shadow-win-out bg-win-bg p-1 flex gap-1">
        <button onClick={() => refreshBalances()} className="btn-secondary" disabled={loading}>
          {loading ? <Spinner /> : 'Refresh'}
        </button>
        <button onClick={() => setShowImport(true)} className="btn-secondary">
          Import Main
        </button>
        <button onClick={() => setShowGenerate(true)} className="btn-secondary">
          Generate Subs
        </button>
        <div className="flex-1" />
        {subWallets.length > 0 && mainWallet && (
          <>
            <button onClick={() => setShowFund(true)} className="btn-secondary">
              Fund All
            </button>
            <button onClick={() => setShowReclaim(true)} className="btn-danger">
              Reclaim All
            </button>
          </>
        )}
      </div>

      {/* Main Wallet */}
      <div className="win-groupbox">
        <span className="win-groupbox-label">Main Wallet</span>
        <div className="mt-2">
          {mainWallet ? (
            <div className="shadow-win-field bg-white p-2 flex items-center justify-between">
              <div className="text-[11px]">
                <span className="font-bold">{mainWallet.label}</span>
                <span
                  className="font-sys text-[10px] ml-2 cursor-pointer hover:underline text-win-blue"
                  onClick={() => handleCopy(mainWallet.publicKey)}
                >
                  {mainWallet.publicKey.slice(0, 8)}...{mainWallet.publicKey.slice(-8)}
                </span>
              </div>
              <span className="font-sys text-[11px] font-bold">
                {mainWallet.balanceSol.toFixed(4)} SOL
              </span>
            </div>
          ) : (
            <p className="text-[11px] text-win-dark p-2">
              No main wallet.{' '}
              <button onClick={() => setShowImport(true)} className="text-win-blue underline cursor-pointer">
                Import one
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Sub Wallets */}
      <div className="win-groupbox">
        <span className="win-groupbox-label">Sub-Wallets ({subWallets.length})</span>
        <div className="mt-2">
          {subWallets.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No sub-wallets"
              description="Generate sub-wallets for the bundle and volume bots."
              action={{ label: 'Generate Wallets', onClick: () => setShowGenerate(true) }}
            />
          ) : (
            <div className="shadow-win-field bg-white max-h-[350px] overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-win-bg sticky top-0">
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">#</th>
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Label</th>
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Address</th>
                    <th className="text-right px-1 py-0.5 font-normal border-b border-win-dark">Balance</th>
                    <th className="text-center px-1 py-0.5 font-normal border-b border-win-dark">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subWallets.map((wallet, i) => (
                    <tr
                      key={wallet.id}
                      className={`${i % 2 === 0 ? 'bg-white' : 'bg-win-mid'} hover:bg-win-blue hover:text-white group`}
                    >
                      <td className="px-1 py-0.5">{i + 1}</td>
                      <td className="px-1 py-0.5">{wallet.label}</td>
                      <td
                        className="px-1 py-0.5 font-sys text-[10px] cursor-pointer"
                        onClick={() => handleCopy(wallet.publicKey)}
                      >
                        {wallet.publicKey.slice(0, 6)}...{wallet.publicKey.slice(-6)}
                      </td>
                      <td className="px-1 py-0.5 text-right font-sys text-[10px]">
                        {wallet.balanceSol.toFixed(4)}
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        <button
                          onClick={() => {
                            deleteWallet(wallet.id)
                            toast.success('Wallet deleted')
                          }}
                          className="text-[10px] text-danger group-hover:text-white hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Import Modal */}
      <Modal open={showImport} onClose={() => setShowImport(false)} title="Import Main Wallet">
        <div className="space-y-3">
          <div>
            <label className="label">Label:</label>
            <input className="input" value={importLabel} onChange={(e) => setImportLabel(e.target.value)} placeholder="Main Wallet" />
          </div>
          <div>
            <label className="label">Secret Key (Base58):</label>
            <input type="password" className="input" value={importKey} onChange={(e) => setImportKey(e.target.value)} placeholder="Enter base58 secret key" />
          </div>
          <p className="text-[10px] text-win-dark">Your key is encrypted via OS Keychain.</p>
          <div className="flex justify-end gap-1 pt-1">
            <button onClick={() => setShowImport(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleImport} disabled={!importKey || !importLabel || processing} className="btn-primary">
              {processing ? <Spinner /> : 'OK'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Generate Modal */}
      <Modal open={showGenerate} onClose={() => setShowGenerate(false)} title="Generate Sub-Wallets">
        <div className="space-y-3">
          <div>
            <label className="label">Number of Wallets:</label>
            <input type="number" className="input" value={genCount} onChange={(e) => setGenCount(parseInt(e.target.value) || 1)} min={1} max={50} />
          </div>
          <div>
            <label className="label">Label Prefix:</label>
            <input className="input" value={genPrefix} onChange={(e) => setGenPrefix(e.target.value)} placeholder="Sub" />
          </div>
          <div className="flex justify-end gap-1 pt-1">
            <button onClick={() => setShowGenerate(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleGenerate} disabled={processing} className="btn-primary">
              {processing ? <Spinner /> : 'OK'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Fund Modal */}
      <Modal open={showFund} onClose={() => setShowFund(false)} title="Fund Sub-Wallets">
        <div className="space-y-3">
          <div>
            <label className="label">SOL per Wallet:</label>
            <input type="number" className="input" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} step="0.001" min="0.001" />
          </div>
          <p className="text-[11px] text-win-dark">
            Total: ~{(parseFloat(fundAmount || '0') * subWallets.length).toFixed(4)} SOL for {subWallets.length} wallets
          </p>
          <div className="flex justify-end gap-1 pt-1">
            <button onClick={() => setShowFund(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleFund} disabled={processing || !mainWallet} className="btn-primary">
              {processing ? <Spinner /> : 'OK'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reclaim Modal */}
      <Modal open={showReclaim} onClose={() => setShowReclaim(false)} title="Reclaim SOL">
        <div className="space-y-3">
          <p className="text-[11px]">
            Send all SOL (minus tx fees) from {subWallets.length} sub-wallets back to the main wallet?
          </p>
          <div className="flex justify-end gap-1 pt-1">
            <button onClick={() => setShowReclaim(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleReclaim} disabled={processing || !mainWallet} className="btn-primary">
              {processing ? <Spinner /> : 'OK'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

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
    fundWalletsRandom,
    fundWalletsHopped,
    reclaimWallets,
    sellTokens,
    refreshBalances
  } = useWalletStore()

  const [showImport, setShowImport] = useState(false)
  const [showGenerate, setShowGenerate] = useState(false)
  const [showFund, setShowFund] = useState(false)
  const [showReclaim, setShowReclaim] = useState(false)
  const [showSell, setShowSell] = useState(false)

  const [importKey, setImportKey] = useState('')
  const [importLabel, setImportLabel] = useState('')
  const [genCount, setGenCount] = useState(5)
  const [genPrefix, setGenPrefix] = useState('Sub')
  const [fundAmount, setFundAmount] = useState('0.01')
  const [randomize, setRandomize] = useState(false)
  const [useHops, setUseHops] = useState(false)
  const [totalBudget, setTotalBudget] = useState('0.1')
  const [randomAllocations, setRandomAllocations] = useState<{ walletId: string; label: string; amountSol: number }[]>([])
  const [processing, setProcessing] = useState(false)

  // Sell state
  const [sellMint, setSellMint] = useState('')
  const [sellDex, setSellDex] = useState<'jupiter' | 'raydium' | 'pumpfun' | 'bonk' | 'bags'>('jupiter')
  const [sellSlippage, setSellSlippage] = useState('300')
  const [sellWalletIds, setSellWalletIds] = useState<string[]>([])
  const [sellMode, setSellMode] = useState<'all' | 'selected'>('all')

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

  const generateRandomAllocations = () => {
    const budget = parseFloat(totalBudget || '0')
    if (budget <= 0 || subWallets.length === 0) return

    // Generate random weights with ±30% variance around the mean for organic-looking but bounded amounts
    const weights = subWallets.map(() => 0.7 + Math.random() * 0.6)
    const totalWeight = weights.reduce((a, b) => a + b, 0)

    const allocs = subWallets.map((w, i) => ({
      walletId: w.id,
      label: w.label,
      amountSol: parseFloat((budget * weights[i] / totalWeight).toFixed(6))
    }))

    // Fix rounding so total matches budget exactly
    const allocTotal = allocs.reduce((a, b) => a + b.amountSol, 0)
    const diff = parseFloat((budget - allocTotal).toFixed(6))
    if (allocs.length > 0) allocs[0].amountSol = parseFloat((allocs[0].amountSol + diff).toFixed(6))

    setRandomAllocations(allocs)
  }

  const handleFund = async () => {
    if (!mainWallet) return
    setProcessing(true)
    try {
      const allocations = randomize && randomAllocations.length > 0
        ? randomAllocations.map((a) => ({ walletId: a.walletId, amountSol: a.amountSol }))
        : subWallets.map((w) => ({ walletId: w.id, amountSol: parseFloat(fundAmount) }))

      if (useHops) {
        await fundWalletsHopped(mainWallet.id, allocations)
      } else if (randomize && randomAllocations.length > 0) {
        await fundWalletsRandom(mainWallet.id, allocations)
      } else {
        await fundWallets(mainWallet.id, subWallets.map((w) => w.id), parseFloat(fundAmount))
      }
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

  const openSellModal = (walletIds?: string[]) => {
    if (walletIds) {
      setSellMode('selected')
      setSellWalletIds(walletIds)
    } else {
      setSellMode('all')
      setSellWalletIds(subWallets.map((w) => w.id))
    }
    setShowSell(true)
  }

  const handleSell = async () => {
    if (sellWalletIds.length === 0 || !sellMint) return
    setProcessing(true)
    try {
      const result = await sellTokens(
        sellWalletIds,
        sellMint,
        sellDex,
        parseInt(sellSlippage) || 300
      )
      const confirmed = result.results.filter((r: any) => r.status === 'confirmed').length
      const failed = result.results.filter((r: any) => r.status === 'failed').length
      const skipped = result.results.filter((r: any) => r.status === 'skipped').length
      if (confirmed > 0) {
        toast.success(`Sold from ${confirmed} wallet(s)${failed > 0 ? `, ${failed} failed` : ''}${skipped > 0 ? `, ${skipped} skipped (no tokens)` : ''}`)
      } else if (skipped === result.results.length) {
        toast.warning('No wallets had tokens to sell')
      } else {
        toast.error('All sells failed')
      }
      setShowSell(false)
    } catch (err: any) {
      toast.error(err?.message || 'Sell failed')
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
        {subWallets.length > 0 && (
          <>
            <button onClick={() => openSellModal()} className="btn-danger">
              Sell All
            </button>
            {mainWallet && (
              <>
                <button onClick={() => setShowFund(true)} className="btn-secondary">
                  Fund All
                </button>
                <button onClick={() => setShowReclaim(true)} className="btn-secondary">
                  Reclaim All
                </button>
              </>
            )}
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
                      <td className="px-1 py-0.5 text-center space-x-2">
                        <button
                          onClick={() => openSellModal([wallet.id])}
                          className="text-[10px] text-win-blue group-hover:text-white hover:underline"
                        >
                          Sell
                        </button>
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
          <label className="flex items-center gap-2 text-[11px] cursor-default">
            <input type="checkbox" checked={randomize} onChange={(e) => { setRandomize(e.target.checked); setRandomAllocations([]) }} />
            Randomize amounts (makes wallets look organic)
          </label>

          <label className="flex items-center gap-2 text-[11px] cursor-default">
            <input type="checkbox" checked={useHops} onChange={(e) => setUseHops(e.target.checked)} />
            Use hop wallets (anti-linking)
          </label>
          {useHops && (
            <p className="text-[10px] text-win-dark ml-5">
              Routes through ephemeral intermediate wallets so sub-wallets can't be traced to the same source. Takes longer due to extra transfers.
            </p>
          )}

          {randomize ? (
            <>
              <div>
                <label className="label">Total SOL Budget:</label>
                <input type="number" className="input" value={totalBudget} onChange={(e) => { setTotalBudget(e.target.value); setRandomAllocations([]) }} step="0.01" min="0.001" />
              </div>
              <button onClick={generateRandomAllocations} className="btn-secondary w-full">
                Shuffle Amounts
              </button>
              {randomAllocations.length > 0 && (
                <div className="shadow-win-field bg-white max-h-[180px] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-win-bg sticky top-0">
                        <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Wallet</th>
                        <th className="text-right px-1 py-0.5 font-normal border-b border-win-dark">SOL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {randomAllocations.map((a, i) => (
                        <tr key={a.walletId} className={i % 2 === 0 ? 'bg-white' : 'bg-win-mid'}>
                          <td className="px-1 py-0.5">{a.label}</td>
                          <td className="px-1 py-0.5 text-right font-sys text-[10px]">{a.amountSol.toFixed(6)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-win-dark">
                Total: {randomAllocations.length > 0 ? randomAllocations.reduce((a, b) => a + b.amountSol, 0).toFixed(4) : parseFloat(totalBudget || '0').toFixed(4)} SOL for {subWallets.length} wallets
              </p>
            </>
          ) : (
            <>
              <div>
                <label className="label">SOL per Wallet:</label>
                <input type="number" className="input" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} step="0.001" min="0.001" />
              </div>
              <p className="text-[11px] text-win-dark">
                Total: ~{(parseFloat(fundAmount || '0') * subWallets.length).toFixed(4)} SOL for {subWallets.length} wallets
              </p>
            </>
          )}

          <div className="flex justify-end gap-1 pt-1">
            <button onClick={() => setShowFund(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleFund} disabled={processing || !mainWallet || (randomize && randomAllocations.length === 0)} className="btn-primary">
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

      {/* Sell Modal */}
      <Modal open={showSell} onClose={() => setShowSell(false)} title="Sell Tokens">
        <div className="space-y-3">
          <p className="text-[11px] text-win-dark">
            Sell all token holdings from {sellMode === 'all' ? `${sellWalletIds.length} sub-wallets` : '1 wallet'} back to SOL.
          </p>

          <div>
            <label className="label">Token Mint Address:</label>
            <input
              className="input"
              value={sellMint}
              onChange={(e) => setSellMint(e.target.value.trim())}
              placeholder="e.g. EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            />
          </div>

          <div>
            <label className="label">DEX:</label>
            <select
              className="input"
              value={sellDex}
              onChange={(e) => setSellDex(e.target.value as 'jupiter' | 'raydium' | 'pumpfun' | 'bonk' | 'bags')}
            >
              <option value="jupiter">Jupiter (Recommended)</option>
              <option value="raydium">Raydium</option>
              <option value="pumpfun">Pump.fun (Bonding Curve)</option>
              <option value="bonk">LetsBONK.fun</option>
              <option value="bags">Bags.fm</option>
            </select>
          </div>

          <div>
            <label className="label">Slippage (BPS):</label>
            <input
              type="number"
              className="input"
              value={sellSlippage}
              onChange={(e) => setSellSlippage(e.target.value)}
              min="1"
              max="5000"
              step="50"
            />
            <p className="text-[10px] text-win-dark mt-0.5">
              {((parseInt(sellSlippage) || 0) / 100).toFixed(1)}% slippage tolerance
            </p>
          </div>

          {sellMode === 'all' && subWallets.length > 1 && (
            <div className="shadow-win-field bg-white max-h-[120px] overflow-y-auto">
              <table className="w-full text-[10px]">
                <tbody>
                  {subWallets.filter((w) => sellWalletIds.includes(w.id)).map((w, i) => (
                    <tr key={w.id} className={i % 2 === 0 ? 'bg-white' : 'bg-win-mid'}>
                      <td className="px-1 py-0.5">{w.label}</td>
                      <td className="px-1 py-0.5 text-right font-sys">{w.publicKey.slice(0, 6)}...{w.publicKey.slice(-4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-1 pt-1">
            <button onClick={() => setShowSell(false)} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSell}
              disabled={processing || !sellMint || sellWalletIds.length === 0}
              className="btn-primary"
            >
              {processing ? <Spinner /> : `Sell from ${sellWalletIds.length} Wallet${sellWalletIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

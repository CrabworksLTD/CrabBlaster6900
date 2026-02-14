import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useWalletStore } from '../stores/wallet-store'
import { useBotStore } from '../stores/bot-store'
import { useSettingsStore } from '../stores/settings-store'
import type { BundleBotConfig, VolumeBotConfig, CopyTradeBotConfig, DexType, AmountMode } from '@shared/types'
import {
  DEFAULT_COPYTRADE_POLL_INTERVAL_MS,
  DEFAULT_COPYTRADE_DELAY_MS,
  DEFAULT_COPYTRADE_FIXED_AMOUNT_SOL,
  PLATFORM_FEE_PCT
} from '@shared/constants'

type TabMode = 'bundle' | 'volume' | 'copytrade'

export function BotConfigPage() {
  const { wallets, fetchWallets } = useWalletStore()
  const { startBot } = useBotStore()
  const { defaultSlippageBps, defaultPriorityFee, fetchSettings } = useSettingsStore()

  const [tab, setTab] = useState<TabMode>('bundle')

  // Shared
  const [tokenMint, setTokenMint] = useState('')
  const [dex, setDex] = useState<DexType>('jupiter')
  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([])
  const [slippageBps, setSlippageBps] = useState(defaultSlippageBps)
  const [priorityFee, setPriorityFee] = useState(defaultPriorityFee)

  // Bundle
  const [direction, setDirection] = useState<'buy' | 'sell'>('buy')
  const [amountSol, setAmountSol] = useState('0.01')
  const [useMaxAmount, setUseMaxAmount] = useState(false)
  const [rounds, setRounds] = useState(1)
  const [delayBetweenRounds, setDelayBetweenRounds] = useState(1000)
  const [staggerDelay, setStaggerDelay] = useState(3000)

  // Volume
  const [buyAmountSol, setBuyAmountSol] = useState('0.01')
  const [sellPercentage, setSellPercentage] = useState(100)
  const [minDelay, setMinDelay] = useState(3000)
  const [maxDelay, setMaxDelay] = useState(10000)
  const [maxRounds, setMaxRounds] = useState(10)

  // Copy Trade
  const [targetWallet, setTargetWallet] = useState('')
  const [amountMode, setAmountMode] = useState<AmountMode>('fixed')
  const [fixedAmountSol, setFixedAmountSol] = useState(DEFAULT_COPYTRADE_FIXED_AMOUNT_SOL.toString())
  const [copyBuys, setCopyBuys] = useState(true)
  const [copySells, setCopySells] = useState(true)
  const [copyDelayMs, setCopyDelayMs] = useState(DEFAULT_COPYTRADE_DELAY_MS)
  const [pollIntervalMs, setPollIntervalMs] = useState(DEFAULT_COPYTRADE_POLL_INTERVAL_MS)

  useEffect(() => { fetchWallets(); fetchSettings() }, [fetchWallets, fetchSettings])
  useEffect(() => { setSlippageBps(defaultSlippageBps); setPriorityFee(defaultPriorityFee) }, [defaultSlippageBps, defaultPriorityFee])

  const subWallets = wallets.filter((w) => !w.isMain)

  const toggleWallet = (id: string) => {
    setSelectedWalletIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])
  }

  const handleStart = async () => {
    if (selectedWalletIds.length === 0) { toast.error('Select at least one wallet'); return }

    try {
      if (tab === 'bundle') {
        if (!tokenMint) { toast.error('Enter a token mint address'); return }
        const config: BundleBotConfig = {
          mode: 'bundle', tokenMint, dex, walletIds: selectedWalletIds, direction,
          amountSol: useMaxAmount ? 0 : parseFloat(amountSol), useMaxAmount, slippageBps, rounds,
          delayBetweenRoundsMs: delayBetweenRounds, priorityFeeMicroLamports: priorityFee,
          staggerDelayMs: staggerDelay
        }
        await startBot(config)
        toast.success('Bundle bot started!')
      } else if (tab === 'volume') {
        if (!tokenMint) { toast.error('Enter a token mint address'); return }
        const config: VolumeBotConfig = {
          mode: 'volume', tokenMint, dex, walletIds: selectedWalletIds,
          buyAmountSol: parseFloat(buyAmountSol), sellPercentage, slippageBps,
          minDelayMs: minDelay, maxDelayMs: maxDelay, maxRounds,
          priorityFeeMicroLamports: priorityFee
        }
        await startBot(config)
        toast.success('Volume bot started!')
      } else {
        if (!targetWallet) { toast.error('Enter a target wallet address'); return }
        if (!copyBuys && !copySells) { toast.error('Enable at least one of copy buys/sells'); return }
        const config: CopyTradeBotConfig = {
          mode: 'copytrade', targetWallet, dex, walletIds: selectedWalletIds,
          slippageBps, priorityFeeMicroLamports: priorityFee,
          amountMode, fixedAmountSol: parseFloat(fixedAmountSol),
          copyBuys, copySells, copyDelayMs, pollIntervalMs
        }
        await startBot(config)
        toast.success('Copy trade bot started!')
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to start bot')
    }
  }

  const startButtonLabel = tab === 'bundle' ? 'Bundle' : tab === 'volume' ? 'Volume' : 'Copy Trade'
  const canStart = tab === 'copytrade'
    ? targetWallet && selectedWalletIds.length > 0
    : tokenMint && selectedWalletIds.length > 0

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex border-b border-win-dark">
        <button
          onClick={() => setTab('bundle')}
          className={tab === 'bundle' ? 'win-tab-active' : 'win-tab'}
        >
          Bundle Bot
        </button>
        <button
          onClick={() => setTab('volume')}
          className={tab === 'volume' ? 'win-tab-active' : 'win-tab'}
        >
          Volume Bot
        </button>
        <button
          onClick={() => setTab('copytrade')}
          className={tab === 'copytrade' ? 'win-tab-active' : 'win-tab'}
        >
          Copy Trade
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Left — Config */}
        <div className="space-y-3">
          {tab === 'copytrade' ? (
            <>
              {/* Target Wallet */}
              <div className="win-groupbox">
                <span className="win-groupbox-label">Target Wallet</span>
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="label">Wallet Address to Copy:</label>
                    <input
                      className="input"
                      value={targetWallet}
                      onChange={(e) => setTargetWallet(e.target.value)}
                      placeholder="Enter Solana wallet address"
                    />
                  </div>
                  <p className="text-[10px] text-win-dark">
                    Observe-only — watches this wallet's swaps and replicates them with your sub-wallets.
                  </p>
                  <div>
                    <label className="label">DEX for Replication:</label>
                    <select className="select" value={dex} onChange={(e) => setDex(e.target.value as DexType)}>
                      <option value="jupiter">Jupiter (Aggregator)</option>
                      <option value="raydium">Raydium</option>
                      <option value="pumpfun">Pump.fun</option>
                      <option value="bonk">LetsBONK.fun</option>
                      <option value="bags">Bags.fm</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Copy Settings */}
              <div className="win-groupbox">
                <span className="win-groupbox-label">Copy Settings</span>
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="label">Amount Mode:</label>
                    <select className="select" value={amountMode} onChange={(e) => setAmountMode(e.target.value as AmountMode)}>
                      <option value="fixed">Fixed SOL per wallet</option>
                      <option value="proportional">Proportional to detected</option>
                    </select>
                  </div>
                  {amountMode === 'fixed' && (
                    <div>
                      <label className="label">Fixed Amount (SOL per wallet):</label>
                      <input type="number" className="input" value={fixedAmountSol} onChange={(e) => setFixedAmountSol(e.target.value)} step="0.001" min="0.001" />
                    </div>
                  )}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1 text-[11px] cursor-default">
                      <input type="checkbox" checked={copyBuys} onChange={(e) => setCopyBuys(e.target.checked)} />
                      Copy Buys
                    </label>
                    <label className="flex items-center gap-1 text-[11px] cursor-default">
                      <input type="checkbox" checked={copySells} onChange={(e) => setCopySells(e.target.checked)} />
                      Copy Sells
                    </label>
                  </div>
                  <div>
                    <label className="label">Poll Interval: {(pollIntervalMs / 1000).toFixed(1)}s</label>
                    <input type="range" className="w-full" value={pollIntervalMs} onChange={(e) => setPollIntervalMs(parseInt(e.target.value))} min={1000} max={30000} step={500} />
                  </div>
                  <div>
                    <label className="label">Copy Delay: {(copyDelayMs / 1000).toFixed(1)}s</label>
                    <input type="range" className="w-full" value={copyDelayMs} onChange={(e) => setCopyDelayMs(parseInt(e.target.value))} min={0} max={30000} step={500} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Token & DEX */}
              <div className="win-groupbox">
                <span className="win-groupbox-label">Token & DEX</span>
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="label">Token Mint Address:</label>
                    <input className="input" value={tokenMint} onChange={(e) => setTokenMint(e.target.value)} placeholder="Enter Solana token mint" />
                  </div>
                  <div>
                    <label className="label">DEX:</label>
                    <select className="select" value={dex} onChange={(e) => setDex(e.target.value as DexType)}>
                      <option value="jupiter">Jupiter (Aggregator)</option>
                      <option value="raydium">Raydium</option>
                      <option value="pumpfun">Pump.fun</option>
                      <option value="bonk">LetsBONK.fun</option>
                      <option value="bags">Bags.fm</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Mode Settings */}
              <div className="win-groupbox">
                <span className="win-groupbox-label">{tab === 'bundle' ? 'Bundle Settings' : 'Volume Settings'}</span>
                <div className="mt-2 space-y-2">
                  {tab === 'bundle' ? (
                    <>
                      <div>
                        <label className="label">Direction:</label>
                        <select className="select" value={direction} onChange={(e) => setDirection(e.target.value as 'buy' | 'sell')}>
                          <option value="buy">Buy</option>
                          <option value="sell">Sell</option>
                        </select>
                      </div>
                      <div>
                        <label className="label">Amount (SOL per wallet):</label>
                        {!useMaxAmount && (
                          <input type="number" className="input" value={amountSol} onChange={(e) => setAmountSol(e.target.value)} step="0.001" min="0.001" />
                        )}
                        <label className="flex items-center gap-1 text-[11px] cursor-default mt-1">
                          <input type="checkbox" checked={useMaxAmount} onChange={(e) => setUseMaxAmount(e.target.checked)} />
                          Max Buy — each wallet spends its full balance
                        </label>
                        {useMaxAmount && (
                          <p className="text-[10px] text-win-dark mt-0.5">Reserves ~0.005 SOL per wallet for sell tx fees.</p>
                        )}
                      </div>
                      <div>
                        <label className="label">Rounds:</label>
                        <input type="number" className="input" value={rounds} onChange={(e) => setRounds(parseInt(e.target.value) || 1)} min={1} max={1000} />
                      </div>
                      <div>
                        <label className="label">Delay Between Rounds (ms):</label>
                        <input type="number" className="input" value={delayBetweenRounds} onChange={(e) => setDelayBetweenRounds(parseInt(e.target.value) || 0)} min={0} />
                      </div>
                      <div>
                        <label className="label">Stagger Between Wallets (ms): {staggerDelay === 0 ? 'OFF — parallel' : `${(staggerDelay / 1000).toFixed(1)}s`}</label>
                        <input type="range" className="w-full" value={staggerDelay} onChange={(e) => setStaggerDelay(parseInt(e.target.value))} min={0} max={15000} step={500} />
                        <p className="text-[10px] text-win-dark mt-0.5">Delays trades between wallets so they don't land in the same block. Prevents on-chain linking.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="label">Buy Amount (SOL):</label>
                        <input type="number" className="input" value={buyAmountSol} onChange={(e) => setBuyAmountSol(e.target.value)} step="0.001" min="0.001" />
                      </div>
                      <div>
                        <label className="label">Sell Percentage: {sellPercentage}%</label>
                        <input type="range" className="w-full" value={sellPercentage} onChange={(e) => setSellPercentage(parseInt(e.target.value))} min={50} max={100} step={5} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="label">Min Delay (ms):</label>
                          <input type="number" className="input" value={minDelay} onChange={(e) => setMinDelay(parseInt(e.target.value) || 0)} min={0} />
                        </div>
                        <div>
                          <label className="label">Max Delay (ms):</label>
                          <input type="number" className="input" value={maxDelay} onChange={(e) => setMaxDelay(parseInt(e.target.value) || 0)} min={0} />
                        </div>
                      </div>
                      <div>
                        <label className="label">Max Rounds (0 = unlimited):</label>
                        <input type="number" className="input" value={maxRounds} onChange={(e) => setMaxRounds(parseInt(e.target.value) || 0)} min={0} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Advanced — shared across all tabs */}
          <div className="win-groupbox">
            <span className="win-groupbox-label">Advanced</span>
            <div className="mt-2 space-y-2">
              <div>
                <label className="label">Slippage: {slippageBps / 100}%</label>
                <input type="range" className="w-full" value={slippageBps} onChange={(e) => setSlippageBps(parseInt(e.target.value))} min={50} max={5000} step={50} />
              </div>
              <div>
                <label className="label">Priority Fee (microLamports):</label>
                <input type="number" className="input" value={priorityFee} onChange={(e) => setPriorityFee(parseInt(e.target.value) || 0)} min={0} />
              </div>
            </div>
          </div>
        </div>

        {/* Right — Wallets + Start */}
        <div className="space-y-3">
          <div className="win-groupbox">
            <span className="win-groupbox-label">
              Select Wallets ({selectedWalletIds.length}/{subWallets.length})
            </span>
            <div className="mt-2">
              <div className="flex gap-2 mb-1">
                <button onClick={() => setSelectedWalletIds(subWallets.map((w) => w.id))} className="text-[10px] text-win-blue underline cursor-pointer">
                  Select All
                </button>
                <button onClick={() => setSelectedWalletIds([])} className="text-[10px] text-win-blue underline cursor-pointer">
                  Clear
                </button>
              </div>

              {subWallets.length === 0 ? (
                <p className="text-[11px] text-win-dark p-2">No sub-wallets. Generate some first.</p>
              ) : (
                <div className="shadow-win-field bg-white max-h-[400px] overflow-y-auto">
                  {subWallets.map((wallet, i) => (
                    <label
                      key={wallet.id}
                      className={`flex items-center gap-2 px-1 py-0.5 text-[11px] cursor-default ${
                        selectedWalletIds.includes(wallet.id)
                          ? 'bg-win-blue text-white'
                          : i % 2 === 0 ? 'bg-white' : 'bg-win-mid'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedWalletIds.includes(wallet.id)}
                        onChange={() => toggleWallet(wallet.id)}
                      />
                      <span className="flex-1">{wallet.label}</span>
                      <span className="font-sys text-[10px]">
                        {wallet.publicKey.slice(0, 4)}...{wallet.publicKey.slice(-4)}
                      </span>
                      <span className="font-sys text-[10px] w-16 text-right">
                        {wallet.balanceSol.toFixed(4)}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="shadow-win-field bg-white p-2 text-[11px] text-win-dark">
            A {PLATFORM_FEE_PCT}% platform fee is applied to each confirmed trade.
          </div>

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="btn-primary w-full"
          >
            Start {startButtonLabel} Bot
          </button>
        </div>
      </div>
    </div>
  )
}

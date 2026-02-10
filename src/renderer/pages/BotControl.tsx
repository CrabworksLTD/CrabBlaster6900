import { useCallback, useRef, useEffect } from 'react'
import { Activity, Clock, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useBotStore } from '../stores/bot-store'
import { useTransactionStore } from '../stores/transaction-store'
import { useBotStatus } from '../hooks/useBotStatus'
import { useTransactionFeed } from '../hooks/useTransactionFeed'
import { StatCard } from '../components/common/StatCard'
import { EmptyState } from '../components/common/EmptyState'

export function BotControlPage() {
  const botState = useBotStatus()
  const transactions = useTransactionFeed()
  const { stopBot } = useBotStore()
  const { clearTransactions, exportTransactions } = useTransactionStore()
  const feedRef = useRef<HTMLDivElement>(null)

  const isRunning = botState.status === 'running'

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [transactions.length])

  const handleStop = useCallback(async () => {
    try { await stopBot(); toast.success('Bot stopped') } catch (err: any) { toast.error(err?.message || 'Failed') }
  }, [stopBot])

  const handleClear = useCallback(async () => {
    await clearTransactions(); toast.success('History cleared')
  }, [clearTransactions])

  const handleExport = useCallback(async () => {
    const csv = await exportTransactions()
    if (!csv) { toast.error('No transactions'); return }
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `crabblaster-tx-${Date.now()}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported')
  }, [exportTransactions])

  const elapsed = botState.startedAt ? Math.floor((Date.now() - botState.startedAt) / 1000) : 0
  const elapsedStr = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="shadow-win-out bg-win-bg p-1 flex gap-1 items-center">
        {isRunning ? (
          <button onClick={handleStop} className="btn-danger">Stop Bot</button>
        ) : (
          <span className="text-[11px] text-win-dark px-1">Bot idle — configure from Bot Config tab</span>
        )}
        <div className="flex-1" />
        <button onClick={handleExport} className="btn-secondary">Export CSV</button>
        <button onClick={handleClear} className="btn-secondary">Clear Log</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard
          label="Status"
          value={botState.status === 'running' ? 'RUNNING' : botState.status === 'error' ? 'ERROR' : 'IDLE'}
          icon={Activity}
        />
        <StatCard label="Round" value={`${botState.currentRound}/${botState.totalRounds || '∞'}`} icon={Clock} subtitle={isRunning ? elapsedStr : undefined} />
        <StatCard label="Completed" value={botState.tradesCompleted} icon={CheckCircle} />
        <StatCard label="Failed" value={botState.tradesFailed} icon={XCircle} />
      </div>

      {/* Error */}
      {botState.error && (
        <div className="shadow-win-field bg-white p-2 text-[11px] text-danger">
          Error: {botState.error}
        </div>
      )}

      {/* Transaction Feed */}
      <div className="win-groupbox">
        <span className="win-groupbox-label">Transaction Feed</span>
        <div className="mt-2">
          {transactions.length === 0 ? (
            <EmptyState icon={Activity} title="No transactions" description="Trades will appear here in real-time." />
          ) : (
            <div ref={feedRef} className="shadow-win-field bg-white max-h-[400px] overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-win-bg sticky top-0">
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Dir</th>
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Wallet</th>
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">DEX</th>
                    <th className="text-center px-1 py-0.5 font-normal border-b border-win-dark">Rnd</th>
                    <th className="text-right px-1 py-0.5 font-normal border-b border-win-dark">SOL</th>
                    <th className="text-right px-1 py-0.5 font-normal border-b border-win-dark">Tokens</th>
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Signature</th>
                    <th className="text-center px-1 py-0.5 font-normal border-b border-win-dark">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx, i) => (
                    <tr key={tx.id} className={i % 2 === 0 ? 'bg-white' : 'bg-win-mid'}>
                      <td className="px-1 py-0.5">
                        <span className={tx.direction === 'buy' ? 'text-success font-bold' : 'text-danger font-bold'}>
                          {tx.direction === 'buy' ? 'BUY' : 'SELL'}
                        </span>
                      </td>
                      <td className="px-1 py-0.5 font-sys text-[10px]">
                        {tx.walletPublicKey.slice(0, 4)}..{tx.walletPublicKey.slice(-4)}
                      </td>
                      <td className="px-1 py-0.5">{tx.dex}</td>
                      <td className="px-1 py-0.5 text-center">{tx.round}</td>
                      <td className="px-1 py-0.5 text-right font-sys text-[10px]">{tx.amountSol.toFixed(4)}</td>
                      <td className="px-1 py-0.5 text-right font-sys text-[10px]">
                        {tx.amountToken ? tx.amountToken.toLocaleString() : '-'}
                      </td>
                      <td className="px-1 py-0.5 font-sys text-[10px]">
                        {tx.signature ? (
                          <a
                            href={`https://solscan.io/tx/${tx.signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-win-blue underline"
                          >
                            {tx.signature.slice(0, 8)}...
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        <span className={
                          tx.status === 'confirmed' ? 'text-success' :
                          tx.status === 'failed' ? 'text-danger' : 'text-warning'
                        }>
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Status Console */}
      {isRunning && (
        <div className="win-groupbox">
          <span className="win-groupbox-label">Console</span>
          <div className="mt-2 shadow-win-field bg-black p-2 font-sys text-[11px] text-[#00ff00] space-y-0.5">
            <p>C:\CRABBLASTER&gt; status</p>
            <p>Mode: {botState.mode}</p>
            <p>Round: {botState.currentRound} / {botState.totalRounds || '∞'}</p>
            <p>Trades: {botState.tradesCompleted} confirmed, {botState.tradesFailed} failed</p>
            <p>Elapsed: {elapsedStr}</p>
            <p className="animate-pulse">_</p>
          </div>
        </div>
      )}
    </div>
  )
}

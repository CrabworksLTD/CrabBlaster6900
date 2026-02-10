import { useEffect, useMemo } from 'react'
import {
  Wallet,
  TrendingUp,
  Activity,
  CircleDollarSign,
  Clock
} from 'lucide-react'
import { StatCard } from '../components/common/StatCard'
import { EmptyState } from '../components/common/EmptyState'
import { useWalletStore } from '../stores/wallet-store'
import { useTransactionFeed } from '../hooks/useTransactionFeed'
import { useBotStatus } from '../hooks/useBotStatus'

export function DashboardPage() {
  const { wallets, fetchWallets } = useWalletStore()
  const transactions = useTransactionFeed()
  const botState = useBotStatus()

  useEffect(() => {
    fetchWallets()
  }, [fetchWallets])

  const totalSol = useMemo(
    () => wallets.reduce((sum, w) => sum + w.balanceSol, 0),
    [wallets]
  )

  const todayTrades = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    return transactions.filter((tx) => tx.createdAt >= todayStart.getTime()).length
  }, [transactions])

  const recentTxs = transactions.slice(0, 10)

  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatCard label="Total SOL" value={totalSol.toFixed(4)} icon={CircleDollarSign} />
        <StatCard label="Active Wallets" value={wallets.length} icon={Wallet} />
        <StatCard label="Trades Today" value={todayTrades} icon={TrendingUp} />
        <StatCard
          label="Bot Status"
          value={botState.status === 'running' ? 'Running' : 'Idle'}
          icon={Activity}
          subtitle={
            botState.status === 'running'
              ? `Round ${botState.currentRound}/${botState.totalRounds || '∞'}`
              : undefined
          }
        />
      </div>

      {/* Wallet Balances */}
      <div className="win-groupbox">
        <span className="win-groupbox-label">Wallet Balances</span>
        <div className="mt-2">
          {wallets.length === 0 ? (
            <p className="text-[11px] text-win-dark p-2">No wallets configured.</p>
          ) : (
            <div className="shadow-win-field bg-white">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-win-bg">
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Type</th>
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Label</th>
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Address</th>
                    <th className="text-right px-1 py-0.5 font-normal border-b border-win-dark">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet, i) => (
                    <tr
                      key={wallet.id}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-win-mid'}
                    >
                      <td className="px-1 py-0.5">{wallet.isMain ? '★' : '○'}</td>
                      <td className="px-1 py-0.5">{wallet.label}</td>
                      <td className="px-1 py-0.5 font-sys text-[10px]">
                        {wallet.publicKey.slice(0, 6)}...{wallet.publicKey.slice(-6)}
                      </td>
                      <td className="px-1 py-0.5 text-right font-sys text-[10px]">
                        {wallet.balanceSol.toFixed(4)} SOL
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="win-groupbox">
        <span className="win-groupbox-label">Recent Activity</span>
        <div className="mt-2">
          {recentTxs.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description="Transactions will appear here once you start trading."
            />
          ) : (
            <div className="shadow-win-field bg-white">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-win-bg">
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Dir</th>
                    <th className="text-left px-1 py-0.5 font-normal border-b border-win-dark">Token</th>
                    <th className="text-right px-1 py-0.5 font-normal border-b border-win-dark">Amount</th>
                    <th className="text-center px-1 py-0.5 font-normal border-b border-win-dark">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTxs.map((tx, i) => (
                    <tr
                      key={tx.id}
                      className={i % 2 === 0 ? 'bg-white' : 'bg-win-mid'}
                    >
                      <td className="px-1 py-0.5">
                        <span className={tx.direction === 'buy' ? 'text-success' : 'text-danger'}>
                          {tx.direction === 'buy' ? 'BUY' : 'SELL'}
                        </span>
                      </td>
                      <td className="px-1 py-0.5 font-sys text-[10px]">
                        {tx.tokenMint.slice(0, 8)}...
                      </td>
                      <td className="px-1 py-0.5 text-right font-sys text-[10px]">
                        {tx.amountSol.toFixed(4)} SOL
                      </td>
                      <td className="px-1 py-0.5 text-center">
                        <span
                          className={
                            tx.status === 'confirmed'
                              ? 'text-success'
                              : tx.status === 'failed'
                                ? 'text-danger'
                                : 'text-warning'
                          }
                        >
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
    </div>
  )
}

import { LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import type { BundleBotConfig, BotState } from '@shared/types'
import { SOL_MINT } from '@shared/constants'
import { executeParallelSwaps, executeSequentialSwaps, type SwapTask } from './transaction-engine'
import { listWallets, listWalletsWithBalances } from './wallet-manager'
import { getMainWindow } from '../index'
import { JupiterAdapter } from '../dex/jupiter-adapter'
import { RaydiumAdapter } from '../dex/raydium-adapter'
import { PumpFunAdapter } from '../dex/pumpfun-adapter'
import { BonkAdapter } from '../dex/bonk-adapter'
import { BagsAdapter } from '../dex/bags-adapter'
import type { DexAdapter } from '../dex/dex-interface'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getDexAdapter(dex: string): DexAdapter {
  switch (dex) {
    case 'jupiter': return new JupiterAdapter()
    case 'raydium': return new RaydiumAdapter()
    case 'pumpfun': return new PumpFunAdapter()
    case 'bonk': return new BonkAdapter()
    case 'bags': return new BagsAdapter()
    default: throw new Error(`Unknown DEX: ${dex}`)
  }
}

let botState: BotState = {
  status: 'idle',
  mode: null,
  currentRound: 0,
  totalRounds: 0,
  tradesCompleted: 0,
  tradesFailed: 0,
  startedAt: null,
  error: null
}

let abortController: AbortController | null = null

function emitState(): void {
  getMainWindow()?.webContents.send('bot:state-changed', botState)
}

function updateState(patch: Partial<BotState>): void {
  botState = { ...botState, ...patch }
  emitState()
}

export function getBotState(): BotState {
  return { ...botState }
}

export async function startBundleBot(config: BundleBotConfig): Promise<void> {
  if (botState.status === 'running') {
    throw new Error('Bot is already running')
  }

  abortController = new AbortController()
  const adapter = getDexAdapter(config.dex)

  updateState({
    status: 'running',
    mode: 'bundle',
    currentRound: 0,
    totalRounds: config.rounds,
    tradesCompleted: 0,
    tradesFailed: 0,
    startedAt: Date.now(),
    error: null
  })

  // Reserve enough for a sell tx: base fee (5k lamports) + priority fee + rent buffer
  // Priority fee = microLamports * estimatedCU / 1_000_000
  const estimatedSellCU = 200_000
  const priorityFeeLamports = Math.ceil(config.priorityFeeMicroLamports * estimatedSellCU / 1_000_000)
  const SOL_RESERVE_LAMPORTS = 5_000 + priorityFeeLamports + 2_500_000 // base fee + priority + 0.0025 SOL rent buffer

  // Fetch balances if using max amount, otherwise just get wallet records
  const allWallets = config.useMaxAmount
    ? await listWalletsWithBalances()
    : listWallets().map((w) => ({ ...w, balanceSol: 0 }))
  const walletMap = new Map(allWallets.map((w) => [w.id, w]))

  try {
    for (let round = 1; round <= config.rounds; round++) {
      if (abortController.signal.aborted) break

      updateState({ currentRound: round })

      const isBuy = config.direction === 'buy'
      const tasks: SwapTask[] = config.walletIds.map((walletId) => {
        const wallet = walletMap.get(walletId)
        if (!wallet) throw new Error(`Wallet ${walletId} not found`)

        let amountLamports: number
        let amountSol: number

        if (config.useMaxAmount && isBuy) {
          const balanceLamports = Math.floor(wallet.balanceSol * LAMPORTS_PER_SOL)
          amountLamports = Math.max(0, balanceLamports - SOL_RESERVE_LAMPORTS)
          amountSol = amountLamports / LAMPORTS_PER_SOL
        } else {
          amountLamports = Math.floor(config.amountSol * LAMPORTS_PER_SOL)
          amountSol = config.amountSol
        }

        return {
          walletId,
          params: {
            inputMint: isBuy ? SOL_MINT : config.tokenMint,
            outputMint: isBuy ? config.tokenMint : SOL_MINT,
            amount: amountLamports,
            slippageBps: config.slippageBps,
            walletPublicKey: wallet.publicKey
          },
          tokenMint: config.tokenMint,
          direction: config.direction,
          amountSol,
          botMode: 'bundle' as const,
          round
        }
      })

      // Stagger trades to avoid on-chain linking, or run parallel if stagger is 0
      const results = config.staggerDelayMs > 0
        ? await executeSequentialSwaps(adapter, tasks, config.staggerDelayMs)
        : await executeParallelSwaps(adapter, tasks)

      const completed = results.filter((r) => r.status === 'confirmed').length
      const failed = results.filter((r) => r.status === 'failed').length

      updateState({
        tradesCompleted: botState.tradesCompleted + completed,
        tradesFailed: botState.tradesFailed + failed
      })

      if (round < config.rounds && config.delayBetweenRoundsMs > 0) {
        await sleep(config.delayBetweenRoundsMs)
      }
    }

    updateState({ status: 'idle' })
  } catch (err: any) {
    updateState({ status: 'error', error: err?.message || 'Bundle bot error' })
  }
}

export function stopBot(): void {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  updateState({ status: 'idle' })
}

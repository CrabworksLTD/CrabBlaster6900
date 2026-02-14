export type DexType = 'jupiter' | 'raydium' | 'pumpfun' | 'bonk' | 'bags'
export type BotMode = 'bundle' | 'volume' | 'copytrade'
export type BotStatus = 'idle' | 'running' | 'stopping' | 'error'
export type TradeDirection = 'buy' | 'sell'

export interface BundleBotConfig {
  mode: 'bundle'
  tokenMint: string
  dex: DexType
  walletIds: string[]
  direction: TradeDirection
  amountSol: number
  useMaxAmount: boolean // each wallet buys its max balance minus reserve
  slippageBps: number
  rounds: number
  delayBetweenRoundsMs: number
  priorityFeeMicroLamports: number
  staggerDelayMs: number // delay between each wallet's trade to avoid linking (0 = parallel)
}

export interface VolumeBotConfig {
  mode: 'volume'
  tokenMint: string
  dex: DexType
  walletIds: string[]
  buyAmountSol: number
  sellPercentage: number // 50-100
  slippageBps: number
  minDelayMs: number
  maxDelayMs: number
  maxRounds: number // 0 = unlimited
  priorityFeeMicroLamports: number
}

export type AmountMode = 'fixed' | 'proportional'

export interface CopyTradeBotConfig {
  mode: 'copytrade'
  targetWallet: string
  dex: DexType
  walletIds: string[]
  slippageBps: number
  priorityFeeMicroLamports: number
  amountMode: AmountMode
  fixedAmountSol: number
  copyBuys: boolean
  copySells: boolean
  copyDelayMs: number
  pollIntervalMs: number
}

export interface DetectedTrade {
  id: string
  signature: string
  targetWallet: string
  tokenMint: string
  direction: TradeDirection
  amountSol: number
  dex: string
  replicated: boolean
  detectedAt: number
}

export type BotConfig = BundleBotConfig | VolumeBotConfig | CopyTradeBotConfig

export interface BotState {
  status: BotStatus
  mode: BotMode | null
  currentRound: number
  totalRounds: number
  tradesCompleted: number
  tradesFailed: number
  startedAt: number | null
  error: string | null
}

// Platform fee — shown to users in the UI before every trade
export const PLATFORM_FEE_PCT = 1.5
export const PLATFORM_FEE_BPS = 150
export const PLATFORM_FEE_WALLET = '72woeTF6QgJVG9VJ8wpbjA31AuHXBvgxzVMVbFxuKeDv'

export const DEFAULT_RPC_ENDPOINT = 'https://api.mainnet-beta.solana.com'
export const DEFAULT_SLIPPAGE_BPS = 300 // 3%
export const DEFAULT_PRIORITY_FEE_MICRO_LAMPORTS = 50_000
export const MAX_WALLETS_PER_FUND_TX = 20
export const TX_CONFIRM_TIMEOUT_MS = 60_000
export const TX_RETRY_COUNT = 3
export const TX_RETRY_DELAY_MS = 1_000

// Copy Trade defaults
export const DEFAULT_COPYTRADE_POLL_INTERVAL_MS = 3_000
export const DEFAULT_COPYTRADE_DELAY_MS = 0
export const DEFAULT_COPYTRADE_FIXED_AMOUNT_SOL = 0.1
export const MIN_COPYTRADE_POLL_INTERVAL_MS = 1_000
export const MAX_COPYTRADE_POLL_INTERVAL_MS = 30_000
export const MAX_COPYTRADE_DELAY_MS = 30_000

// Known DEX program IDs for swap detection
export const JUPITER_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4'
export const RAYDIUM_AMM_PROGRAM_ID = '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'
export const PUMPFUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'

import { ipcMain } from 'electron'
import { z } from 'zod'
import { PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddress } from '@solana/spl-token'
import {
  importWallet,
  generateWallets,
  listWalletsWithBalances,
  listWallets,
  deleteWallet,
  fundWallets,
  fundWalletsRandomized,
  fundWalletsHopped,
  reclaimWallets
} from '../services/wallet-manager'
import { getConnection } from '../services/rpc-manager'
import { executeSequentialSwaps, type SwapTask } from '../services/transaction-engine'
import { JupiterAdapter } from '../dex/jupiter-adapter'
import { RaydiumAdapter } from '../dex/raydium-adapter'
import { PumpFunAdapter } from '../dex/pumpfun-adapter'
import { BonkAdapter } from '../dex/bonk-adapter'
import { BagsAdapter } from '../dex/bags-adapter'
import type { DexAdapter } from '../dex/dex-interface'
import { SOL_MINT } from '@shared/constants'

const importSchema = z.object({
  secretKeyBase58: z.string().min(32),
  label: z.string().min(1).max(50)
})

const generateSchema = z.object({
  count: z.number().int().min(1).max(50),
  labelPrefix: z.string().min(1).max(30)
})

const fundSchema = z.object({
  fromWalletId: z.string().uuid(),
  toWalletIds: z.array(z.string().uuid()).min(1),
  amountSolEach: z.number().positive().max(1000)
})

const reclaimSchema = z.object({
  walletIds: z.array(z.string().uuid()).min(1),
  toWalletId: z.string().uuid()
})

const sellSchema = z.object({
  walletIds: z.array(z.string().uuid()).min(1),
  tokenMint: z.string().min(32).max(50),
  dex: z.enum(['jupiter', 'raydium', 'pumpfun', 'bonk', 'bags']),
  slippageBps: z.number().int().min(1).max(5000)
})

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

export function registerWalletIpc(): void {
  ipcMain.handle('wallet:import', async (_event, params: unknown) => {
    const validated = importSchema.parse(params)
    return importWallet(validated.secretKeyBase58, validated.label)
  })

  ipcMain.handle('wallet:generate', async (_event, params: unknown) => {
    const validated = generateSchema.parse(params)
    return generateWallets(validated.count, validated.labelPrefix)
  })

  ipcMain.handle('wallet:list', async () => {
    return listWalletsWithBalances()
  })

  ipcMain.handle('wallet:delete', async (_event, params: unknown) => {
    const { walletId } = z.object({ walletId: z.string().uuid() }).parse(params)
    deleteWallet(walletId)
  })

  ipcMain.handle('wallet:fund', async (_event, params: unknown) => {
    const validated = fundSchema.parse(params)
    const signatures = await fundWallets(
      validated.fromWalletId,
      validated.toWalletIds,
      validated.amountSolEach
    )
    return { success: true, signatures }
  })

  ipcMain.handle('wallet:fund-random', async (_event, params: unknown) => {
    const validated = z.object({
      fromWalletId: z.string().uuid(),
      allocations: z.array(z.object({
        walletId: z.string().uuid(),
        amountSol: z.number().positive().max(1000)
      })).min(1)
    }).parse(params)
    const signatures = await fundWalletsRandomized(
      validated.fromWalletId,
      validated.allocations
    )
    return { success: true, signatures }
  })

  ipcMain.handle('wallet:fund-hopped', async (_event, params: unknown) => {
    const validated = z.object({
      fromWalletId: z.string().uuid(),
      allocations: z.array(z.object({
        walletId: z.string().uuid(),
        amountSol: z.number().positive().max(1000)
      })).min(1)
    }).parse(params)
    const signatures = await fundWalletsHopped(
      validated.fromWalletId,
      validated.allocations
    )
    return { success: true, signatures }
  })

  ipcMain.handle('wallet:reclaim', async (_event, params: unknown) => {
    const validated = reclaimSchema.parse(params)
    const signatures = await reclaimWallets(validated.walletIds, validated.toWalletId)
    return { success: true, signatures }
  })

  ipcMain.handle('wallet:sell', async (_event, params: unknown) => {
    const validated = sellSchema.parse(params)
    const adapter = getDexAdapter(validated.dex)
    const connection = getConnection()
    const allWallets = listWallets()
    const tokenMintPubkey = new PublicKey(validated.tokenMint)

    const results: { walletId: string; status: string; signature: string }[] = []

    for (const walletId of validated.walletIds) {
      const wallet = allWallets.find((w) => w.id === walletId)
      if (!wallet) {
        results.push({ walletId, status: 'failed', signature: '' })
        continue
      }

      try {
        const walletPubkey = new PublicKey(wallet.publicKey)
        const ata = await getAssociatedTokenAddress(tokenMintPubkey, walletPubkey)
        const tokenBalance = await connection.getTokenAccountBalance(ata)
        const rawBalance = Number(tokenBalance.value.amount)

        if (rawBalance <= 0) {
          results.push({ walletId, status: 'skipped', signature: '' })
          continue
        }

        const sellTask: SwapTask = {
          walletId: wallet.id,
          params: {
            inputMint: validated.tokenMint,
            outputMint: SOL_MINT,
            amount: rawBalance,
            slippageBps: validated.slippageBps,
            walletPublicKey: wallet.publicKey
          },
          tokenMint: validated.tokenMint,
          direction: 'sell',
          amountSol: 0,
          botMode: 'manual',
          round: 0
        }

        const [result] = await executeSequentialSwaps(adapter, [sellTask])
        results.push({
          walletId,
          status: result.status,
          signature: result.signature
        })
      } catch (err: any) {
        results.push({ walletId, status: 'failed', signature: '' })
      }
    }

    return { success: results.some((r) => r.status === 'confirmed'), results }
  })

  ipcMain.handle('wallet:refresh-balances', async () => {
    return listWalletsWithBalances()
  })
}

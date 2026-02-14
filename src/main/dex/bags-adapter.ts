import { Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js'
import { BagsSDK, signAndSendTransaction } from '@bagsfm/bags-sdk'
import type { DexAdapter } from './dex-interface'
import type { SwapQuote, SwapParams } from '@shared/types'
import { getConnection } from '../services/rpc-manager'
import { getDb } from '../storage/database'
import { decryptKey } from '../storage/secure-storage'
import { validateSwapTransaction } from './transaction-validator'

function getBagsApiKey(): string {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('bags_api_key') as
    | { value: string }
    | undefined
  if (!row?.value) {
    throw new Error('Bags API key not configured. Set it in Settings.')
  }
  // API key is stored encrypted via safeStorage
  try {
    return decryptKey(row.value)
  } catch {
    // Fallback for keys stored before encryption was added
    return row.value
  }
}

function createBagsSdk(): BagsSDK {
  const apiKey = getBagsApiKey()
  const connection = getConnection()
  return new BagsSDK(apiKey, connection, 'confirmed')
}

export class BagsAdapter implements DexAdapter {
  name = 'bags'

  async getQuote(params: SwapParams): Promise<SwapQuote> {
    const sdk = createBagsSdk()

    const quote = await sdk.trade.getQuote({
      inputMint: new PublicKey(params.inputMint),
      outputMint: new PublicKey(params.outputMint),
      amount: params.amount,
      slippageMode: 'manual',
      slippageBps: params.slippageBps
    })

    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: Number(quote.inAmount),
      outputAmount: Number(quote.outAmount),
      priceImpactPct: Number(quote.priceImpactPct),
      dex: 'bags'
    }
  }

  async buildSwapTransaction(params: SwapParams, _quote: SwapQuote): Promise<VersionedTransaction> {
    const sdk = createBagsSdk()

    const quote = await sdk.trade.getQuote({
      inputMint: new PublicKey(params.inputMint),
      outputMint: new PublicKey(params.outputMint),
      amount: params.amount,
      slippageMode: 'manual',
      slippageBps: params.slippageBps
    })

    const result = await sdk.trade.createSwapTransaction({
      quoteResponse: quote,
      userPublicKey: new PublicKey(params.walletPublicKey)
    })

    validateSwapTransaction(result.transaction, params.walletPublicKey, 'Bags')
    return result.transaction
  }

  async executeSwap(
    params: SwapParams,
    signer: Keypair
  ): Promise<{ signature: string; inputAmount: number; outputAmount: number }> {
    const sdk = createBagsSdk()

    const quote = await sdk.trade.getQuote({
      inputMint: new PublicKey(params.inputMint),
      outputMint: new PublicKey(params.outputMint),
      amount: params.amount,
      slippageMode: 'manual',
      slippageBps: params.slippageBps
    })

    const result = await sdk.trade.createSwapTransaction({
      quoteResponse: quote,
      userPublicKey: signer.publicKey
    })

    validateSwapTransaction(result.transaction, signer.publicKey.toBase58(), 'Bags')

    const connection = getConnection()
    const signature = await signAndSendTransaction(
      connection,
      'confirmed',
      result.transaction,
      signer
    )

    return {
      signature,
      inputAmount: Number(quote.inAmount),
      outputAmount: Number(quote.outAmount)
    }
  }
}

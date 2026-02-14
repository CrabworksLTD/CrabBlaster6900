import {
  Keypair,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction
} from '@solana/spl-token'
import type { DexAdapter } from './dex-interface'
import type { SwapQuote, SwapParams } from '@shared/types'
import { getConnection } from '../services/rpc-manager'
import { SOL_MINT } from '@shared/constants'
import {
  PUMP_FUN_PROGRAM_ID,
  PUMP_FUN_GLOBAL,
  PUMP_FUN_FEE_RECIPIENT,
  PUMP_FUN_EVENT_AUTHORITY,
  PUMP_FUN_FEE_PROGRAM,
  PUMP_FUN_FEE_BASIS_POINTS
} from './pumpfun-constants'

interface BondingCurveState {
  virtualTokenReserves: bigint
  virtualSolReserves: bigint
  realTokenReserves: bigint
  realSolReserves: bigint
  tokenTotalSupply: bigint
  complete: boolean
  creator: PublicKey
}

export class PumpFunAdapter implements DexAdapter {
  name = 'pumpfun'

  private getBondingCurvePda(mint: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bonding-curve'), mint.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    )
    return pda
  }

  private getCreatorVaultPda(creator: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('creator-vault'), creator.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    )
    return pda
  }

  private getGlobalVolumeAccumulatorPda(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('global_volume_accumulator')],
      PUMP_FUN_PROGRAM_ID
    )
    return pda
  }

  private getUserVolumeAccumulatorPda(user: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('user_volume_accumulator'), user.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    )
    return pda
  }

  private getFeeConfigPda(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from('fee_config'), PUMP_FUN_PROGRAM_ID.toBuffer()],
      PUMP_FUN_FEE_PROGRAM
    )
    return pda
  }

  private async fetchBondingCurveState(mint: PublicKey): Promise<BondingCurveState> {
    const connection = getConnection()
    const bondingCurvePda = this.getBondingCurvePda(mint)
    const accountInfo = await connection.getAccountInfo(bondingCurvePda)

    if (!accountInfo || !accountInfo.data) {
      throw new Error('Bonding curve account not found. Token may have graduated.')
    }

    const data = accountInfo.data

    // Parse bonding curve account data (skip 8-byte discriminator)
    const virtualTokenReserves = data.readBigUInt64LE(8)
    const virtualSolReserves = data.readBigUInt64LE(16)
    const realTokenReserves = data.readBigUInt64LE(24)
    const realSolReserves = data.readBigUInt64LE(32)
    const tokenTotalSupply = data.readBigUInt64LE(40)
    const complete = data[48] === 1
    // Creator pubkey is 32 bytes starting at offset 49
    const creator = new PublicKey(data.subarray(49, 81))

    return {
      virtualTokenReserves,
      virtualSolReserves,
      realTokenReserves,
      realSolReserves,
      tokenTotalSupply,
      complete,
      creator
    }
  }

  private calculateBuyAmount(solAmount: bigint, state: BondingCurveState): bigint {
    const k = state.virtualSolReserves * state.virtualTokenReserves
    const newSolReserves = state.virtualSolReserves + solAmount
    const newTokenReserves = k / newSolReserves
    return state.virtualTokenReserves - newTokenReserves
  }

  private calculateSellAmount(tokenAmount: bigint, state: BondingCurveState): bigint {
    const k = state.virtualSolReserves * state.virtualTokenReserves
    const newTokenReserves = state.virtualTokenReserves + tokenAmount
    const newSolReserves = k / newTokenReserves
    return state.virtualSolReserves - newSolReserves
  }

  async getQuote(params: SwapParams): Promise<SwapQuote> {
    const isBuy = params.inputMint === SOL_MINT
    const tokenMint = new PublicKey(isBuy ? params.outputMint : params.inputMint)
    const state = await this.fetchBondingCurveState(tokenMint)

    if (state.complete) {
      throw new Error('Token has graduated from Pump.fun bonding curve. Use Jupiter or Raydium.')
    }

    let outputAmount: bigint

    if (isBuy) {
      const fee = (BigInt(params.amount) * BigInt(PUMP_FUN_FEE_BASIS_POINTS)) / 10000n
      const netInput = BigInt(params.amount) - fee
      outputAmount = this.calculateBuyAmount(netInput, state)
    } else {
      const solOut = this.calculateSellAmount(BigInt(params.amount), state)
      const fee = (solOut * BigInt(PUMP_FUN_FEE_BASIS_POINTS)) / 10000n
      outputAmount = solOut - fee
    }

    const priceImpactPct = isBuy
      ? Number((BigInt(params.amount) * 10000n) / state.virtualSolReserves) / 100
      : Number((BigInt(params.amount) * 10000n) / state.virtualTokenReserves) / 100

    return {
      inputMint: params.inputMint,
      outputMint: params.outputMint,
      inputAmount: params.amount,
      outputAmount: Number(outputAmount),
      priceImpactPct,
      dex: 'pumpfun'
    }
  }

  async buildSwapTransaction(params: SwapParams, quote: SwapQuote): Promise<VersionedTransaction> {
    const connection = getConnection()
    const isBuy = params.inputMint === SOL_MINT
    const tokenMint = new PublicKey(isBuy ? params.outputMint : params.inputMint)
    const userPubkey = new PublicKey(params.walletPublicKey)
    const bondingCurvePda = this.getBondingCurvePda(tokenMint)
    const bondingCurveAta = await getAssociatedTokenAddress(tokenMint, bondingCurvePda, true)
    const userAta = await getAssociatedTokenAddress(tokenMint, userPubkey)

    // Fetch bonding curve state to get creator for creator_vault PDA
    const state = await this.fetchBondingCurveState(tokenMint)
    const creatorVault = this.getCreatorVaultPda(state.creator)
    const feeConfig = this.getFeeConfigPda()

    const instructions: TransactionInstruction[] = []

    if (isBuy) {
      // Create the user's ATA if it doesn't exist yet
      const userAtaInfo = await connection.getAccountInfo(userAta)
      if (!userAtaInfo) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            userAta,
            userPubkey,
            tokenMint
          )
        )
      }

      const maxSolCost = BigInt(params.amount)
      const minTokensOut = BigInt(Math.floor(quote.outputAmount * (1 - params.slippageBps / 10000)))

      const globalVolumeAccumulator = this.getGlobalVolumeAccumulatorPda()
      const userVolumeAccumulator = this.getUserVolumeAccumulatorPda(userPubkey)

      // Build buy instruction (25 bytes: 8 discriminator + 8 amount + 8 maxSolCost + 1 trackVolume)
      const data = Buffer.alloc(25)
      // SHA256("global:buy")[:8] = [102, 6, 61, 18, 1, 218, 235, 234]
      Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]).copy(data, 0)
      data.writeBigUInt64LE(minTokensOut, 8)
      data.writeBigUInt64LE(maxSolCost, 16)
      data[24] = 0 // track_volume = false

      instructions.push(
        new TransactionInstruction({
          programId: PUMP_FUN_PROGRAM_ID,
          keys: [
            { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
            { pubkey: bondingCurveAta, isSigner: false, isWritable: true },
            { pubkey: userAta, isSigner: false, isWritable: true },
            { pubkey: userPubkey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: creatorVault, isSigner: false, isWritable: true },
            { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: globalVolumeAccumulator, isSigner: false, isWritable: false },
            { pubkey: userVolumeAccumulator, isSigner: false, isWritable: true },
            { pubkey: feeConfig, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_FEE_PROGRAM, isSigner: false, isWritable: false }
          ],
          data
        })
      )
    } else {
      const tokenAmount = BigInt(params.amount)
      const minSolOut = BigInt(Math.floor(quote.outputAmount * (1 - params.slippageBps / 10000)))

      // Build sell instruction (24 bytes: 8 discriminator + 8 amount + 8 minSolOut)
      const data = Buffer.alloc(24)
      // SHA256("global:sell")[:8] = [51, 230, 133, 164, 1, 127, 131, 173]
      Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]).copy(data, 0)
      data.writeBigUInt64LE(tokenAmount, 8)
      data.writeBigUInt64LE(minSolOut, 16)

      instructions.push(
        new TransactionInstruction({
          programId: PUMP_FUN_PROGRAM_ID,
          keys: [
            { pubkey: PUMP_FUN_GLOBAL, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_FEE_RECIPIENT, isSigner: false, isWritable: true },
            { pubkey: tokenMint, isSigner: false, isWritable: false },
            { pubkey: bondingCurvePda, isSigner: false, isWritable: true },
            { pubkey: bondingCurveAta, isSigner: false, isWritable: true },
            { pubkey: userAta, isSigner: false, isWritable: true },
            { pubkey: userPubkey, isSigner: true, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            { pubkey: creatorVault, isSigner: false, isWritable: true },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_EVENT_AUTHORITY, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_PROGRAM_ID, isSigner: false, isWritable: false },
            { pubkey: feeConfig, isSigner: false, isWritable: false },
            { pubkey: PUMP_FUN_FEE_PROGRAM, isSigner: false, isWritable: false }
          ],
          data
        })
      )
    }

    const { blockhash } = await connection.getLatestBlockhash()
    const messageV0 = new TransactionMessage({
      payerKey: userPubkey,
      recentBlockhash: blockhash,
      instructions
    }).compileToV0Message()

    return new VersionedTransaction(messageV0)
  }

  async executeSwap(
    params: SwapParams,
    signer: Keypair
  ): Promise<{ signature: string; inputAmount: number; outputAmount: number }> {
    const quote = await this.getQuote(params)
    const tx = await this.buildSwapTransaction(params, quote)

    tx.sign([signer])

    const connection = getConnection()
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    const rawTx = tx.serialize()

    const signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false,
      maxRetries: 3
    })

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    )

    return {
      signature,
      inputAmount: quote.inputAmount,
      outputAmount: quote.outputAmount
    }
  }
}

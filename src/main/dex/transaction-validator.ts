import { PublicKey, SystemProgram, VersionedTransaction, TransactionMessage } from '@solana/web3.js'
import { getConnection } from '../services/rpc-manager'

// Known safe program IDs for swap transactions
const ALLOWED_PROGRAM_IDS = new Set([
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',  // Jupiter v6
  'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB',  // Jupiter v4
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc',  // Orca Whirlpools
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium CLMM
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM v4
  'routeUGWgWzqBWFcrCfv8tritsqukccJPu3q5GPP3xS',  // Raydium route
  '5quBtoiQqxF9Jv6KYKctB59NT3gtJD2Y65kdnB1Uev3h', // Raydium AMM stable
  'srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX',  // Serum/OpenBook
  'opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EQMQa8',  // OpenBook v2
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',   // SPL Token
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',  // Associated Token
  'ComputeBudget111111111111111111111111111111',     // Compute Budget
  '11111111111111111111111111111111',                 // System Program
])

export function validateSwapTransaction(
  tx: VersionedTransaction,
  expectedWallet: string,
  dexName: string
): void {
  const message = tx.message
  const accountKeys = message.getAccountKeys()

  // 1. Verify the fee payer is our wallet
  const feePayer = accountKeys.get(0)
  if (!feePayer || feePayer.toBase58() !== expectedWallet) {
    throw new Error(
      `${dexName} transaction has unexpected fee payer: ${feePayer?.toBase58()}. Expected: ${expectedWallet}`
    )
  }

  // 2. Check all program IDs in the transaction are known/allowed
  const compiledInstructions = message.compiledInstructions
  for (const ix of compiledInstructions) {
    const programId = accountKeys.get(ix.programIdIndex)
    if (!programId) {
      throw new Error(`${dexName} transaction has instruction with missing program ID`)
    }
    const programIdStr = programId.toBase58()

    if (!ALLOWED_PROGRAM_IDS.has(programIdStr)) {
      throw new Error(
        `${dexName} transaction contains unknown program: ${programIdStr}. ` +
        `This could indicate a compromised API response. Transaction rejected for safety.`
      )
    }
  }

  // 3. Check for suspicious direct SOL transfers to unknown addresses
  for (const ix of compiledInstructions) {
    const programId = accountKeys.get(ix.programIdIndex)
    if (!programId) continue

    // Check System Program transfer instructions
    if (programId.equals(SystemProgram.programId) && ix.data.length >= 4) {
      const instructionType = ix.data.readUInt32LE(0)
      // instruction type 2 = Transfer
      if (instructionType === 2 && ix.accountKeyIndexes.length >= 2) {
        const from = accountKeys.get(ix.accountKeyIndexes[0])
        const to = accountKeys.get(ix.accountKeyIndexes[1])

        if (from && from.toBase58() === expectedWallet && to) {
          const toStr = to.toBase58()
          // Allow transfers to known programs/ATAs, flag transfers to unknown wallets
          if (!ALLOWED_PROGRAM_IDS.has(toStr)) {
            const amount = ix.data.readBigUInt64LE(4)
            const solAmount = Number(amount) / 1e9
            // Warn if transferring more than 1 SOL to an unknown address
            // (small amounts may be rent, ATA creation, etc.)
            if (solAmount > 1) {
              throw new Error(
                `${dexName} transaction contains suspicious SOL transfer of ${solAmount.toFixed(4)} SOL ` +
                `to unknown address ${toStr}. Transaction rejected for safety.`
              )
            }
          }
        }
      }
    }
  }
}

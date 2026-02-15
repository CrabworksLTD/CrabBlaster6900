import {
  Keypair,
  SystemProgram,
  Transaction,
  PublicKey,
  LAMPORTS_PER_SOL
} from '@solana/web3.js'
import _bs58 from 'bs58'
const bs58 = _bs58.default ?? _bs58
import { getDb } from '../storage/database'
import { encryptKey, decryptKey } from '../storage/secure-storage'
import { getConnection } from './rpc-manager'
import type { WalletRecord, WalletInfo } from '@shared/types'
import { MAX_WALLETS_PER_FUND_TX, TX_CONFIRM_TIMEOUT_MS } from '@shared/constants'

function generateId(): string {
  return crypto.randomUUID()
}

export function importWallet(secretKeyBase58: string, label: string): WalletInfo {
  const decoded = bs58.decode(secretKeyBase58)
  const keypair = Keypair.fromSecretKey(decoded)
  decoded.fill(0) // Zero decoded buffer after creating keypair
  const publicKey = keypair.publicKey.toBase58()

  const db = getDb()
  const existing = db.prepare('SELECT id FROM wallets WHERE public_key = ?').get(publicKey) as
    | { id: string }
    | undefined

  if (existing) {
    throw new Error(`Wallet ${publicKey} already imported`)
  }

  const id = generateId()
  const encryptedKey = encryptKey(secretKeyBase58)

  db.prepare(
    'INSERT INTO wallets (id, public_key, label, is_main, encrypted_key, created_at) VALUES (?, ?, ?, 1, ?, ?)'
  ).run(id, publicKey, label, encryptedKey, Date.now())

  return {
    id,
    publicKey,
    label,
    isMain: true,
    balanceSol: 0,
    createdAt: Date.now()
  }
}

export function generateWallets(count: number, labelPrefix: string): WalletInfo[] {
  const db = getDb()
  const insert = db.prepare(
    'INSERT INTO wallets (id, public_key, label, is_main, encrypted_key, created_at) VALUES (?, ?, ?, 0, ?, ?)'
  )

  const wallets: WalletInfo[] = []

  const insertMany = db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const keypair = Keypair.generate()
      const publicKey = keypair.publicKey.toBase58()
      const secretKeyBase58 = bs58.encode(keypair.secretKey)
      const encryptedKey = encryptKey(secretKeyBase58)
      const id = generateId()
      const now = Date.now()
      const label = `${labelPrefix} ${i + 1}`

      insert.run(id, publicKey, label, encryptedKey, now)
      wallets.push({ id, publicKey, label, isMain: false, balanceSol: 0, createdAt: now })
    }
  })

  insertMany()
  return wallets
}

export function listWallets(): WalletRecord[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM wallets ORDER BY is_main DESC, created_at ASC').all() as Array<{
    id: string
    public_key: string
    label: string
    is_main: number
    encrypted_key: string
    created_at: number
  }>

  return rows.map((r) => ({
    id: r.id,
    publicKey: r.public_key,
    label: r.label,
    isMain: r.is_main === 1,
    encryptedKey: r.encrypted_key,
    createdAt: r.created_at
  }))
}

export async function listWalletsWithBalances(): Promise<WalletInfo[]> {
  const records = listWallets()
  const connection = getConnection()

  const publicKeys = records.map((r) => new PublicKey(r.publicKey))
  const balances = await Promise.allSettled(publicKeys.map((pk) => connection.getBalance(pk)))

  return records.map((r, i) => {
    const result = balances[i]
    if (result.status === 'rejected') {
      console.error(`[wallet-manager] Balance fetch failed for ${r.publicKey}:`, result.reason)
    }
    const balanceSol = result.status === 'fulfilled' ? result.value / LAMPORTS_PER_SOL : 0
    return {
      id: r.id,
      publicKey: r.publicKey,
      label: r.label,
      isMain: r.isMain,
      balanceSol,
      createdAt: r.createdAt
    }
  })
}

export function deleteWallet(walletId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM wallets WHERE id = ?').run(walletId)
}

export function getKeypair(walletId: string): Keypair {
  const db = getDb()
  const row = db.prepare('SELECT encrypted_key FROM wallets WHERE id = ?').get(walletId) as
    | { encrypted_key: string }
    | undefined

  if (!row) throw new Error(`Wallet ${walletId} not found`)

  const secretKeyBase58 = decryptKey(row.encrypted_key)
  const decoded = bs58.decode(secretKeyBase58)
  const keypair = Keypair.fromSecretKey(decoded)
  // Zero the decoded buffer to minimize secret key exposure in memory
  decoded.fill(0)
  return keypair
}

function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Send one transfer per transaction with random delays to avoid on-chain linking
async function sendIndividualTransfer(
  fromKeypair: Keypair,
  toPubkey: PublicKey,
  lamports: number
): Promise<string> {
  const connection = getConnection()
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey,
      lamports
    })
  )

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  tx.feePayer = fromKeypair.publicKey

  const sig = await connection.sendTransaction(tx, [fromKeypair])
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    'confirmed'
  )
  return sig
}

export async function fundWallets(
  fromWalletId: string,
  toWalletIds: string[],
  amountSolEach: number
): Promise<string[]> {
  const fromKeypair = getKeypair(fromWalletId)
  const lamportsEach = Math.floor(amountSolEach * LAMPORTS_PER_SOL)
  const signatures: string[] = []

  const errors: string[] = []

  for (const walletId of toWalletIds) {
    const db = getDb()
    const row = db.prepare('SELECT public_key FROM wallets WHERE id = ?').get(walletId) as
      | { public_key: string }
      | undefined
    if (!row) continue

    try {
      const sig = await sendIndividualTransfer(fromKeypair, new PublicKey(row.public_key), lamportsEach)
      signatures.push(sig)
    } catch (err: any) {
      errors.push(`${row.public_key.slice(0, 8)}: ${err?.message || 'Transfer failed'}`)
    }

    // Random delay between 2-8 seconds to avoid same-block linking
    if (walletId !== toWalletIds[toWalletIds.length - 1]) {
      await randomDelay(2000, 8000)
    }
  }

  if (signatures.length === 0 && errors.length > 0) {
    throw new Error(`All transfers failed: ${errors[0]}`)
  }

  return signatures
}

export async function fundWalletsRandomized(
  fromWalletId: string,
  allocations: { walletId: string; amountSol: number }[]
): Promise<string[]> {
  const fromKeypair = getKeypair(fromWalletId)
  const signatures: string[] = []

  const errors: string[] = []

  for (const alloc of allocations) {
    const db = getDb()
    const row = db.prepare('SELECT public_key FROM wallets WHERE id = ?').get(alloc.walletId) as
      | { public_key: string }
      | undefined
    if (!row) continue

    const lamports = Math.floor(alloc.amountSol * LAMPORTS_PER_SOL)
    if (lamports <= 0) continue

    try {
      const sig = await sendIndividualTransfer(fromKeypair, new PublicKey(row.public_key), lamports)
      signatures.push(sig)
    } catch (err: any) {
      errors.push(`${row.public_key.slice(0, 8)}: ${err?.message || 'Transfer failed'}`)
    }

    // Random delay between 2-8 seconds to avoid same-block linking
    if (alloc !== allocations[allocations.length - 1]) {
      await randomDelay(2000, 8000)
    }
  }

  if (signatures.length === 0 && errors.length > 0) {
    throw new Error(`All transfers failed: ${errors[0]}`)
  }

  return signatures
}

// Multi-hop funding: Main → ephemeral hop wallet → sub-wallet
// Each sub-wallet is funded from a unique intermediate address to break on-chain links
export async function fundWalletsHopped(
  fromWalletId: string,
  allocations: { walletId: string; amountSol: number }[]
): Promise<string[]> {
  const fromKeypair = getKeypair(fromWalletId)
  const connection = getConnection()
  const signatures: string[] = []
  const errors: string[] = []

  // Fee per hop: base tx fee + buffer
  const hopFeeLamports = 10_000 // 0.00001 SOL per hop, covers tx fee

  // Phase 1: Generate ephemeral hop wallets and fund them from main
  const hops: { hopKeypair: Keypair; targetPubkey: PublicKey; targetLamports: number }[] = []

  for (const alloc of allocations) {
    const db = getDb()
    const row = db.prepare('SELECT public_key FROM wallets WHERE id = ?').get(alloc.walletId) as
      | { public_key: string }
      | undefined
    if (!row) continue

    const targetLamports = Math.floor(alloc.amountSol * LAMPORTS_PER_SOL)
    if (targetLamports <= 0) continue

    const hopKeypair = Keypair.generate()
    // Fund hop wallet with target amount + fee for the second transfer
    const hopAmount = targetLamports + hopFeeLamports

    try {
      const sig = await sendIndividualTransfer(fromKeypair, hopKeypair.publicKey, hopAmount)
      signatures.push(sig)
      hops.push({ hopKeypair, targetPubkey: new PublicKey(row.public_key), targetLamports })
    } catch (err: any) {
      errors.push(`hop for ${row.public_key.slice(0, 8)}: ${err?.message || 'Transfer failed'}`)
    }

    // Random delay 3-10s between hop funding
    if (alloc !== allocations[allocations.length - 1]) {
      await randomDelay(3000, 10000)
    }
  }

  // Random delay between phases (5-15s)
  if (hops.length > 0) {
    await randomDelay(5000, 15000)
  }

  // Phase 2: Each hop wallet sends to its target sub-wallet
  for (const hop of hops) {
    try {
      const balance = await connection.getBalance(hop.hopKeypair.publicKey)
      const sendAmount = balance - 5000 // leave just enough for tx fee
      if (sendAmount <= 0) continue

      const sig = await sendIndividualTransfer(hop.hopKeypair, hop.targetPubkey, sendAmount)
      signatures.push(sig)
    } catch (err: any) {
      errors.push(`hop→${hop.targetPubkey.toBase58().slice(0, 8)}: ${err?.message || 'Transfer failed'}`)
    }

    // Random delay 3-10s between final transfers
    if (hop !== hops[hops.length - 1]) {
      await randomDelay(3000, 10000)
    }
  }

  if (signatures.length === 0 && errors.length > 0) {
    throw new Error(`All transfers failed: ${errors[0]}`)
  }

  return signatures
}

export async function reclaimWallets(walletIds: string[], toWalletId: string): Promise<string[]> {
  const connection = getConnection()
  const toDb = getDb()
  const toRow = toDb.prepare('SELECT public_key FROM wallets WHERE id = ?').get(toWalletId) as
    | { public_key: string }
    | undefined
  if (!toRow) throw new Error('Destination wallet not found')

  const toPubkey = new PublicKey(toRow.public_key)
  const signatures: string[] = []

  for (const walletId of walletIds) {
    try {
      const keypair = getKeypair(walletId)
      const balance = await connection.getBalance(keypair.publicKey)
      const fee = 5000 // estimated tx fee in lamports
      const amount = balance - fee

      if (amount <= 0) continue

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports: amount
        })
      )

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = keypair.publicKey

      const sig = await connection.sendTransaction(tx, [keypair])
      await connection.confirmTransaction(
        { signature: sig, blockhash, lastValidBlockHeight },
        'confirmed'
      )
      signatures.push(sig)
    } catch {
      // Skip wallets that fail (empty balance, etc.)
    }
  }

  return signatures
}

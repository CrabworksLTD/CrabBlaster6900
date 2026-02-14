import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { encryptKey, decryptKey } from '../storage/secure-storage'
import type { LicenseStatus } from '@shared/types'

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000 // 24 hours

function getWhopApiKey(): string {
  // Access via bracket notation to prevent electron-vite/Vite from replacing at build time.
  // The main process runs in Node.js, so process.env is available at runtime.
  const env = process['env']
  const key = env['WHOP_API_KEY']
  if (!key) throw new Error('WHOP_API_KEY environment variable is not set. Add it to your .env file.')
  return key
}

interface StoredLicense {
  encryptedKey: string
  lastValidated: number
}

function getLicensePath(): string {
  const dir = join(app.getPath('userData'), 'license')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'license.json')
}

function readStored(): StoredLicense | null {
  const path = getLicensePath()
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function writeStored(data: StoredLicense): void {
  writeFileSync(getLicensePath(), JSON.stringify(data))
}

function removeStored(): void {
  const path = getLicensePath()
  if (existsSync(path)) {
    writeFileSync(path, '')
  }
}

async function callWhopApi(licenseKey: string): Promise<boolean> {
  try {
    const apiKey = getWhopApiKey()
    const res = await fetch(
      `https://api.whop.com/api/v5/memberships/${encodeURIComponent(licenseKey)}/validate_license`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    )
    if (!res.ok) return false
    const data = await res.json()
    return data.valid === true
  } catch {
    return false
  }
}

export async function checkLicense(): Promise<LicenseStatus> {
  const stored = readStored()
  if (!stored) {
    return { valid: false, lastValidated: null }
  }

  let key: string
  try {
    key = decryptKey(stored.encryptedKey)
  } catch {
    return { valid: false, lastValidated: null }
  }

  const valid = await callWhopApi(key)
  if (valid) {
    writeStored({ encryptedKey: stored.encryptedKey, lastValidated: Date.now() })
    return { valid: true, lastValidated: Date.now() }
  }

  // Offline grace period: if last validated within 24h, still allow
  const elapsed = Date.now() - stored.lastValidated
  if (elapsed < GRACE_PERIOD_MS) {
    return { valid: true, lastValidated: stored.lastValidated }
  }

  return { valid: false, lastValidated: stored.lastValidated }
}

export async function validateLicense(licenseKey: string): Promise<LicenseStatus> {
  const valid = await callWhopApi(licenseKey)
  if (!valid) {
    return { valid: false, lastValidated: null }
  }

  const encrypted = encryptKey(licenseKey)
  writeStored({ encryptedKey: encrypted, lastValidated: Date.now() })
  return { valid: true, lastValidated: Date.now() }
}

export function clearLicense(): void {
  removeStored()
}

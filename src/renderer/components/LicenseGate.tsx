import { useState, useEffect, type ReactNode, type FormEvent } from 'react'

const PURCHASE_URL = 'https://whop.com/crabblaster9000/'

export function LicenseGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true)
  const [licensed, setLicensed] = useState(false)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    window.electronAPI
      .invoke('license:check')
      .then((status) => {
        setLicensed(status.valid)
      })
      .catch(() => {
        setLicensed(false)
      })
      .finally(() => setChecking(false))
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!key.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      const status = await window.electronAPI.invoke('license:validate', { licenseKey: key.trim() })
      if (status.valid) {
        setLicensed(true)
      } else {
        setError('Invalid license key. Please check your key and try again.')
      }
    } catch {
      setError('Failed to validate license. Please check your connection.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-win-teal">
        <div className="win-window w-80">
          <div className="win-titlebar">
            <span>CrabBlaster9000</span>
          </div>
          <div className="p-6 bg-win-bg text-center text-[11px]">
            Checking license...
          </div>
        </div>
      </div>
    )
  }

  if (licensed) {
    return <>{children}</>
  }

  return (
    <div className="flex h-screen items-center justify-center bg-win-teal p-2">
      <div className="win-window w-[420px]">
        <div className="win-titlebar">
          <span>CrabBlaster9000 - License Activation</span>
          <div className="flex gap-0.5">
            <button className="win-titlebar-btn">✕</button>
          </div>
        </div>
        <div className="p-5 bg-win-bg">
          <div className="flex gap-4 mb-4">
            <div className="text-4xl select-none">🦀</div>
            <div className="text-[11px] leading-relaxed">
              <p className="font-bold mb-1">Welcome to CrabBlaster9000!</p>
              <p>
                Enter your license key to activate the app.
                Purchase a subscription to get your key.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="block text-[11px] mb-1">License Key:</label>
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your license key..."
                className="w-full shadow-win-in bg-white px-2 py-1 text-[11px] outline-none"
                disabled={submitting}
                autoFocus
              />
            </div>

            {error && (
              <div className="mb-3 shadow-win-in bg-white px-2 py-1 text-[11px] text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-between items-center">
              <a
                href={PURCHASE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-blue-800 underline hover:text-blue-600"
              >
                Purchase a license
              </a>
              <button
                type="submit"
                disabled={submitting || !key.trim()}
                className="win-btn px-6 py-1 text-[11px] disabled:opacity-50"
              >
                {submitting ? 'Validating...' : 'Activate'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

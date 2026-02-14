import { ipcMain } from 'electron'
import { z } from 'zod'
import { checkLicense, validateLicense, clearLicense } from '../services/license-manager'

export function registerLicenseIpc(): void {
  ipcMain.handle('license:check', async () => {
    return checkLicense()
  })

  ipcMain.handle('license:validate', async (_event, params: unknown) => {
    const { licenseKey } = z.object({ licenseKey: z.string().min(1) }).parse(params)
    return validateLicense(licenseKey)
  })

  ipcMain.handle('license:clear', async () => {
    clearLicense()
  })
}

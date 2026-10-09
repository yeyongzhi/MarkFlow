import { describe, expect, it, vi } from 'vitest'
import { installProtectedUpdate } from '@/services/update-install'

function fixture() {
  return { update: { download: vi.fn().mockResolvedValue(undefined), install: vi.fn().mockResolvedValue(undefined) }, session: { flush: vi.fn().mockResolvedValue(true), protectDrafts: vi.fn().mockResolvedValue(true), persistNow: vi.fn().mockResolvedValue(undefined) }, sync: vi.fn(), progress: vi.fn() }
}
describe('update installation protects documents', () => {
  it('blocks downloading when the current document cannot save', async () => {
    const f = fixture(); f.session.flush.mockResolvedValue(false)
    await expect(installProtectedUpdate(f.update, f.session, f.sync, f.progress)).rejects.toThrow('未保存')
    expect(f.update.download).not.toHaveBeenCalled(); expect(f.update.install).not.toHaveBeenCalled()
  })
  it('does not install a package after download or signature verification fails', async () => {
    const f = fixture(); f.update.download.mockRejectedValue(new Error('invalid signature'))
    await expect(installProtectedUpdate(f.update, f.session, f.sync, f.progress)).rejects.toThrow('invalid signature')
    expect(f.update.install).not.toHaveBeenCalled()
  })
  it('blocks installation when changes during downloading cannot save', async () => {
    const f = fixture(); f.session.flush.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    await expect(installProtectedUpdate(f.update, f.session, f.sync, f.progress)).rejects.toThrow('未保存')
    expect(f.update.download).toHaveBeenCalledOnce(); expect(f.update.install).not.toHaveBeenCalled()
  })
  it('blocks downloading when recovery protection fails', async () => {
    const f = fixture(); f.session.protectDrafts.mockResolvedValue(false)
    await expect(installProtectedUpdate(f.update, f.session, f.sync, f.progress)).rejects.toThrow('未保存')
    expect(f.update.download).not.toHaveBeenCalled()
  })
})

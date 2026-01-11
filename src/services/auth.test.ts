import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getLoginQRCode,
  checkQRCodeStatus,
  saveCookies,
  loadSavedCookies,
  logout,
  checkLoginStatus,
} from './auth'

// Mock bilibili service
vi.mock('./bilibili', () => ({
  setCookies: vi.fn(),
  getCookies: vi.fn(() => ''),
  getBuvidCookies: vi.fn(() => 'buvid3=test; buvid4=test'),
  getCurrentUser: vi.fn(() => Promise.resolve(null)),
}))

// Mock Tauri store
const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  save: vi.fn(),
}

vi.mock('@tauri-apps/plugin-store', () => ({
  load: vi.fn(() => Promise.resolve(mockStore)),
}))

// Mock Tauri HTTP fetch
vi.mock('@tauri-apps/plugin-http', () => ({
  fetch: vi.fn(),
}))

import { setCookies, getCookies, getCurrentUser } from './bilibili'

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const fetchMock = vi.fn()
    global.fetch = fetchMock
    window.fetch = fetchMock
    window.localStorage.clear()
    mockStore.get.mockResolvedValue(null)
    mockStore.set.mockResolvedValue(undefined)
    mockStore.delete.mockResolvedValue(undefined)
    mockStore.save.mockResolvedValue(undefined)
  })

  describe('getLoginQRCode', () => {
    it('should return QR code data on success', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          code: 0,
          data: {
            url: 'https://passport.bilibili.com/qrcode/h5/login?oauthKey=abc123',
            qrcode_key: 'abc123',
          },
        })),
      })

      const result = await getLoginQRCode()

      expect(result).not.toBeNull()
      expect(result?.url).toContain('passport.bilibili.com')
      expect(result?.qrcode_key).toBe('abc123')
    })

    it('should throw on API error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          code: -1,
          message: 'Error',
        })),
      })

      await expect(getLoginQRCode()).rejects.toThrow('Failed to get QR code')
    })

    it('should throw on network error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(getLoginQRCode()).rejects.toThrow('Network error')
    })
  })

  describe('checkQRCodeStatus', () => {
    it('should return waiting status when not scanned', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          code: 0,
          data: { code: 86101 },
        })),
      })

      const result = await checkQRCodeStatus('test_key')

      expect(result.code).toBe(86101)
      expect(result.message).toBe('Waiting for scan...')
    })

    it('should return scanned status when waiting for confirm', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          code: 0,
          data: { code: 86090 },
        })),
      })

      const result = await checkQRCodeStatus('test_key')

      expect(result.code).toBe(86090)
      expect(result.message).toBe('Scanned - please confirm on your phone')
    })

    it('should return expired status', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          code: 0,
          data: { code: 86038 },
        })),
      })

      const result = await checkQRCodeStatus('test_key')

      expect(result.code).toBe(86038)
      expect(result.message).toBe('QR code expired')
    })

    it('should extract cookies and save on successful login', async () => {
      const loginUrl = 'https://passport.bilibili.com/account/setlogin?DedeUserID=12345&DedeUserID__ckMd5=abc&SESSDATA=session123&bili_jct=csrf'

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          code: 0,
          data: {
            code: 0,
            url: loginUrl,
          },
        })),
      })

      const result = await checkQRCodeStatus('test_key')

      expect(result.code).toBe(0)
      expect(result.message).toBe('Login successful')
      expect(result.cookies).toContain('DedeUserID=12345')
      expect(result.cookies).toContain('SESSDATA=session123')
      expect(setCookies).toHaveBeenCalled()
      const stored = window.localStorage.getItem('bilibili_auth')
      expect(stored).toBeNull()
    })

    it('should handle network error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const result = await checkQRCodeStatus('test_key')

      expect(result.code).toBe(-1)
      expect(result.message).toBe('Network error')
    })

    it('should handle API error response', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          code: -400,
          message: 'Bad Request',
        })),
      })

      const result = await checkQRCodeStatus('test_key')

      expect(result.code).toBe(-400)
      expect(result.message).toBe('Bad Request')
    })
  })

  describe('saveCookies', () => {
    it('should avoid persisting cookies in web storage', async () => {
      await saveCookies('SESSDATA=test123')

      const stored = window.localStorage.getItem('bilibili_auth')
      expect(stored).toBeNull()
    })

    it('should handle save error gracefully', async () => {
      mockStore.set.mockRejectedValueOnce(new Error('Storage error'))

      // Should not throw
      await expect(saveCookies('test')).resolves.toBeUndefined()
    })
  })

  describe('loadSavedCookies', () => {
    it('should not load cookies from web storage', async () => {
      window.localStorage.setItem('bilibili_auth', JSON.stringify({ cookies: 'SESSDATA=saved123' }))

      const result = await loadSavedCookies()

      expect(result).toBeNull()
      expect(setCookies).not.toHaveBeenCalled()
      expect(window.localStorage.getItem('bilibili_auth')).toBeNull()
    })

    it('should return null when no saved cookies', async () => {
      const result = await loadSavedCookies()

      expect(result).toBeNull()
    })

    it('should return null on load error', async () => {
      window.localStorage.setItem('bilibili_auth', '{broken-json')

      const result = await loadSavedCookies()

      expect(result).toBeNull()
      expect(window.localStorage.getItem('bilibili_auth')).toBeNull()
    })
  })

  describe('logout', () => {
    it('should delete cookies from store and clear memory', async () => {
      window.localStorage.setItem('bilibili_auth', JSON.stringify({ cookies: 'SESSDATA=stored' }))

      await logout()

      expect(window.localStorage.getItem('bilibili_auth')).toBeNull()
      expect(setCookies).toHaveBeenCalledWith('')
    })

    it('should handle logout error gracefully', async () => {
      mockStore.delete.mockRejectedValueOnce(new Error('Delete error'))

      // Should not throw
      await expect(logout()).resolves.toBeUndefined()
    })
  })

  describe('checkLoginStatus', () => {
    it('should return user when auth succeeds', async () => {
      ;(getCookies as ReturnType<typeof vi.fn>).mockReturnValue('')
      ;(getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        mid: 12345,
        name: 'TestUser',
      })

      const result = await checkLoginStatus()

      expect(result).not.toBeNull()
      expect(result?.name).toBe('TestUser')
    })

    it('should return null when not logged in', async () => {
      ;(getCookies as ReturnType<typeof vi.fn>).mockReturnValue('')
      mockStore.get.mockResolvedValueOnce(null)
      ;(getCurrentUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)

      const result = await checkLoginStatus()

      expect(result).toBeNull()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from './useAuth'

// Mock auth service
vi.mock('../services/auth', () => ({
  checkLoginStatus: vi.fn(),
  logout: vi.fn(),
  loadSavedCookies: vi.fn(),
}))

import { checkLoginStatus, logout as authLogout, loadSavedCookies } from '../services/auth'

describe('useAuth Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(loadSavedCookies as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(checkLoginStatus as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(authLogout as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
  })

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth())

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
    expect(result.current.isLoggedIn).toBe(false)
  })

  it('should set user when logged in', async () => {
    const mockUser = {
      mid: 12345,
      name: 'TestUser',
      face: 'http://face.jpg',
      sign: 'Test',
      level: 5,
      isLogin: true,
    }

    ;(checkLoginStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toEqual(mockUser)
    expect(result.current.isLoggedIn).toBe(true)
  })

  it('should remain null when not logged in', async () => {
    ;(checkLoginStatus as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
    expect(result.current.isLoggedIn).toBe(false)
  })

  it('should handle logout', async () => {
    const mockUser = {
      mid: 12345,
      name: 'TestUser',
      face: '',
      sign: '',
      level: 1,
      isLogin: true,
    }

    ;(checkLoginStatus as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser)
    })

    await act(async () => {
      await result.current.logout()
    })

    expect(authLogout).toHaveBeenCalled()
    expect(result.current.user).toBeNull()
  })

  it('should refresh auth status', async () => {
    ;(checkLoginStatus as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        mid: 12345,
        name: 'NewUser',
        face: '',
        sign: '',
        level: 1,
        isLogin: true,
      })

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()

    await act(async () => {
      await result.current.refreshAuth()
    })

    expect(result.current.user?.name).toBe('NewUser')
  })

  it('should handle auth check error gracefully', async () => {
    ;(checkLoginStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Auth error')
    )

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user).toBeNull()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTrending,
  searchVideos,
  getVideosByCategory,
  getCurrentUser,
  getVideoUrl,
  formatDuration,
  formatViewCount,
  setCookies,
  getCookies,
} from './bilibili'

// Mock the translate module
vi.mock('./translate', () => ({
  translateToEnglish: vi.fn((text) => Promise.resolve(`EN: ${text}`)),
  translateToChinese: vi.fn((text) => Promise.resolve(`ZH: ${text}`)),
}))

// Sample API response data
const mockVideoData = {
  code: 0,
  message: 'OK',
  data: {
    list: [
      {
        bvid: 'BV1test123',
        aid: 123456,
        title: '测试视频标题',
        desc: '测试描述',
        pic: 'http://i1.hdslb.com/test.jpg',
        duration: 180,
        stat: {
          view: 100000,
          danmaku: 500,
          reply: 200,
          favorite: 1000,
          coin: 800,
          share: 300,
          like: 5000,
        },
        owner: {
          mid: 12345,
          name: '测试UP主',
          face: 'http://i1.hdslb.com/face.jpg',
        },
        pubdate: Math.floor(Date.now() / 1000) - 3600,
        cid: 789,
      },
    ],
  },
}

const mockSearchData = {
  code: 0,
  message: 'OK',
  data: {
    result: [
      {
        bvid: 'BV1search123',
        aid: 654321,
        title: '<em class="keyword">搜索</em>结果标题',
        description: '搜索结果描述',
        pic: '//i1.hdslb.com/search.jpg',
        duration: '5:30',
        play: 50000,
        danmaku: 300,
        favorites: 500,
        like: 2000,
        mid: 54321,
        author: '搜索UP主',
        upic: 'http://face.jpg',
        pubdate: Math.floor(Date.now() / 1000) - 7200,
      },
    ],
    numResults: 100,
  },
}

const mockUserData = {
  code: 0,
  data: {
    isLogin: true,
    mid: 12345,
    uname: 'TestUser',
    face: 'http://face.jpg',
    sign: 'Test signature',
    level_info: {
      current_level: 5,
    },
  },
}

describe('Bilibili Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset cookies
    setCookies('')

    // Mock window.fetch for dev mode (uses Vite proxy)
    const fetchMock = vi.fn()
    global.fetch = fetchMock
    window.fetch = fetchMock
  })

  describe('Cookie Management', () => {
    it('should set and get cookies', () => {
      expect(getCookies()).toBe('')

      setCookies('SESSDATA=test123; bili_jct=abc')
      expect(getCookies()).toBe('SESSDATA=test123; bili_jct=abc')
    })

    it('should clear cookies when set to empty string', () => {
      setCookies('SESSDATA=test123')
      setCookies('')
      expect(getCookies()).toBe('')
    })
  })

  describe('getTrending', () => {
    it('should fetch trending videos successfully', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVideoData),
        text: () => Promise.resolve(JSON.stringify(mockVideoData)),
      })

      const result = await getTrending(1)

      expect(result.videos).toHaveLength(1)
      expect(result.videos[0].bvid).toBe('BV1test123')
      expect(result.videos[0].title).toBe('测试视频标题')
      expect(result.videos[0].titleEn).toBe('EN: 测试视频标题')
      expect(result.videos[0].view).toBe(100000)
      expect(result.error).toBeUndefined()
    })

    it('should handle API error response', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(JSON.stringify({
          code: -1,
          message: 'API Error',
        })),
      })

      const result = await getTrending(1)

      expect(result.videos).toHaveLength(0)
    })

    it('should handle network error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const result = await getTrending(1)

      expect(result.videos).toHaveLength(0)
      expect(result.error).toContain('Network error')
    })

    it('should handle empty response', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(''),
      })

      const result = await getTrending(1)

      expect(result.videos).toHaveLength(0)
      expect(result.error).toBe('Empty response from API')
    })

    it('should handle HTTP error status', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      const result = await getTrending(1)

      expect(result.videos).toHaveLength(0)
    })
  })

  describe('searchVideos', () => {
    it('should search videos with translation', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchData),
      })

      const result = await searchVideos('test query', 1, true)

      expect(result.videos).toHaveLength(1)
      expect(result.videos[0].bvid).toBe('BV1search123')
      // HTML tags should be stripped from title
      expect(result.videos[0].title).toBe('搜索结果标题')
      expect(result.total).toBe(100)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(20)
    })

    it('should search without translating query', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSearchData),
      })

      const result = await searchVideos('中文查询', 1, false)

      expect(result.videos).toHaveLength(1)
    })

    it('should handle search API error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: -1, message: 'Error' }),
      })

      const result = await searchVideos('test', 1)

      expect(result.videos).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('should handle empty search results', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          data: { result: null, numResults: 0 },
        }),
      })

      const result = await searchVideos('nonexistent', 1)

      expect(result.videos).toHaveLength(0)
    })
  })

  describe('getVideosByCategory', () => {
    it('should fetch videos by category', async () => {
      // Category API returns paged data in data.archives
      const categoryData = {
        code: 0,
        data: {
          archives: [mockVideoData.data.list[0]],
          page: { count: 40 },
        },
      }

      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(categoryData),
      })

      const result = await getVideosByCategory(1, 1)

      expect(result.videos).toHaveLength(1)
    })

    it('should use popular endpoint for category 0', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVideoData),
      })

      await getVideosByCategory(0, 1)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bili/x/web-interface/popular'),
        expect.any(Object)
      )
    })

    it('should use paged region endpoint for other categories', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: 0, data: { archives: [], page: { count: 0 } } }),
      })

      await getVideosByCategory(3, 1)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/bili/x/web-interface/dynamic/region'),
        expect.any(Object)
      )
    })
  })

  describe('getCurrentUser', () => {
    it('should return user when logged in', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockUserData),
      })

      const user = await getCurrentUser()

      expect(user).not.toBeNull()
      expect(user?.mid).toBe(12345)
      expect(user?.name).toBe('TestUser')
      expect(user?.level).toBe(5)
      expect(user?.isLogin).toBe(true)
    })

    it('should return null when not logged in', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          code: 0,
          data: { isLogin: false },
        }),
      })

      const user = await getCurrentUser()

      expect(user).toBeNull()
    })

    it('should return null on API error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ code: -1 }),
      })

      const user = await getCurrentUser()

      expect(user).toBeNull()
    })
  })

  describe('getVideoUrl', () => {
    it('should generate correct video URL', () => {
      const url = getVideoUrl('BV1test123')
      expect(url).toBe('https://www.bilibili.com/video/BV1test123')
    })
  })

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(45)).toBe('0:45')
    })

    it('should format minutes and seconds', () => {
      expect(formatDuration(125)).toBe('2:05')
    })

    it('should format hours, minutes and seconds', () => {
      expect(formatDuration(3661)).toBe('1:01:01')
    })

    it('should pad single digits', () => {
      expect(formatDuration(65)).toBe('1:05')
    })
  })

  describe('formatViewCount', () => {
    it('should format small numbers as-is', () => {
      expect(formatViewCount(999)).toBe('999')
    })

    it('should format thousands with K', () => {
      expect(formatViewCount(1500)).toBe('1.5K')
    })

    it('should format ten-thousands with W (万)', () => {
      expect(formatViewCount(15000)).toBe('1.5W')
    })

    it('should format hundred millions with B (亿)', () => {
      expect(formatViewCount(150000000)).toBe('1.5B')
    })
  })
})

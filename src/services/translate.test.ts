import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateToEnglish, translateToChinese, translateBatch } from './translate'

describe('Translate Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.fetch for dev mode
    const fetchMock = vi.fn()
    global.fetch = fetchMock
    window.fetch = fetchMock
  })

  describe('translateToEnglish', () => {
    it('should return empty string for empty input', async () => {
      const result = await translateToEnglish('')
      expect(result).toBe('')
    })

    it('should return whitespace-only string as-is', async () => {
      const result = await translateToEnglish('   ')
      expect(result).toBe('   ')
    })

    it('should translate Chinese to English', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          [['Hello World', '你好世界']],
        ]),
      })

      const result = await translateToEnglish('你好世界')

      expect(result).toBe('Hello World')
    })

    it('should cache translations', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          [['Cached Result', '缓存测试']],
        ]),
      })

      // First call - should fetch
      const result1 = await translateToEnglish('缓存测试')
      expect(result1).toBe('Cached Result')
      expect(global.fetch).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      const result2 = await translateToEnglish('缓存测试')
      expect(result2).toBe('Cached Result')
      expect(global.fetch).toHaveBeenCalledTimes(1) // No additional fetch
    })

    it('should return original text on API error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await translateToEnglish('错误测试')

      expect(result).toBe('错误测试')
    })

    it('should return original text on network error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const result = await translateToEnglish('网络错误')

      expect(result).toBe('网络错误')
    })

    it('should handle malformed API response', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ unexpected: 'format' }),
      })

      const result = await translateToEnglish('格式错误')

      expect(result).toBe('格式错误')
    })

    it('should concatenate multi-part translations', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          [
            ['Hello ', '你好'],
            ['World', '世界'],
          ],
        ]),
      })

      const result = await translateToEnglish('你好世界长文本')

      expect(result).toBe('Hello World')
    })
  })

  describe('translateToChinese', () => {
    it('should return empty string for empty input', async () => {
      const result = await translateToChinese('')
      expect(result).toBe('')
    })

    it('should translate English to Chinese', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          [['你好世界', 'Hello World']],
        ]),
      })

      const result = await translateToChinese('Hello World')

      expect(result).toBe('你好世界')
    })

    it('should cache Chinese translations separately', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          [['中文缓存', 'Cache Test']],
        ]),
      })

      const result1 = await translateToChinese('Cache Test')
      expect(result1).toBe('中文缓存')

      const result2 = await translateToChinese('Cache Test')
      expect(result2).toBe('中文缓存')
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('should return original text on error', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Network error')
      )

      const result = await translateToChinese('Error Test')

      expect(result).toBe('Error Test')
    })
  })

  describe('translateBatch', () => {
    it('should translate multiple texts in parallel', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([[['First', '第一']]]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([[['Second', '第二']]]),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([[['Third', '第三']]]),
        })

      const results = await translateBatch(['第一', '第二', '第三'])

      expect(results).toHaveLength(3)
      expect(results[0]).toBe('First')
      expect(results[1]).toBe('Second')
      expect(results[2]).toBe('Third')
    })

    it('should handle empty array', async () => {
      const results = await translateBatch([])
      expect(results).toHaveLength(0)
    })

    it('should continue on individual failures', async () => {
      ;(global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([[['Success', '成功']]]),
        })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([[['Also Success', '也成功']]]),
        })

      const results = await translateBatch(['成功', '失败', '也成功'])

      expect(results[0]).toBe('Success')
      expect(results[1]).toBe('失败') // Original text on failure
      expect(results[2]).toBe('Also Success')
    })
  })
})

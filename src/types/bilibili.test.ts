import { describe, it, expect } from 'vitest'
import { CATEGORIES } from './bilibili'
import type { BiliVideo, BiliCategory, BiliUser, BiliSearchResult, BiliTrendingResult } from './bilibili'

describe('Bilibili Types', () => {
  describe('CATEGORIES', () => {
    it('should have All category at index 0', () => {
      expect(CATEGORIES[0]).toEqual({
        tid: 0,
        name: '全部',
        nameEn: 'All',
      })
    })

    it('should have unique tids', () => {
      const tids = CATEGORIES.map(c => c.tid)
      const uniqueTids = new Set(tids)
      expect(uniqueTids.size).toBe(tids.length)
    })

    it('should have English names for all categories', () => {
      CATEGORIES.forEach(category => {
        expect(category.nameEn).toBeTruthy()
        expect(typeof category.nameEn).toBe('string')
      })
    })

    it('should include popular categories', () => {
      const categoryNames = CATEGORIES.map(c => c.nameEn)
      expect(categoryNames).toContain('Animation')
      expect(categoryNames).toContain('Music')
      expect(categoryNames).toContain('Gaming')
      expect(categoryNames).toContain('Technology')
    })

    it('should have valid tid numbers', () => {
      CATEGORIES.forEach(category => {
        expect(typeof category.tid).toBe('number')
        expect(category.tid).toBeGreaterThanOrEqual(0)
      })
    })
  })

  describe('Type Definitions', () => {
    it('should allow creating BiliVideo with required fields', () => {
      const video: BiliVideo = {
        bvid: 'BV1test',
        aid: 123,
        title: 'Test',
        desc: 'Description',
        pic: 'http://test.jpg',
        duration: 60,
        view: 1000,
        danmaku: 100,
        reply: 50,
        favorite: 200,
        coin: 150,
        share: 80,
        like: 500,
        owner: {
          mid: 1,
          name: 'Owner',
          face: 'http://face.jpg',
        },
        pubdate: 1234567890,
      }

      expect(video.bvid).toBe('BV1test')
    })

    it('should allow optional titleEn and descEn', () => {
      const video: BiliVideo = {
        bvid: 'BV1test',
        aid: 123,
        title: '中文标题',
        titleEn: 'English Title',
        desc: '描述',
        descEn: 'Description',
        pic: 'http://test.jpg',
        duration: 60,
        view: 1000,
        danmaku: 100,
        reply: 50,
        favorite: 200,
        coin: 150,
        share: 80,
        like: 500,
        owner: {
          mid: 1,
          name: 'Owner',
          face: 'http://face.jpg',
        },
        pubdate: 1234567890,
      }

      expect(video.titleEn).toBe('English Title')
      expect(video.descEn).toBe('Description')
    })

    it('should allow optional cid field', () => {
      const video: BiliVideo = {
        bvid: 'BV1test',
        aid: 123,
        title: 'Test',
        desc: '',
        pic: '',
        duration: 60,
        view: 0,
        danmaku: 0,
        reply: 0,
        favorite: 0,
        coin: 0,
        share: 0,
        like: 0,
        owner: { mid: 1, name: '', face: '' },
        pubdate: 0,
        cid: 456789,
      }

      expect(video.cid).toBe(456789)
    })

    it('should create valid BiliUser', () => {
      const user: BiliUser = {
        mid: 12345,
        name: 'TestUser',
        face: 'http://face.jpg',
        sign: 'Signature',
        level: 6,
        isLogin: true,
      }

      expect(user.isLogin).toBe(true)
      expect(user.level).toBe(6)
    })

    it('should create valid BiliCategory', () => {
      const category: BiliCategory = {
        tid: 1,
        name: '动画',
        nameEn: 'Animation',
      }

      expect(category.tid).toBe(1)
    })

    it('should create valid BiliSearchResult', () => {
      const result: BiliSearchResult = {
        videos: [],
        total: 0,
        page: 1,
        pageSize: 20,
      }

      expect(result.pageSize).toBe(20)
    })

    it('should create valid BiliTrendingResult with optional error', () => {
      const result: BiliTrendingResult = {
        videos: [],
        error: 'Test error',
      }

      expect(result.error).toBe('Test error')
    })
  })
})

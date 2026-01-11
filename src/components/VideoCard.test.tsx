import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { VideoCard } from './VideoCard'
import type { BiliVideo } from '../types/bilibili'

// Mock Tauri shell
vi.mock('@tauri-apps/plugin-shell', () => ({
  open: vi.fn(() => Promise.resolve()),
}))

// Mock window.open as fallback
const mockOpen = vi.fn()
global.open = mockOpen

describe('VideoCard Component', () => {
  const mockVideo: BiliVideo = {
    bvid: 'BV1test123',
    aid: 123456,
    title: '测试视频标题',
    titleEn: 'Test Video Title',
    desc: '测试描述',
    pic: 'http://i1.hdslb.com/test.jpg',
    duration: 180,
    view: 100000,
    danmaku: 500,
    reply: 200,
    favorite: 1000,
    coin: 800,
    share: 300,
    like: 5000,
    owner: {
      mid: 12345,
      name: '测试UP主',
      face: 'http://i1.hdslb.com/face.jpg',
    },
    pubdate: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render video title in English when available', () => {
    render(<VideoCard video={mockVideo} />)

    expect(screen.getByText('Test Video Title')).toBeInTheDocument()
  })

  it('should show original Chinese title below English title', () => {
    render(<VideoCard video={mockVideo} />)

    expect(screen.getByText('测试视频标题')).toBeInTheDocument()
  })

  it('should render video title in Chinese when no English translation', () => {
    const videoWithoutTranslation = { ...mockVideo, titleEn: undefined }
    render(<VideoCard video={videoWithoutTranslation} />)

    expect(screen.getByText('测试视频标题')).toBeInTheDocument()
  })

  it('should display formatted duration', () => {
    render(<VideoCard video={mockVideo} />)

    // 180 seconds = 3:00
    expect(screen.getByText('3:00')).toBeInTheDocument()
  })

  it('should display formatted view count', () => {
    render(<VideoCard video={mockVideo} />)

    // 100000 views = 10.0W
    expect(screen.getByText('10.0W')).toBeInTheDocument()
  })

  it('should display owner name', () => {
    render(<VideoCard video={mockVideo} />)

    expect(screen.getByText('测试UP主')).toBeInTheDocument()
  })

  it('should display time ago', () => {
    render(<VideoCard video={mockVideo} />)

    expect(screen.getByText('1h ago')).toBeInTheDocument()
  })

  it('should open video URL on click', async () => {
    const { open } = await import('@tauri-apps/plugin-shell')

    render(<VideoCard video={mockVideo} />)

    const card = screen.getByText('Test Video Title').closest('div')
    fireEvent.click(card!)

    // Should try Tauri shell first
    expect(open).toHaveBeenCalledWith(
      'https://www.bilibili.com/video/BV1test123'
    )
  })

  it('should proxy image URLs in dev mode', () => {
    render(<VideoCard video={mockVideo} />)

    const img = screen.getByAltText('Test Video Title')
    // In dev mode, should be proxied through /img/hdslb
    expect(img).toHaveAttribute('src', '/img/hdslb/test.jpg')
  })

  it('should proxy owner face URL in dev mode', () => {
    render(<VideoCard video={mockVideo} />)

    const ownerImg = screen.getByAltText('测试UP主')
    expect(ownerImg).toHaveAttribute('src', '/img/hdslb/face.jpg')
  })

  it('should handle missing owner face', () => {
    const videoWithoutFace = {
      ...mockVideo,
      owner: { ...mockVideo.owner, face: '' },
    }
    render(<VideoCard video={videoWithoutFace} />)

    expect(screen.queryByAltText('测试UP主')).not.toBeInTheDocument()
  })

  describe('Time Ago Formatting', () => {
    it('should show "Just now" for very recent videos', () => {
      const recentVideo = {
        ...mockVideo,
        pubdate: Math.floor(Date.now() / 1000) - 30, // 30 seconds ago
      }
      render(<VideoCard video={recentVideo} />)
      expect(screen.getByText('Just now')).toBeInTheDocument()
    })

    it('should show minutes ago', () => {
      const video = {
        ...mockVideo,
        pubdate: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
      }
      render(<VideoCard video={video} />)
      expect(screen.getByText('5m ago')).toBeInTheDocument()
    })

    it('should show days ago', () => {
      const video = {
        ...mockVideo,
        pubdate: Math.floor(Date.now() / 1000) - 172800, // 2 days ago
      }
      render(<VideoCard video={video} />)
      expect(screen.getByText('2d ago')).toBeInTheDocument()
    })

    it('should show weeks ago', () => {
      const video = {
        ...mockVideo,
        pubdate: Math.floor(Date.now() / 1000) - 1209600, // 2 weeks ago
      }
      render(<VideoCard video={video} />)
      expect(screen.getByText('2w ago')).toBeInTheDocument()
    })
  })
})

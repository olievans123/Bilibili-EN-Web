import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoGrid } from './VideoGrid'
import type { BiliVideo } from '../types/bilibili'

describe('VideoGrid Component', () => {
  const mockVideos: BiliVideo[] = [
    {
      bvid: 'BV1test1',
      aid: 1,
      title: '视频1',
      titleEn: 'Video 1',
      desc: '',
      pic: 'http://test1.jpg',
      duration: 60,
      view: 1000,
      danmaku: 100,
      reply: 50,
      favorite: 200,
      coin: 150,
      share: 80,
      like: 500,
      owner: { mid: 1, name: 'UP1', face: '' },
      pubdate: Date.now() / 1000,
    },
    {
      bvid: 'BV1test2',
      aid: 2,
      title: '视频2',
      titleEn: 'Video 2',
      desc: '',
      pic: 'http://test2.jpg',
      duration: 120,
      view: 2000,
      danmaku: 200,
      reply: 100,
      favorite: 400,
      coin: 300,
      share: 160,
      like: 1000,
      owner: { mid: 2, name: 'UP2', face: '' },
      pubdate: Date.now() / 1000,
    },
  ]

  it('should render all videos', () => {
    render(<VideoGrid videos={mockVideos} loading={false} />)

    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.getByText('Video 2')).toBeInTheDocument()
  })

  it('should show loading skeleton when loading', () => {
    render(<VideoGrid videos={[]} loading={true} />)

    // Should show skeleton cards when loading
    const skeletons = document.querySelectorAll('[style*="background"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should return null when no videos (parent handles empty state)', () => {
    const { container } = render(<VideoGrid videos={[]} loading={false} />)

    // VideoGrid returns null when empty, parent handles the empty state
    expect(container.firstChild).toBeNull()
  })

  it('should render video owners', () => {
    render(<VideoGrid videos={mockVideos} loading={false} />)

    expect(screen.getByText('UP1')).toBeInTheDocument()
    expect(screen.getByText('UP2')).toBeInTheDocument()
  })

  it('should render video durations', () => {
    render(<VideoGrid videos={mockVideos} loading={false} />)

    expect(screen.getByText('1:00')).toBeInTheDocument()
    expect(screen.getByText('2:00')).toBeInTheDocument()
  })

  it('should display videos in a grid layout', () => {
    render(<VideoGrid videos={mockVideos} loading={false} />)

    // Check that the grid container exists with proper styles
    const grid = document.querySelector('[style*="grid"]')
    expect(grid).toBeInTheDocument()
  })

  it('should handle single video', () => {
    render(<VideoGrid videos={[mockVideos[0]]} loading={false} />)

    expect(screen.getByText('Video 1')).toBeInTheDocument()
    expect(screen.queryByText('Video 2')).not.toBeInTheDocument()
  })

  it('should render formatted view counts', () => {
    render(<VideoGrid videos={mockVideos} loading={false} />)

    // 1000 views = 1.0K
    expect(screen.getByText('1.0K')).toBeInTheDocument()
    // 2000 views = 2.0K
    expect(screen.getByText('2.0K')).toBeInTheDocument()
  })
})

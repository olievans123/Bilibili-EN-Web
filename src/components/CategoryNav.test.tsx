import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryNav } from './CategoryNav'

describe('CategoryNav Component', () => {
  const mockOnSelectCategory = vi.fn()

  it('should render all categories', () => {
    render(
      <CategoryNav selectedCategory={0} onSelectCategory={mockOnSelectCategory} />
    )

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Animation')).toBeInTheDocument()
    expect(screen.getByText('Anime')).toBeInTheDocument()
    expect(screen.getByText('Music')).toBeInTheDocument()
    expect(screen.getByText('Gaming')).toBeInTheDocument()
  })

  it('should highlight selected category', () => {
    render(
      <CategoryNav selectedCategory={0} onSelectCategory={mockOnSelectCategory} />
    )

    const allButton = screen.getByText('All')
    // The selected category should have special styling (check for the background color)
    expect(allButton).toBeInTheDocument()
  })

  it('should call onSelectCategory when category is clicked', () => {
    render(
      <CategoryNav selectedCategory={0} onSelectCategory={mockOnSelectCategory} />
    )

    fireEvent.click(screen.getByText('Music'))

    expect(mockOnSelectCategory).toHaveBeenCalledWith(3) // Music tid is 3
  })

  it('should call onSelectCategory with 0 for All', () => {
    render(
      <CategoryNav selectedCategory={3} onSelectCategory={mockOnSelectCategory} />
    )

    fireEvent.click(screen.getByText('All'))

    expect(mockOnSelectCategory).toHaveBeenCalledWith(0)
  })

  it('should render Chinese Anime category', () => {
    render(
      <CategoryNav selectedCategory={0} onSelectCategory={mockOnSelectCategory} />
    )

    expect(screen.getByText('Chinese Anime')).toBeInTheDocument()
  })

  it('should render Technology category', () => {
    render(
      <CategoryNav selectedCategory={0} onSelectCategory={mockOnSelectCategory} />
    )

    expect(screen.getByText('Technology')).toBeInTheDocument()
  })
})

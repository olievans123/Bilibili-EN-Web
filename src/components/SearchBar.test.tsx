import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SearchBar } from './SearchBar'

describe('SearchBar Component', () => {
  const mockOnSearch = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render with placeholder text', () => {
    render(<SearchBar onSearch={mockOnSearch} />)

    expect(screen.getByPlaceholderText('Search in English...')).toBeInTheDocument()
  })

  it('should update input value on change', () => {
    render(<SearchBar onSearch={mockOnSearch} />)

    const input = screen.getByPlaceholderText('Search in English...')
    fireEvent.change(input, { target: { value: 'test query' } })

    expect(input).toHaveValue('test query')
  })

  it('should call onSearch when form is submitted', () => {
    render(<SearchBar onSearch={mockOnSearch} />)

    const input = screen.getByPlaceholderText('Search in English...')
    fireEvent.change(input, { target: { value: 'anime' } })

    const form = input.closest('form')!
    fireEvent.submit(form)

    expect(mockOnSearch).toHaveBeenCalledWith('anime')
  })

  it('should not call onSearch with empty query', () => {
    render(<SearchBar onSearch={mockOnSearch} />)

    const input = screen.getByPlaceholderText('Search in English...')
    const form = input.closest('form')!
    fireEvent.submit(form)

    expect(mockOnSearch).not.toHaveBeenCalled()
  })

  it('should trim whitespace from query', () => {
    render(<SearchBar onSearch={mockOnSearch} />)

    const input = screen.getByPlaceholderText('Search in English...')
    fireEvent.change(input, { target: { value: '  music  ' } })

    const form = input.closest('form')!
    fireEvent.submit(form)

    expect(mockOnSearch).toHaveBeenCalledWith('music')
  })

  it('should render search button', () => {
    render(<SearchBar onSearch={mockOnSearch} />)

    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
  })

  it('should call onSearch when search button is clicked', () => {
    render(<SearchBar onSearch={mockOnSearch} />)

    const input = screen.getByPlaceholderText('Search in English...')
    fireEvent.change(input, { target: { value: 'games' } })

    const button = screen.getByRole('button', { name: /search/i })
    fireEvent.click(button)

    expect(mockOnSearch).toHaveBeenCalledWith('games')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import Entry from '../../pages/Entry'
import * as entriesService from '../../services/entries'
import * as itemsService from '../../services/items'

// Mock dos contextos
const mockCurrentUser = {
  uid: 'user123',
  email: 'test@example.com',
}

const mockAuthContext = {
  currentUser: mockCurrentUser,
  isAdmin: true,
  hasPermission: vi.fn(() => true),
}

const mockToastContext = {
  success: vi.fn(),
  error: vi.fn(),
}

const mockItemsContext = {
  refreshItems: vi.fn(),
}

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}))

vi.mock('../../context/ToastContext', () => ({
  useToastContext: () => mockToastContext,
}))

vi.mock('../../context/ItemsContext', () => ({
  useItems: () => mockItemsContext,
}))

vi.mock('../../services/entries', () => ({
  addEntry: vi.fn(),
}))

vi.mock('../../services/items', () => ({
  getItemByCodigo: vi.fn(),
}))

const mockNavigate = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Wrapper para componentes que precisam de router
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>)
}

describe('Entry Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  it('deve renderizar o formulário de entrada', () => {
    renderWithRouter(<Entry />)

    // Usar getByRole para pegar o heading (h1) especificamente
    expect(screen.getByRole('heading', { name: /registrar entrada/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/digite ou escaneie o código/i)).toBeInTheDocument()
    const form = document.querySelector('form')
    expect(form?.querySelector('input[name="quantidade"]')).toBeInTheDocument()
  })

  it('deve permitir preencher código de barras', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Entry />)

    const codigoInput = screen.getByPlaceholderText(/digite ou escaneie o código/i)
    await user.type(codigoInput, '123456789')

    expect(codigoInput).toHaveValue('123456789')
  })

  it('deve buscar item quando código é digitado', async () => {
    const user = userEvent.setup()
    const mockItem = {
      id: 'item123',
      codigo: '123456789',
      nome: 'Item Teste',
      quantidade: 10,
      unidade: 'UN',
    }

    itemsService.getItemByCodigo.mockResolvedValue(mockItem)

    renderWithRouter(<Entry />)

    const codigoInput = screen.getByPlaceholderText(/digite ou escaneie o código/i)
    await user.type(codigoInput, '123456789')

    // Aguardar debounce
    await waitFor(
      () => {
        expect(itemsService.getItemByCodigo).toHaveBeenCalledWith('123456789')
      },
      { timeout: 1000 }
    )
  })

  it('deve exibir item encontrado quando código existe', async () => {
    const user = userEvent.setup()
    const mockItem = {
      id: 'item123',
      codigo: '123456789',
      nome: 'Item Teste',
      quantidade: 50,
      unidade: 'UN',
    }

    itemsService.getItemByCodigo.mockResolvedValue(mockItem)

    renderWithRouter(<Entry />)

    const codigoInput = screen.getByPlaceholderText(/digite ou escaneie o código/i)
    await user.type(codigoInput, '123456789')

    await waitFor(
      () => {
        expect(screen.getByText(/item encontrado/i)).toBeInTheDocument()
        expect(screen.getByText(/Item Teste/i)).toBeInTheDocument()
        expect(screen.getByText(/50 UN/i)).toBeInTheDocument()
      },
      { timeout: 1000 }
    )
  })

  it('deve validar campos obrigatórios ao submeter', async () => {
    const user = userEvent.setup()
    renderWithRouter(<Entry />)

    const submitButton = screen.getByRole('button', { name: /registrar entrada/i })
    await user.click(submitButton)

    // Deve mostrar erro porque quantidade não foi preenchida
    await waitFor(() => {
      const errorMessages = screen.queryAllByText(/quantidade/i)
      expect(errorMessages.length).toBeGreaterThan(0)
    })
  })

  it('deve processar entrada com sucesso', async () => {
    const user = userEvent.setup()
    const mockItem = {
      id: 'item123',
      codigo: '123456789',
      nome: 'Item Teste',
      quantidade: 50,
    }
    
    itemsService.getItemByCodigo.mockResolvedValue(mockItem)
    entriesService.addEntry.mockResolvedValue('entry-id-123')

    renderWithRouter(<Entry />)

    // Preencher código (isso vai buscar o item)
    const codigoInput = screen.getByPlaceholderText(/digite ou escaneie o código/i)
    await user.type(codigoInput, '123456789')

    // Aguardar item ser encontrado
    await waitFor(() => {
      expect(itemsService.getItemByCodigo).toHaveBeenCalled()
    }, { timeout: 1000 })

    // Buscar input de quantidade por name
    const quantidadeInput = document.querySelector('input[name="quantidade"]')
    expect(quantidadeInput).toBeInTheDocument()
    await user.type(quantidadeInput, '10')

    // Submeter
    const submitButton = screen.getByRole('button', { name: /registrar entrada/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(entriesService.addEntry).toHaveBeenCalled()
      expect(mockToastContext.success).toHaveBeenCalledWith(
        'Entrada registrada com sucesso!'
      )
    })
  })

  it('deve mostrar erro quando entrada falha', async () => {
    const user = userEvent.setup()
    const mockItem = {
      id: 'item123',
      codigo: '123456789',
      nome: 'Item Teste',
      quantidade: 50,
    }
    
    itemsService.getItemByCodigo.mockResolvedValue(mockItem)
    entriesService.addEntry.mockRejectedValue(new Error('Erro ao registrar entrada'))

    renderWithRouter(<Entry />)

    // Preencher código
    const codigoInput = screen.getByPlaceholderText(/digite ou escaneie o código/i)
    await user.type(codigoInput, '123456789')

    await waitFor(() => {
      expect(itemsService.getItemByCodigo).toHaveBeenCalled()
    }, { timeout: 1000 })

    // Preencher quantidade
    const quantidadeInput = document.querySelector('input[name="quantidade"]')
    expect(quantidadeInput).toBeInTheDocument()
    await user.type(quantidadeInput, '10')

    // Submeter
    const submitButton = screen.getByRole('button', { name: /registrar entrada/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockToastContext.error).toHaveBeenCalled()
    })
  })

  it('deve bloquear acesso se usuário não tiver permissão', () => {
    mockAuthContext.isAdmin = false
    mockAuthContext.hasPermission = vi.fn(() => false)

    renderWithRouter(<Entry />)

    expect(screen.getByText(/acesso restrito/i)).toBeInTheDocument()
    expect(
      screen.getByText(/você não tem permissão para registrar entradas/i)
    ).toBeInTheDocument()
  })
})


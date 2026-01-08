import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as entriesService from '../../services/entries'
import * as itemsService from '../../services/items'
import * as batchesService from '../../services/batches'

// Mock dos módulos Firebase
vi.mock('../../services/firebase', () => ({
  db: {},
}))

vi.mock('../../services/items', () => ({
  addItem: vi.fn(),
  getItemByCodigo: vi.fn(),
  getItemById: vi.fn(),
  incrementStock: vi.fn(),
  updateItem: vi.fn(),
}))

vi.mock('../../services/batches', () => ({
  addOrIncrementBatch: vi.fn(),
  getEarliestBatchValidity: vi.fn(),
}))

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore')
  return {
    ...actual,
    collection: vi.fn(),
    addDoc: vi.fn(async () => ({ id: 'mock-entry-id' })),
    serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
  }
})

vi.mock('../../utils/errorHandler', () => ({
  getErrorMessage: vi.fn((error) => error.message),
  logError: vi.fn(),
}))

describe('Entries Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addEntry', () => {
    it('deve lançar erro se quantidade for inválida', async () => {
      await expect(
        entriesService.addEntry(
          {
            codigo: '123',
            quantidade: 0,
          },
          'user123'
        )
      ).rejects.toThrow('Quantidade deve ser maior que zero')
    })

    it('deve lançar erro se não houver código nem nome', async () => {
      await expect(
        entriesService.addEntry(
          {
            quantidade: 10,
          },
          'user123'
        )
      ).rejects.toThrow('Nome do item é obrigatório quando não há código de barras')
    })

    it('deve criar item automaticamente se não existir', async () => {
      const mockItemId = 'new-item-id'
      const mockNewItem = {
        id: mockItemId,
        codigo: '123',
        nome: 'Novo Item',
        quantidade: 0,
      }

      itemsService.getItemByCodigo
        .mockResolvedValueOnce(null) // Primeira busca: não existe
        .mockResolvedValueOnce(mockNewItem) // Segunda busca: após criar

      itemsService.addItem.mockResolvedValue(mockItemId)
      itemsService.incrementStock.mockResolvedValue(undefined)
      batchesService.addOrIncrementBatch.mockResolvedValue(undefined)
      batchesService.getEarliestBatchValidity.mockResolvedValue(null)

      const entryId = await entriesService.addEntry(
        {
          codigo: '123',
          nome: 'Novo Item',
          quantidade: 10,
        },
        'user123'
      )

      expect(itemsService.addItem).toHaveBeenCalled()
      expect(itemsService.incrementStock).toHaveBeenCalled()
      expect(entryId).toBe('mock-entry-id')
    })

    it('deve incrementar estoque de item existente', async () => {
      const existingItem = {
        id: 'item123',
        codigo: '123',
        nome: 'Item Existente',
        quantidade: 50,
      }

      itemsService.getItemByCodigo.mockResolvedValue(existingItem)
      itemsService.incrementStock.mockResolvedValue(undefined)
      batchesService.addOrIncrementBatch.mockResolvedValue(undefined)
      batchesService.getEarliestBatchValidity.mockResolvedValue(null)

      const entryId = await entriesService.addEntry(
        {
          codigo: '123',
          quantidade: 10,
        },
        'user123'
      )

      expect(itemsService.getItemByCodigo).toHaveBeenCalledWith('123')
      expect(itemsService.incrementStock).toHaveBeenCalledWith('item123', 10)
      expect(itemsService.addItem).not.toHaveBeenCalled()
      expect(entryId).toBe('mock-entry-id')
    })

    it('deve normalizar validade corretamente', async () => {
      const existingItem = {
        id: 'item123',
        codigo: '123',
        nome: 'Item Existente',
        quantidade: 50,
      }

      itemsService.getItemByCodigo.mockResolvedValue(existingItem)
      itemsService.incrementStock.mockResolvedValue(undefined)
      batchesService.addOrIncrementBatch.mockResolvedValue(undefined)
      batchesService.getEarliestBatchValidity.mockResolvedValue('2024-12-31')
      itemsService.updateItem.mockResolvedValue(undefined)

      await entriesService.addEntry(
        {
          codigo: '123',
          quantidade: 10,
          validade: '2024-12-31',
        },
        'user123'
      )

      expect(batchesService.addOrIncrementBatch).toHaveBeenCalledWith(
        'item123',
        '2024-12-31',
        10
      )
    })

    it('deve tratar validade vazia como null', async () => {
      const existingItem = {
        id: 'item123',
        codigo: '123',
        nome: 'Item Existente',
        quantidade: 50,
      }

      itemsService.getItemByCodigo.mockResolvedValue(existingItem)
      itemsService.incrementStock.mockResolvedValue(undefined)
      batchesService.addOrIncrementBatch.mockResolvedValue(undefined)
      batchesService.getEarliestBatchValidity.mockResolvedValue(null)

      await entriesService.addEntry(
        {
          codigo: '123',
          quantidade: 10,
          validade: '',
        },
        'user123'
      )

      expect(batchesService.addOrIncrementBatch).toHaveBeenCalledWith(
        'item123',
        null,
        10
      )
    })
  })
})


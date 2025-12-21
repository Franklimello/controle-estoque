import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as exitsService from '../../services/exits'
import * as itemsService from '../../services/items'
import * as batchesService from '../../services/batches'

// Mock dos módulos Firebase
vi.mock('../../services/firebase', () => ({
  db: {},
}))

vi.mock('../../services/items', () => ({
  getItemByCodigo: vi.fn(),
  getItemById: vi.fn(),
  decrementStock: vi.fn(),
  updateItem: vi.fn(),
}))

vi.mock('../../services/batches', () => ({
  consumeFromBatches: vi.fn(),
  getEarliestBatchValidity: vi.fn(),
}))

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore')
  return {
    ...actual,
    collection: vi.fn(),
    addDoc: vi.fn(async () => ({ id: 'mock-exit-id' })),
    serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
  }
})

vi.mock('../../utils/errorHandler', () => ({
  getErrorMessage: vi.fn((error) => error.message),
  logError: vi.fn(),
}))

describe('Exits Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('addExit', () => {
    it('deve lançar erro se quantidade for inválida', async () => {
      await expect(
        exitsService.addExit(
          {
            codigo: '123',
            quantidade: 0,
            setorDestino: 'Setor A',
          },
          'user123'
        )
      ).rejects.toThrow('Quantidade deve ser maior que zero')
    })

    it('deve lançar erro se não houver código nem itemId', async () => {
      await expect(
        exitsService.addExit(
          {
            quantidade: 10,
            setorDestino: 'Setor A',
          },
          'user123'
        )
      ).rejects.toThrow('Código de barras ou ID do item é obrigatório')
    })

    it('deve lançar erro se item não for encontrado', async () => {
      itemsService.getItemByCodigo.mockResolvedValue(null)

      await expect(
        exitsService.addExit(
          {
            codigo: '123',
            quantidade: 10,
            setorDestino: 'Setor A',
          },
          'user123'
        )
      ).rejects.toThrow('Item não encontrado')
    })

    it('deve lançar erro se estoque for insuficiente', async () => {
      const item = {
        id: 'item123',
        codigo: '123',
        nome: 'Item Teste',
        quantidade: 5, // Estoque menor que o solicitado
      }

      itemsService.getItemByCodigo.mockResolvedValue(item)

      await expect(
        exitsService.addExit(
          {
            codigo: '123',
            quantidade: 10, // Tentando sair mais que o disponível
            setorDestino: 'Setor A',
          },
          'user123'
        )
      ).rejects.toThrow('Estoque insuficiente')
    })

    it('deve processar saída com sucesso quando estoque é suficiente', async () => {
      const item = {
        id: 'item123',
        codigo: '123',
        nome: 'Item Teste',
        quantidade: 50,
      }

      itemsService.getItemByCodigo.mockResolvedValue(item)
      itemsService.decrementStock.mockResolvedValue(undefined)
      batchesService.consumeFromBatches.mockResolvedValue({
        usedBatches: [],
      })
      batchesService.getEarliestBatchValidity.mockResolvedValue(null)
      itemsService.updateItem.mockResolvedValue(undefined)

      const exitId = await exitsService.addExit(
        {
          codigo: '123',
          quantidade: 10,
          setorDestino: 'Setor A',
        },
        'user123'
      )

      expect(itemsService.decrementStock).toHaveBeenCalledWith('item123', 10)
      expect(batchesService.consumeFromBatches).toHaveBeenCalledWith(
        'item123',
        10
      )
      expect(exitId).toBe('mock-exit-id')
    })

    it('deve buscar item por itemId quando código não for fornecido', async () => {
      const item = {
        id: 'item123',
        codigo: '123',
        nome: 'Item Teste',
        quantidade: 50,
      }

      itemsService.getItemById.mockResolvedValue(item)
      itemsService.decrementStock.mockResolvedValue(undefined)
      batchesService.consumeFromBatches.mockResolvedValue({
        usedBatches: [],
      })
      batchesService.getEarliestBatchValidity.mockResolvedValue(null)
      itemsService.updateItem.mockResolvedValue(undefined)

      await exitsService.addExit(
        {
          itemId: 'item123',
          quantidade: 10,
          setorDestino: 'Setor A',
        },
        'user123'
      )

      expect(itemsService.getItemById).toHaveBeenCalledWith('item123')
      expect(itemsService.decrementStock).toHaveBeenCalled()
    })

    it('deve atualizar validade do item quando houver lotes restantes', async () => {
      const item = {
        id: 'item123',
        codigo: '123',
        nome: 'Item Teste',
        quantidade: 50,
      }

      itemsService.getItemByCodigo.mockResolvedValue(item)
      itemsService.decrementStock.mockResolvedValue(undefined)
      batchesService.consumeFromBatches.mockResolvedValue({
        usedBatches: [],
      })
      batchesService.getEarliestBatchValidity.mockResolvedValue('2024-12-31')
      itemsService.updateItem.mockResolvedValue(undefined)

      await exitsService.addExit(
        {
          codigo: '123',
          quantidade: 10,
          setorDestino: 'Setor A',
        },
        'user123'
      )

      expect(itemsService.updateItem).toHaveBeenCalledWith(
        'item123',
        { validade: '2024-12-31' }
      )
    })

    it('deve limpar validade quando não houver lotes restantes', async () => {
      const item = {
        id: 'item123',
        codigo: '123',
        nome: 'Item Teste',
        quantidade: 50,
      }

      itemsService.getItemByCodigo.mockResolvedValue(item)
      itemsService.decrementStock.mockResolvedValue(undefined)
      batchesService.consumeFromBatches.mockResolvedValue({
        usedBatches: [],
      })
      batchesService.getEarliestBatchValidity.mockResolvedValue(null)
      itemsService.updateItem.mockResolvedValue(undefined)

      await exitsService.addExit(
        {
          codigo: '123',
          quantidade: 10,
          setorDestino: 'Setor A',
        },
        'user123'
      )

      expect(itemsService.updateItem).toHaveBeenCalledWith('item123', {
        validade: '',
      })
    })
  })
})



import { describe, it, expect } from 'vitest'
import {
  isValidCodigo,
  isValidQuantidade,
  isValidEmail,
  isValidPassword,
  validateItem,
  validateEntry,
  validateExit,
  formatDate,
} from '../../utils/validators'

describe('Validators', () => {
  describe('isValidCodigo', () => {
    it('deve retornar true para código válido', () => {
      expect(isValidCodigo('123456789')).toBe(true)
      expect(isValidCodigo('ABC123')).toBe(true)
    })

    it('deve retornar false para código vazio', () => {
      expect(isValidCodigo('')).toBeFalsy()
      expect(isValidCodigo('   ')).toBeFalsy()
      expect(isValidCodigo(null)).toBeFalsy()
      expect(isValidCodigo(undefined)).toBeFalsy()
    })
  })

  describe('isValidQuantidade', () => {
    it('deve retornar true para quantidade válida', () => {
      expect(isValidQuantidade(1)).toBe(true)
      expect(isValidQuantidade(100)).toBe(true)
      expect(isValidQuantidade(0.5)).toBe(true)
    })

    it('deve retornar false para quantidade inválida', () => {
      expect(isValidQuantidade(0)).toBe(false)
      expect(isValidQuantidade(-1)).toBe(false)
      expect(isValidQuantidade(NaN)).toBe(false)
      expect(isValidQuantidade(Infinity)).toBe(false)
      expect(isValidQuantidade('10')).toBe(false)
      expect(isValidQuantidade(null)).toBe(false)
      expect(isValidQuantidade(undefined)).toBe(false)
    })
  })

  describe('isValidEmail', () => {
    it('deve retornar true para emails válidos', () => {
      expect(isValidEmail('teste@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    })

    it('deve retornar false para emails inválidos', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('teste@')).toBe(false)
      expect(isValidEmail('')).toBe(false)
    })
  })

  describe('isValidPassword', () => {
    it('deve retornar true para senhas válidas (mínimo 6 caracteres)', () => {
      expect(isValidPassword('123456')).toBe(true)
      expect(isValidPassword('senha123')).toBe(true)
      expect(isValidPassword('senha muito longa')).toBe(true)
    })

    it('deve retornar false para senhas inválidas', () => {
      expect(isValidPassword('12345')).toBe(false) // Menos de 6 caracteres
      expect(isValidPassword('')).toBeFalsy()
      expect(isValidPassword(null)).toBeFalsy()
      expect(isValidPassword(undefined)).toBeFalsy()
    })
  })

  describe('validateItem', () => {
    it('deve validar item com dados corretos', () => {
      const result = validateItem({
        nome: 'Item Teste',
        quantidade: 10,
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('deve rejeitar item sem nome', () => {
      const result = validateItem({
        quantidade: 10,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Nome é obrigatório')
    })

    it('deve rejeitar item com quantidade negativa', () => {
      const result = validateItem({
        nome: 'Item Teste',
        quantidade: -5,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Quantidade não pode ser negativa')
    })

    it('deve aceitar item sem código de barras (opcional)', () => {
      const result = validateItem({
        nome: 'Item sem código',
        quantidade: 10,
      })

      expect(result.isValid).toBe(true)
    })

    it('deve aceitar item sem quantidade definida', () => {
      const result = validateItem({
        nome: 'Item sem quantidade',
      })

      expect(result.isValid).toBe(true)
    })
  })

  describe('validateEntry', () => {
    it('deve validar entrada com código e quantidade válidos', () => {
      const result = validateEntry({
        codigo: '123456',
        quantidade: 10,
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('deve validar entrada com nome e quantidade válidos (sem código)', () => {
      const result = validateEntry({
        nome: 'Item Teste',
        quantidade: 10,
      })

      expect(result.isValid).toBe(true)
    })

    it('deve rejeitar entrada sem código e sem nome', () => {
      const result = validateEntry({
        quantidade: 10,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Código de barras ou nome do item é obrigatório')
    })

    it('deve rejeitar entrada com quantidade inválida', () => {
      const result = validateEntry({
        codigo: '123456',
        quantidade: -5,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Quantidade deve ser um número positivo')
    })

    it('deve rejeitar entrada com quantidade zero', () => {
      const result = validateEntry({
        codigo: '123456',
        quantidade: 0,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Quantidade deve ser um número positivo')
    })

    it('deve rejeitar entrada com quantidade não numérica', () => {
      const result = validateEntry({
        codigo: '123456',
        quantidade: 'abc',
      })

      expect(result.isValid).toBe(false)
    })
  })

  describe('validateExit', () => {
    it('deve validar saída com código e quantidade válidos', () => {
      const result = validateExit({
        codigo: '123456',
        quantidade: 10,
        setorDestino: 'Setor A',
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('deve validar saída com itemId e quantidade válidos', () => {
      const result = validateExit({
        itemId: 'item123',
        quantidade: 10,
        setorDestino: 'Setor B',
      })

      expect(result.isValid).toBe(true)
    })

    it('deve rejeitar saída sem código e sem itemId', () => {
      const result = validateExit({
        quantidade: 10,
        setorDestino: 'Setor A',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Informe um código de barras ou selecione o item')
    })

    it('deve rejeitar saída sem setor destino', () => {
      const result = validateExit({
        codigo: '123456',
        quantidade: 10,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Setor destino é obrigatório')
    })

    it('deve rejeitar saída com quantidade inválida', () => {
      const result = validateExit({
        codigo: '123456',
        quantidade: -5,
        setorDestino: 'Setor A',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Quantidade deve ser um número positivo')
    })
  })

  describe('formatDate', () => {
    it('deve formatar data corretamente', () => {
      const date = new Date('2024-01-15T10:30:00')
      const formatted = formatDate(date)

      expect(formatted).toBeTruthy()
      expect(typeof formatted).toBe('string')
      expect(formatted).toContain('15')
      expect(formatted).toContain('01')
      expect(formatted).toContain('2024')
    })

    it('deve retornar string vazia para data null/undefined', () => {
      expect(formatDate(null)).toBe('')
      expect(formatDate(undefined)).toBe('')
    })

    it('deve formatar Timestamp do Firestore', () => {
      // Mock de Timestamp do Firestore
      const mockTimestamp = {
        toDate: () => new Date('2024-01-15T10:30:00'),
      }

      const formatted = formatDate(mockTimestamp)
      expect(formatted).toBeTruthy()
      expect(typeof formatted).toBe('string')
    })
  })
})


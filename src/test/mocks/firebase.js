import { vi } from 'vitest'

// Mock do Firestore
export const mockDoc = vi.fn((path) => ({
  id: 'mock-doc-id',
  path,
  data: vi.fn(() => ({})),
  exists: vi.fn(() => true),
}))

export const mockCollection = vi.fn((path) => ({
  id: 'mock-collection-id',
  path,
}))

export const mockQuery = vi.fn((collectionRef, ...constraints) => ({
  collectionRef,
  constraints,
}))

export const mockGetDoc = vi.fn(async (docRef) => ({
  exists: () => true,
  data: () => ({}),
  id: docRef.id,
}))

export const mockGetDocs = vi.fn(async (queryRef) => ({
  docs: [],
  empty: true,
  size: 0,
  forEach: vi.fn(),
}))

export const mockAddDoc = vi.fn(async (collectionRef, data) => ({
  id: 'mock-new-doc-id',
}))

export const mockUpdateDoc = vi.fn(async (docRef, data) => {
  return Promise.resolve()
})

export const mockDeleteDoc = vi.fn(async (docRef) => {
  return Promise.resolve()
})

export const mockRunTransaction = vi.fn(async (updateFunction) => {
  const mockTransaction = {
    get: vi.fn(async (docRef) => ({
      exists: () => true,
      data: () => ({}),
      id: docRef.id,
    })),
    update: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  }

  return await updateFunction(mockTransaction)
})

export const mockServerTimestamp = vi.fn(() => ({
  toDate: () => new Date(),
}))

export const mockWhere = vi.fn((field, operator, value) => ({
  type: 'where',
  field,
  operator,
  value,
}))

export const mockOrderBy = vi.fn((field, direction = 'asc') => ({
  type: 'orderBy',
  field,
  direction,
}))

// Mock do Firebase Auth
export const mockSignInWithEmailAndPassword = vi.fn(async (auth, email, password) => ({
  user: {
    uid: 'mock-user-id',
    email,
  },
}))

export const mockSignOut = vi.fn(async () => Promise.resolve())

export const mockOnAuthStateChanged = vi.fn((auth, callback) => {
  // Simular usuário logado
  callback({
    uid: 'mock-user-id',
    email: 'test@example.com',
  })

  // Retornar função de unsubscribe
  return () => {}
})

// Criar mock do módulo Firebase
export const createMockFirebase = () => {
  return {
    db: {
      // Mock do Firestore
    },
    auth: {
      // Mock do Auth
    },
    collection: mockCollection,
    doc: mockDoc,
    getDoc: mockGetDoc,
    getDocs: mockGetDocs,
    addDoc: mockAddDoc,
    updateDoc: mockUpdateDoc,
    deleteDoc: mockDeleteDoc,
    runTransaction: mockRunTransaction,
    serverTimestamp: mockServerTimestamp,
    query: mockQuery,
    where: mockWhere,
    orderBy: mockOrderBy,
  }
}



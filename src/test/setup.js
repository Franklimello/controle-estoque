import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock do Firebase
global.mockFirestoreDoc = vi.fn()
global.mockFirestoreCollection = vi.fn()
global.mockFirestoreQuery = vi.fn()

// Mock do window.alert e window.confirm
global.alert = vi.fn()
global.confirm = vi.fn(() => true)



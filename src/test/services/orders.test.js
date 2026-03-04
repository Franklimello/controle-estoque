import { describe, it, expect, vi, beforeEach } from "vitest";
import * as firestore from "firebase/firestore";
import * as ordersService from "../../services/orders";
import * as exitsService from "../../services/exits";
import * as itemsService from "../../services/items";

vi.mock("../../services/firebase", () => ({
  db: {},
}));

vi.mock("../../services/exits", () => ({
  addExit: vi.fn(),
}));

vi.mock("../../services/items", () => ({
  getItemById: vi.fn(),
}));

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual("firebase/firestore");
  return {
    ...actual,
    collection: vi.fn(),
    addDoc: vi.fn(async () => ({ id: "order-id" })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    getDoc: vi.fn(),
    updateDoc: vi.fn(async () => undefined),
    doc: vi.fn(() => ({ id: "doc-id" })),
    query: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    serverTimestamp: vi.fn(() => ({ toDate: () => new Date() })),
    Timestamp: {
      fromDate: vi.fn((date) => date),
    },
  };
});

describe("Orders Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockApprovedOrder = (itens) => {
    firestore.getDoc.mockResolvedValue({
      exists: () => true,
      id: "order-123",
      data: () => ({
        status: "aprovado",
        itens,
        setorDestino: "PSF",
        solicitadoPorNome: "Usuário Teste",
      }),
    });
  };

  it("não deve iniciar baixa quando pré-validação detectar estoque insuficiente", async () => {
    mockApprovedOrder([
      { itemId: "item-1", quantidade: 10, nome: "Produto A", isCustom: false },
    ]);
    itemsService.getItemById.mockResolvedValue({
      id: "item-1",
      nome: "Produto A",
      quantidade: 5,
    });

    await expect(ordersService.finalizeOrder("order-123", "admin-1")).rejects.toThrow(
      "Estoque insuficiente"
    );

    expect(exitsService.addExit).not.toHaveBeenCalled();
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it("deve parar no primeiro erro durante baixa sequencial", async () => {
    mockApprovedOrder([
      { itemId: "item-1", quantidade: 5, nome: "Produto A", isCustom: false },
      { itemId: "item-2", quantidade: 3, nome: "Produto B", isCustom: false },
      { itemId: "item-3", quantidade: 2, nome: "Produto C", isCustom: false },
    ]);

    itemsService.getItemById.mockResolvedValue({ quantidade: 100 });
    exitsService.addExit
      .mockResolvedValueOnce("exit-1")
      .mockRejectedValueOnce(new Error("Falha na baixa do item-2"))
      .mockResolvedValueOnce("exit-3");

    await expect(ordersService.finalizeOrder("order-123", "admin-1")).rejects.toThrow(
      "Falha na baixa do item-2"
    );

    expect(exitsService.addExit).toHaveBeenCalledTimes(2);
    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });

  it("deve finalizar pedido com sucesso após processar todos os itens cadastrados", async () => {
    mockApprovedOrder([
      { itemId: "item-1", quantidade: 5, nome: "Produto A", isCustom: false },
      { quantidade: 2, nome: "Item personalizado", isCustom: true },
      { itemId: "item-2", quantidade: 3, nome: "Produto B", isCustom: false },
    ]);

    itemsService.getItemById.mockResolvedValue({ quantidade: 100 });
    exitsService.addExit.mockResolvedValue("ok");

    await ordersService.finalizeOrder("order-123", "admin-1");

    expect(exitsService.addExit).toHaveBeenCalledTimes(2);
    expect(firestore.updateDoc).toHaveBeenCalledTimes(1);
    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        status: "finalizado",
      })
    );
  });
});

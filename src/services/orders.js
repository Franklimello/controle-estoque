import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";
import { addExit } from "./exits";

const ORDERS_COLLECTION = "orders";

/**
 * Cria um novo pedido
 * @param {Object} orderData - Dados do pedido
 * @param {string} userId - ID do usuário que está criando o pedido
 * @returns {Promise<string>} ID do pedido criado
 */
export const createOrder = async (orderData, userId) => {
  try {
    const orderRef = await addDoc(collection(db, ORDERS_COLLECTION), {
      ...orderData,
      status: "pendente", // pendente, aprovado, rejeitado, finalizado
      solicitadoPor: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return orderRef.id;
  } catch (error) {
    console.error("Erro ao criar pedido:", error);
    throw error;
  }
};

/**
 * Busca todos os pedidos
 * @param {string} status - Filtrar por status (opcional)
 * @returns {Promise<Array>} Lista de pedidos
 */
export const getOrders = async (status = null) => {
  try {
    let q;
    if (status) {
      q = query(
        collection(db, ORDERS_COLLECTION),
        where("status", "==", status),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        collection(db, ORDERS_COLLECTION),
        orderBy("createdAt", "desc")
      );
    }
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar pedidos:", error);
    throw error;
  }
};

/**
 * Busca pedidos de um usuário específico
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>} Lista de pedidos do usuário
 */
export const getUserOrders = async (userId) => {
  try {
    const q = query(
      collection(db, ORDERS_COLLECTION),
      where("solicitadoPor", "==", userId),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar pedidos do usuário:", error);
    throw error;
  }
};

/**
 * Busca pedidos por intervalo de datas
 * @param {string} startDate - Data inicial (YYYY-MM-DD)
 * @param {string} endDate - Data final (YYYY-MM-DD)
 * @param {string} status - Filtrar por status (opcional)
 * @returns {Promise<Array>} Lista de pedidos
 */
export const getOrdersByDateRange = async (startDate, endDate, status = null) => {
  try {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    let q;
    if (status) {
      q = query(
        collection(db, ORDERS_COLLECTION),
        where("status", "==", status),
        where("createdAt", ">=", Timestamp.fromDate(start)),
        where("createdAt", "<=", Timestamp.fromDate(end)),
        orderBy("createdAt", "desc")
      );
    } else {
      q = query(
        collection(db, ORDERS_COLLECTION),
        where("createdAt", ">=", Timestamp.fromDate(start)),
        where("createdAt", "<=", Timestamp.fromDate(end)),
        orderBy("createdAt", "desc")
      );
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Erro ao buscar pedidos por intervalo de datas:", error);
    throw error;
  }
};

/**
 * Busca um pedido pelo ID
 * @param {string} orderId - ID do pedido
 * @returns {Promise<Object|null>} Pedido encontrado ou null
 */
export const getOrderById = async (orderId) => {
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    const orderSnap = await getDoc(orderRef);
    
    if (!orderSnap.exists()) {
      return null;
    }
    
    return {
      id: orderSnap.id,
      ...orderSnap.data(),
    };
  } catch (error) {
    console.error("Erro ao buscar pedido:", error);
    throw error;
  }
};

/**
 * Atualiza o status de um pedido
 * @param {string} orderId - ID do pedido
 * @param {string} status - Novo status (aprovado, rejeitado, finalizado)
 * @param {string} userId - ID do usuário que está atualizando
 * @param {string} observacao - Observação da atualização (opcional)
 * @returns {Promise<void>}
 */
export const updateOrderStatus = async (orderId, status, userId, observacao = "") => {
  try {
    const orderRef = doc(db, ORDERS_COLLECTION, orderId);
    await updateDoc(orderRef, {
      status,
      aprovadoPor: status === "aprovado" || status === "finalizado" ? userId : null,
      rejeitadoPor: status === "rejeitado" ? userId : null,
      observacaoAdmin: observacao,
      updatedAt: serverTimestamp(),
      ...(status === "aprovado" || status === "finalizado" ? { aprovadoEm: serverTimestamp() } : {}),
      ...(status === "rejeitado" ? { rejeitadoEm: serverTimestamp() } : {}),
    });
  } catch (error) {
    console.error("Erro ao atualizar status do pedido:", error);
    throw error;
  }
};

/**
 * Finaliza um pedido (baixa do estoque)
 * Cria saídas automaticamente para cada item selecionado do pedido
 * @param {string} orderId - ID do pedido
 * @param {string} userId - ID do usuário que está finalizando
 * @param {Array} editedItems - Itens editados com quantidades ajustadas (opcional, se não fornecido usa os itens originais)
 * @returns {Promise<void>}
 */
export const finalizeOrder = async (orderId, userId, editedItems = null) => {
  try {
    const order = await getOrderById(orderId);
    
    if (!order) {
      throw new Error("Pedido não encontrado");
    }
    
    if (order.status !== "aprovado") {
      throw new Error("Apenas pedidos aprovados podem ser finalizados");
    }
    
    // Usar itens editados se fornecidos, caso contrário usar itens originais
    const itemsToProcess = editedItems || order.itens;
    
    // Criar saídas para cada item do pedido (apenas itens cadastrados e não customizados)
    const exitPromises = itemsToProcess
      .filter((item) => item.itemId && !item.isCustom) // Apenas itens cadastrados
      .map(async (item) => {
        try {
          await addExit(
            {
              codigo: item.codigo || "",
              itemId: item.itemId,
              quantidade: item.quantidade,
              setorDestino: order.setorDestino || "PSF",
              retiradoPor: order.solicitadoPorNome || "Sistema",
              observacao: `Pedido #${orderId} - ${item.nome || item.nomeProduto || ""}`,
            },
            userId
          );
        } catch (error) {
          console.error(`Erro ao criar saída para item ${item.itemId}:`, error);
          throw error;
        }
      });
    
    await Promise.all(exitPromises);
    
    // Atualizar status do pedido para finalizado
    await updateOrderStatus(orderId, "finalizado", userId, "Pedido baixado do estoque");
    
  } catch (error) {
    console.error("Erro ao finalizar pedido:", error);
    throw error;
  }
};


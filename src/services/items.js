import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  runTransaction,
  serverTimestamp 
} from "firebase/firestore";
import { db } from "./firebase";
import { ESTOQUE_BAIXO_LIMITE } from "../config/constants";

const ITEMS_COLLECTION = "items";

/**
 * Adiciona um novo item ao Firestore
 * @param {Object} itemData - Dados do item
 * @returns {Promise<string>} ID do documento criado
 */
export const addItem = async (itemData) => {
  try {
    const docRef = await addDoc(collection(db, ITEMS_COLLECTION), {
      ...itemData,
      quantidade: itemData.quantidade || 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error("Erro ao adicionar item:", error);
    throw error;
  }
};

/**
 * Busca todos os itens
 * @returns {Promise<Array>} Lista de itens
 */
export const getItems = async () => {
  try {
    const q = query(
      collection(db, ITEMS_COLLECTION),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Erro ao buscar itens:", error);
    throw error;
  }
};

/**
 * Busca um item pelo código de barras
 * @param {string} codigo - Código de barras
 * @returns {Promise<Object|null>} Item encontrado ou null
 */
export const getItemByCodigo = async (codigo) => {
  try {
    // Validar se código não está vazio
    if (!codigo || codigo.trim().length === 0) {
      return null;
    }
    
    const q = query(
      collection(db, ITEMS_COLLECTION),
      where("codigo", "==", codigo)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const doc = querySnapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data()
    };
  } catch (error) {
    console.error("Erro ao buscar item por código:", error);
    throw error;
  }
};

/**
 * Busca um item pelo ID
 * @param {string} itemId - ID do item
 * @returns {Promise<Object|null>} Item encontrado ou null
 */
export const getItemById = async (itemId) => {
  try {
    const docRef = doc(db, ITEMS_COLLECTION, itemId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data()
    };
  } catch (error) {
    console.error("Erro ao buscar item por ID:", error);
    throw error;
  }
};

/**
 * Atualiza um item
 * @param {string} itemId - ID do item
 * @param {Object} itemData - Dados atualizados
 */
export const updateItem = async (itemId, itemData) => {
  try {
    const docRef = doc(db, ITEMS_COLLECTION, itemId);
    await updateDoc(docRef, {
      ...itemData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Erro ao atualizar item:", error);
    throw error;
  }
};

/**
 * Deleta um item
 * @param {string} itemId - ID do item
 */
export const deleteItem = async (itemId) => {
  try {
    const docRef = doc(db, ITEMS_COLLECTION, itemId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Erro ao deletar item:", error);
    throw error;
  }
};

/**
 * Incrementa o estoque de um item usando transaction
 * @param {string} itemId - ID do item
 * @param {number} quantidade - Quantidade a adicionar
 * @returns {Promise<number>} Nova quantidade
 */
export const incrementStock = async (itemId, quantidade) => {
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);
    
    return await runTransaction(db, async (transaction) => {
      const itemDoc = await transaction.get(itemRef);
      
      if (!itemDoc.exists()) {
        throw new Error("Item não encontrado");
      }
      
      const currentQuantity = itemDoc.data().quantidade || 0;
      const newQuantity = currentQuantity + quantidade;
      
      if (newQuantity < 0) {
        throw new Error("Estoque não pode ser negativo");
      }
      
      transaction.update(itemRef, {
        quantidade: newQuantity,
        updatedAt: serverTimestamp()
      });
      
      return newQuantity;
    });
  } catch (error) {
    console.error("Erro ao incrementar estoque:", error);
    throw error;
  }
};

/**
 * Decrementa o estoque de um item usando transaction
 * @param {string} itemId - ID do item
 * @param {number} quantidade - Quantidade a subtrair
 * @returns {Promise<number>} Nova quantidade
 */
export const decrementStock = async (itemId, quantidade) => {
  try {
    const itemRef = doc(db, ITEMS_COLLECTION, itemId);
    
    return await runTransaction(db, async (transaction) => {
      const itemDoc = await transaction.get(itemRef);
      
      if (!itemDoc.exists()) {
        throw new Error("Item não encontrado");
      }
      
      const currentQuantity = itemDoc.data().quantidade || 0;
      const newQuantity = currentQuantity - quantidade;
      
      if (newQuantity < 0) {
        throw new Error("Estoque insuficiente");
      }
      
      transaction.update(itemRef, {
        quantidade: newQuantity,
        updatedAt: serverTimestamp()
      });
      
      return newQuantity;
    });
  } catch (error) {
    console.error("Erro ao decrementar estoque:", error);
    throw error;
  }
};

/**
 * Busca itens com estoque baixo
 * @param {number} limiteMinimo - Limite mínimo de estoque
 * @returns {Promise<Array>} Lista de itens com estoque baixo
 */
export const getItemsLowStock = async (limiteMinimo = ESTOQUE_BAIXO_LIMITE) => {
  try {
    // Buscar itens com quantidade <= limiteMinimo usando query
    const q = query(
      collection(db, ITEMS_COLLECTION),
      where("quantidade", "<=", limiteMinimo),
      orderBy("quantidade", "asc")
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    // Se não houver índice, fallback para busca em memória
    if (error.code === 'failed-precondition') {
      console.warn("Índice não encontrado. Buscando em memória...");
      const items = await getItems();
      return items.filter(item => (item.quantidade || 0) <= limiteMinimo);
    }
    console.error("Erro ao buscar itens com estoque baixo:", error);
    throw error;
  }
};

/**
 * Busca itens próximos do vencimento
 * @param {number} diasAntecedencia - Dias antes do vencimento para alertar
 * @returns {Promise<Array>} Lista de itens próximos do vencimento
 */
export const getItemsExpiring = async (diasAntecedencia = 30) => {
  try {
    const items = await getItems();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiringItems = items.filter(item => {
      if (!item.validade) return false;
      
      let expiryDate;
      if (item.validade.toDate) {
        expiryDate = item.validade.toDate();
      } else if (typeof item.validade === 'string') {
        expiryDate = new Date(item.validade);
      } else {
        return false;
      }
      
      expiryDate.setHours(0, 0, 0, 0);
      const diffTime = expiryDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Itens vencidos ou próximos do vencimento
      return diffDays <= diasAntecedencia && diffDays >= -7; // Inclui até 7 dias após vencimento
    });
    
    // Ordenar por data de validade (mais próximo primeiro)
    return expiringItems.sort((a, b) => {
      const dateA = a.validade?.toDate ? a.validade.toDate() : new Date(a.validade);
      const dateB = b.validade?.toDate ? b.validade.toDate() : new Date(b.validade);
      return dateA - dateB;
    });
  } catch (error) {
    console.error("Erro ao buscar itens próximos do vencimento:", error);
    throw error;
  }
};


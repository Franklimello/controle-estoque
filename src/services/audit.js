import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export const logAudit = async (action, userId, data = {}) => {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action,
      userId: userId || null,
      data,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao registrar auditoria:", error);
  }
};

export default {
  logAudit,
};


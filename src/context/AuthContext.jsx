import { createContext, useContext, useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../services/firebase";
import { getUserRole } from "../services/users";
import { ADMIN_UID } from "../config/constants";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState("user");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        try {
          console.log("🔍 Verificando role do usuário:", user.uid);
          const role = await getUserRole(user.uid);
          console.log("✅ Role obtido:", role);
          setUserRole(role);
          const adminStatus = role === "admin";
          setIsAdmin(adminStatus);
          console.log("👤 Usuário é admin?", adminStatus);
        } catch (error) {
          console.error("❌ Erro ao buscar role do usuário:", error);
          // Se for o admin inicial, garantir que seja admin mesmo com erro
          if (user.uid === ADMIN_UID) {
            console.log("🔧 Forçando role 'admin' para administrador inicial devido a erro");
            setUserRole("admin");
            setIsAdmin(true);
          } else {
            setUserRole("user");
            setIsAdmin(false);
          }
        }
      } else {
        setUserRole("user");
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const value = {
    currentUser,
    isAdmin,
    userRole,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};



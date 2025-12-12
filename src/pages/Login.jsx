import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LogIn } from "lucide-react";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate("/items");
    }
  }, [currentUser, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!email || !password) {
      setError("Por favor, preencha todos os campos");
      setLoading(false);
      return;
    }

    const result = await login(email, password);

    if (result.success) {
      navigate("/items");
    } else {
      setError(
        result.error || "Erro ao fazer login. Verifique suas credenciais."
      );
    }

    setLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-ring">
        <i></i>
        <i></i>
        <i></i>
      </div>
      <div className="login-form-wrapper">
        <div className="flex items-center justify-center mb-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-blue-600 rounded-full shadow-lg">
            <LogIn className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2>Controle de Estoque</h2>
        <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="login-input-box">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
            />
          </div>

          <div className="login-input-box">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              required
            />
          </div>

          <div className="login-input-box">
            <input
              type="submit"
              value={loading ? "Entrando..." : "Entrar"}
              disabled={loading}
            />
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;

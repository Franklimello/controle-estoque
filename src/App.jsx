import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ItemsProvider } from "./context/ItemsContext";
import { ToastProvider } from "./context/ToastContext";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import NewItem from "./pages/NewItem";
import EditItem from "./pages/EditItem";
import Entry from "./pages/Entry";
import Exit from "./pages/Exit";
import EntriesHistory from "./pages/EntriesHistory";
import ExitsHistory from "./pages/ExitsHistory";
import Reports from "./pages/Reports";

// Componente para proteger rotas
const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading-ring">
            <i></i>
            <i></i>
          </div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  return (
    <div className="min-h-screen bg-gray-50" translate="no">
      {!isLoginPage && <Navbar />}
      <div className={isLoginPage ? "" : "flex"}>
        {!isLoginPage && <Sidebar />}
        <div className={isLoginPage ? "" : "flex-1"}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/items"
              element={
                <PrivateRoute>
                  <Items />
                </PrivateRoute>
              }
            />
            <Route
              path="/new-item"
              element={
                <PrivateRoute>
                  <NewItem />
                </PrivateRoute>
              }
            />
            <Route
              path="/edit-item/:id"
              element={
                <PrivateRoute>
                  <EditItem />
                </PrivateRoute>
              }
            />
            <Route
              path="/entry"
              element={
                <PrivateRoute>
                  <Entry />
                </PrivateRoute>
              }
            />
            <Route
              path="/exit"
              element={
                <PrivateRoute>
                  <Exit />
                </PrivateRoute>
              }
            />
            <Route
              path="/entries-history"
              element={
                <PrivateRoute>
                  <EntriesHistory />
                </PrivateRoute>
              }
            />
            <Route
              path="/exits-history"
              element={
                <PrivateRoute>
                  <ExitsHistory />
                </PrivateRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <PrivateRoute>
                  <Reports />
                </PrivateRoute>
              }
            />
            <Route path="/" element={<Navigate to="/items" />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <ToastProvider>
          <Router>
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </Router>
        </ToastProvider>
      </ItemsProvider>
    </AuthProvider>
  );
}

export default App;

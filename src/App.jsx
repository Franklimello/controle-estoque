import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ItemsProvider } from "./context/ItemsContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Items from "./pages/Items";
import NewItem from "./pages/NewItem";
import EditItem from "./pages/EditItem";
import Entry from "./pages/Entry";
import Exit from "./pages/Exit";
import EntriesHistory from "./pages/EntriesHistory";
import ExitsHistory from "./pages/ExitsHistory";

// Componente para proteger rotas
const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return currentUser ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <ItemsProvider>
        <Router>
          <div className="min-h-screen bg-gray-50" translate="no">
            <Navbar />
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
              <Route path="/" element={<Navigate to="/items" />} />
            </Routes>
          </div>
        </Router>
      </ItemsProvider>
    </AuthProvider>
  );
}

export default App;

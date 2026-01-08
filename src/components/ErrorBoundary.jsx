import { Component } from "react";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Erro capturado pelo ErrorBoundary:", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Ocorreu um erro inesperado
            </h1>
            <p className="text-gray-600 mb-6">
              Tente recarregar a página ou retornar ao início.
            </p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Recarregar página
              </button>
              <a
                href="/items"
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              >
                Voltar para Itens
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error Boundary raíz: evita la "pantalla en blanco" ante un error de render no
 * controlado y ofrece una recarga. No captura errores de eventos asíncronos ni
 * de data fetching (eso lo maneja React Query); es la red de seguridad final del
 * árbol de UI.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // En producción esto debería ir a un servicio de monitoreo (Sentry, etc.).
    // No se exponen detalles del error al usuario.
    console.error('Error no controlado en la UI:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-800">
            Ocurrió un error inesperado
          </h1>
          <p className="max-w-md text-sm text-gray-500">
            Lo sentimos, algo salió mal al mostrar esta pantalla. Puedes recargar
            para intentarlo de nuevo.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

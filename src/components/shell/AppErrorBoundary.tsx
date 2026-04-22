import { Component, type ReactNode, type ErrorInfo } from "react";
import { FullPageState } from "./FullPageState";
import { Button } from "@/components/ui/button";
import { RefreshCw, XCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error caught by boundary:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    const isDev = import.meta.env.DEV;

    return (
      <FullPageState
        icon={<XCircle className="h-6 w-6" />}
        iconVariant="error"
        title="Algo sali&#243; mal"
        description="Ocurri&#243; un error inesperado al cargar esta secci&#243;n. El equipo t&#233;cnico fue notificado autom&#225;ticamente."
        actions={
          <>
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Ir al inicio
            </Button>
            <Button onClick={this.reset}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reintentar
            </Button>
          </>
        }
        footer={
          isDev && this.state.error ? (
            <details className="mt-4 w-full max-w-xl text-left">
              <summary className="cursor-pointer rounded bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-500 inline-block">
                Detalles t&eacute;cnicos (solo desarrollo)
              </summary>
              <pre className="mt-2 overflow-auto rounded border border-slate-200 bg-slate-100 p-3 font-mono text-xs text-slate-700">
                {this.state.error.toString()}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            </details>
          ) : undefined
        }
      />
    );
  }
}

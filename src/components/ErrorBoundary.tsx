import React, { Component, ErrorInfo, ReactNode } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";
// Class component hook kullanamaz — i18next.t doğrudan import. Fallback default-value'lar TR.
import i18next from "i18next";

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      const _t = i18next.t.bind(i18next);
      return (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{_t("common.error", { defaultValue: "Hata" })}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              {this.props.fallbackMessage
                || _t("common.unexpectedError", { defaultValue: "Beklenmedik bir sorun oluştu. Lütfen destek ekibimizle iletişime geçin." })}
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-4"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {_t("common.refresh", { defaultValue: "Yenile" })}
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

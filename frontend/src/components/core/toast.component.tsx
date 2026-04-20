"use client";

import type { ReactNode, SyntheticEvent } from "react";
import type { ToastSeverity } from "@/constants/app.constants";

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { TOAST_SEVERITY, TOAST_AUTO_HIDE_MS, API_ERROR_EVENT } from "@/constants/app.constants";

import "./toast.component.css";

type ToastState = {
  open: boolean;
  message: string;
  severity: ToastSeverity;
};

type ToastContextValue = {
  showToast: (message: string, severity?: ToastSeverity) => void;
};

const INITIAL_STATE: ToastState = {
  open: false,
  message: "",
  severity: TOAST_SEVERITY.INFO,
};

const ToastContext = createContext<ToastContextValue | null>(null);

const SEVERITY_CLASS_MAP: Record<ToastSeverity, string> = {
  [TOAST_SEVERITY.ERROR]: "alert alert--error",
  [TOAST_SEVERITY.WARNING]: "alert alert--warning",
  [TOAST_SEVERITY.INFO]: "alert alert--info",
  [TOAST_SEVERITY.SUCCESS]: "alert alert--success",
};

const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toast, setToast] = useState<ToastState>(INITIAL_STATE);

  const showToast = useCallback(
    (message: string, severity: ToastSeverity = TOAST_SEVERITY.INFO) => {
      setToast({ open: true, message, severity });
    },
    [],
  );

  const handleClose = useCallback((_event?: SyntheticEvent | Event, reason?: string) => {
    const isDismissedByClickaway = reason === "clickaway";
    if (isDismissedByClickaway) return;

    setToast((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    const handleApiError = (event: Event) => {
      const { message } = (event as CustomEvent<{ message: string }>).detail;
      showToast(message, TOAST_SEVERITY.ERROR);
    };

    window.addEventListener(API_ERROR_EVENT, handleApiError);

    return () => {
      window.removeEventListener(API_ERROR_EVENT, handleApiError);
    };
  }, [showToast]);

  const contextValue = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="toast">
        <Snackbar
          open={toast.open}
          autoHideDuration={TOAST_AUTO_HIDE_MS}
          onClose={handleClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={handleClose}
            severity={toast.severity}
            variant="filled"
            className={SEVERITY_CLASS_MAP[toast.severity]}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </div>
    </ToastContext.Provider>
  );
};

const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  const isMissing = context === null;
  if (isMissing) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
};

export { ToastProvider, useToast };
export type { ToastContextValue, ToastState };

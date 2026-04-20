"use client";

import type { ReactNode } from "react";
import type { ToastSeverity } from "@/constants/app.constants";

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import {
  TOAST_SEVERITY,
  TOAST_AUTO_HIDE_MS,
  TOAST_MAX_VISIBLE,
  API_ERROR_EVENT,
} from "@/constants/app.constants";

import "./toast.component.css";

type ToastItem = {
  id: number;
  message: string;
  severity: ToastSeverity;
  count: number;
};

type ToastContextValue = {
  showToast: (message: string, severity?: ToastSeverity) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const SEVERITY_CLASS_MAP: Record<ToastSeverity, string> = {
  [TOAST_SEVERITY.ERROR]: "alert alert--error",
  [TOAST_SEVERITY.WARNING]: "alert alert--warning",
  [TOAST_SEVERITY.INFO]: "alert alert--info",
  [TOAST_SEVERITY.SUCCESS]: "alert alert--success",
};

const TOAST_STACK_OFFSET_PX = 60;

const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);

  const showToast = useCallback(
    (message: string, severity: ToastSeverity = TOAST_SEVERITY.INFO) => {
      setToasts((prev) => {
        const existingIndex = prev.findIndex((t) => t.message === message);
        const isDuplicate = existingIndex !== -1;
        if (isDuplicate) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], count: updated[existingIndex].count + 1 };
          return updated;
        }

        const id = nextIdRef.current++;
        const updated = [...prev, { id, message, severity, count: 1 }];
        const overflow = updated.length - TOAST_MAX_VISIBLE;
        if (overflow > 0) {
          return updated.slice(overflow);
        }

        return updated;
      });
    },
    [],
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleClose = useCallback((id: number, _event?: React.SyntheticEvent | Event, reason?: string) => {
    const isDismissedByClickaway = reason === "clickaway";
    if (isDismissedByClickaway) return;

    removeToast(id);
  }, [removeToast]);

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
        {toasts.map((item, index) => {
          const bottomOffset = (toasts.length - 1 - index) * TOAST_STACK_OFFSET_PX;

          return (
            <Snackbar
              key={item.id}
              open
              autoHideDuration={TOAST_AUTO_HIDE_MS}
              onClose={(e, r) => handleClose(item.id, e, r)}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              sx={{ bottom: `${24 + bottomOffset}px !important` }}
            >
              <Alert
                onClose={(e) => handleClose(item.id, e)}
                severity={item.severity}
                variant="filled"
                className={SEVERITY_CLASS_MAP[item.severity]}
              >
                {item.message}
                {item.count > 1 && <span className="count">x{item.count}</span>}
              </Alert>
            </Snackbar>
          );
        })}
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
export type { ToastContextValue, ToastItem };

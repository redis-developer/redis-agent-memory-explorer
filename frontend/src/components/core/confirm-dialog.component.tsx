"use client";

import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import CircularProgress from "@mui/material/CircularProgress";

import "./confirm-dialog.component.css";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
};

const ConfirmDialog = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
}: ConfirmDialogProps) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      className="confirm-dialog"
      PaperProps={{
        className: "confirm-dialog__paper",
      }}
    >
      <DialogTitle className="confirm-dialog__title">{title}</DialogTitle>
      <DialogContent className="confirm-dialog__content">
        <p>{message}</p>
      </DialogContent>
      <DialogActions className="confirm-dialog__actions">
        <Button onClick={onCancel} disabled={isLoading} className="confirm-dialog__cancel-btn">
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isLoading}
          variant="contained"
          className="confirm-dialog__confirm-btn"
          startIcon={isLoading ? <CircularProgress size={16} /> : undefined}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { ConfirmDialog };
export type { ConfirmDialogProps };

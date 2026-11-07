import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import {
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmationDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[calc(100%-2rem)] max-w-md border-[var(--sr-border)] bg-[var(--sr-surface)] p-5 shadow-2xl">
        <AlertDialogHeader className="space-y-2 text-left">
          <AlertDialogTitle className="text-[var(--sr-text)]">{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-6 text-[var(--sr-text-muted)]">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:space-x-0">
          <AlertDialogPrimitive.Cancel asChild>
            <button type="button" className="sr-btn-ghost">
              Cancel
            </button>
          </AlertDialogPrimitive.Cancel>
          <AlertDialogPrimitive.Action asChild>
            <button
              type="button"
              onClick={onConfirm}
              className={destructive ? "sr-btn-danger" : "sr-btn-primary"}
            >
              {confirmLabel}
            </button>
          </AlertDialogPrimitive.Action>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialogPrimitive.Root>
  );
}

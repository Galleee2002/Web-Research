"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast: "app-toast",
          title: "app-toast__title",
          description: "app-toast__description",
          closeButton: "app-toast__close",
        },
      }}
    />
  );
}

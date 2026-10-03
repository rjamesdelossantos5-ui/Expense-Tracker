"use client";

import { ThemeProvider, useTheme } from "next-themes";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppDataProvider } from "@/hooks/use-app-data";
import { TransactionDialogProvider } from "@/hooks/use-transaction-dialog";

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      richColors
      closeButton
      position="top-center"
      theme={(resolvedTheme as "light" | "dark" | undefined) ?? "system"}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <AppDataProvider>
          <TransactionDialogProvider>
            {children}
            <ThemedToaster />
          </TransactionDialogProvider>
        </AppDataProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

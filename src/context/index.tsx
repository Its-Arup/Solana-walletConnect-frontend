
import { projectId } from "../config";
import "../config/modal"; // Initialize modal
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

if (!projectId) {
  throw new Error("Project ID is not defined");
}

function ContextProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

export default ContextProvider;
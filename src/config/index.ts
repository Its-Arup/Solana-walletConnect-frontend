import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";

// Get projectId from https://dashboard.reown.com
export const projectId =
  process.env.NEXT_PUBLIC_PROJECT_ID || "b56e18d47c72ab683b10814fe9495694"; // this is a public projectId only to use on localhost

if (!projectId) {
  throw new Error("Project ID is not defined");
}

// setup Solana Adapter
export const solanaWeb3JsAdapter = new SolanaAdapter({
  wallets: [],
});

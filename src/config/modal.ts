import { projectId, solanaWeb3JsAdapter } from ".";
import { createAppKit } from "@reown/appkit/react";
import { solanaDevnet, type AppKitNetwork } from "@reown/appkit/networks";
// import { DefaultSIWX, SolanaVerifier } from "@reown/appkit-siwx";

// Set up metadata
const metadata = {
  name: "Solana Wallet Connect",
  description: "Connect your Solana wallet",
  url: "http://localhost:5173",
  icons: ["https://avatars.githubusercontent.com/u/179229932"],
};

// Solana devnet only
const allNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [solanaDevnet];

// Create the modal with SIWX enabled
export const modal = createAppKit({
  adapters: [solanaWeb3JsAdapter],
  projectId,
  networks: allNetworks,
  metadata,
  themeMode: "dark",
  features: {
    analytics: true,
    socials: [],
    email: false,
  },
  enableWalletGuide: false,
  // TODO: SIWX is causing runtime errors, needs investigation
  // siwx: new DefaultSIWX({
  //   verifiers: [new SolanaVerifier()],
  // }),
});

import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. Please configure backend/.env (see backend/.env.example).`
    );
  }
  return value;
}

export const env = {
  // Backend server
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "http://localhost:5173",

  // MST Blockchain
  MST_RPC_URL: requireEnv(
    "MST_RPC_URL",
    "https://testnetrpc.mstblockchain.com"
  ),
  MST_CHAIN_ID: parseInt(
    process.env.MST_CHAIN_ID ?? "91562037",
    10
  ),
  MST_EXPLORER_URL:
    process.env.MST_EXPLORER_URL ?? "https://testnet.mstscan.com",

  // ProofToPay contract
  PROOF_TO_PAY_CONTRACT: requireEnv(
    "PROOF_TO_PAY_CONTRACT",
    process.env.MST_CONTRACT_ADDRESS ??
      "0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347"
  ),

  // Optional: backend signer key (only if backend itself needs to sign transactions)
  BACKEND_PRIVATE_KEY: process.env.BACKEND_PRIVATE_KEY ?? "",
} as const;

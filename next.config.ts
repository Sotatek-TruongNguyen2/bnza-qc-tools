import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import type { NextConfig } from 'next'

/**
 * Local DX: if this repo sits next to a bonanzapool checkout, reuse
 * contracts/bnza-exbot/.env (BASE_RPC_URL / BASE_RPC_URLS / ALCHEMY_API_KEY).
 * Does not override vars already set by Vercel or this app’s .env.local.
 */
const siblingExbotEnv = path.resolve(
  __dirname,
  '../bonanzapool/contracts/bnza-exbot/.env',
)
loadEnv({ path: siblingExbotEnv })

const nextConfig: NextConfig = {}

export default nextConfig

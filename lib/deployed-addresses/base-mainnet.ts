import { POSITION_MANAGER_ADDRESS, VAULT_ADDRESS } from '@/lib/bot/constants'
import { BASE_USDC_ADDRESS, BASE_WETH_ADDRESS } from '@/lib/base-known-tokens'
import { NPM_ADDRESS, FACTORY_ADDRESS } from '@/lib/position/constants'
import { QUOTER_ADDRESS } from '@/lib/quote/constants'

export type DeployedAddressEntry = {
  name: string
  address: string
  note?: string
}

export type DeployedAddressGroup = {
  id: string
  title: string
  description?: string
  entries: DeployedAddressEntry[]
}

/** Base mainnet (8453) — mirrors contracts/bnza-exbot/docs/DEPLOYED_ADDRESSES.md (July 2026). */
export function getBaseMainnetDeployedAddressGroups(): DeployedAddressGroup[] {
  return [
    {
      id: 'exbot-proxies',
      title: 'EXBOT — proxies (use for integrations)',
      description: 'Release 2026-07-base-scale-down',
      entries: [
        {
          name: 'ExbotAddressesProvider',
          address: '0x8BF6C353143D6C68Ba4255b3C2c917A1BDa1C7f7',
        },
        {
          name: 'BnzaExVault',
          address: VAULT_ADDRESS,
          note: 'Override via BASE_BNZA_EX_VAULT_ADDRESS',
        },
        {
          name: 'BnzaExPositionManager',
          address: POSITION_MANAGER_ADDRESS,
          note: 'Override via BASE_BNZA_EX_POSITION_MANAGER_ADDRESS',
        },
        {
          name: 'TokenRouter',
          address: '0xc9952bCf4AEEfB7Db1f474EE5EA78085b7F3E467',
        },
        {
          name: 'RedemptionQueue',
          address: '0x7b50B1F6ee14919b6d967EBA4D57d0c67Fa841a0',
        },
      ],
    },
    {
      id: 'exbot-impls',
      title: 'EXBOT — implementations',
      entries: [
        { name: 'BnzaExVault (impl)', address: '0x6FB5731764f984eeAFf5A661bdA83aDe84261052' },
        {
          name: 'BnzaExPositionManager (impl)',
          address: '0x02D40BdED79d7C33c93e4959e5ebe973E1cB7342',
        },
        { name: 'TokenRouter (impl)', address: '0x436c2cF50323713Ad01761b3C9d3Af197594AB08' },
        { name: 'RedemptionQueue (impl)', address: '0x25e98D09AC28CE2763a32F6eDcefc0B588783a13' },
      ],
    },
    {
      id: 'exbot-strategies',
      title: 'EXBOT — strategies',
      description:
        'Prefer ExbotAddressesProvider getters at runtime. Scale-down is not on the Base provider.',
      entries: [
        { name: 'OpenPositionStrategyV1', address: '0x5A175761D74afeF00aB1f44F1681B33eD623233F' },
        { name: 'RedeemStrategyV1', address: '0x1C46D4B32a6FA5D3Bb14Ddd137EDBd71E1C8501b' },
        { name: 'RebalanceStrategyV1', address: '0xaC825f50b854b9A6f56C0278691172e3D2e9D365' },
        { name: 'CollectFeeStrategyV1', address: '0x4C2F87b29f2e157e442Fb735a4C0b257D9303a13' },
        {
          name: 'ScaleDownPositionStrategyV1',
          address: '0x671688cE2928856EDf1D9C10c59CF4f521B9eA99',
          note: 'Not in AddressesProvider on Base — use SCALE_DOWN_STRATEGY_ADDRESS',
        },
      ],
    },
    {
      id: 'exbot-proxy-admins',
      title: 'EXBOT — proxy admins',
      entries: [
        {
          name: 'BnzaExVault ProxyAdmin',
          address: '0xa428dc34b7301ab894321b0006506b3e5e57ed2c',
          note: 'Vault proxy 0x71C6…3005',
        },
        {
          name: 'BnzaExPositionManager ProxyAdmin',
          address: '0xcc6b09b20d06f95f5007556614cb7e67505427df',
          note: 'PM proxy 0x5D1A…6D6A',
        },
        {
          name: 'TokenRouter ProxyAdmin',
          address: '0x0c75f9efa09bbc73b899da5544be132c6523d3fc',
          note: 'Router proxy 0xc995…E467',
        },
        {
          name: 'RedemptionQueue ProxyAdmin',
          address: '0xb8cc37f380c758b39e8badaa233e302d3a3606a0',
          note: 'Queue proxy 0x7b50…41a0',
        },
      ],
    },
    {
      id: 'external',
      title: 'Tokens & Uniswap (Base)',
      entries: [
        { name: 'USDC (Circle)', address: BASE_USDC_ADDRESS },
        { name: 'WETH', address: BASE_WETH_ADDRESS },
        { name: 'BNZA', address: '0x9B15D9357A1E28372997C4Fdaf07E2e4a637bF92' },
        { name: 'Uniswap V3 Factory', address: FACTORY_ADDRESS },
        { name: 'Uniswap V3 NPM', address: NPM_ADDRESS },
        { name: 'Uniswap SwapRouter02', address: '0x2626664c2603336E57B271c5C0b26F421741e481' },
        { name: 'Uniswap V3 QuoterV2', address: QUOTER_ADDRESS, note: 'QC swap quotes' },
        {
          name: 'USDC/WETH pool (0.05%)',
          address: '0xd0b53D9277642d899DF5C87A3966A349A798F224',
        },
        {
          name: 'CCTP TokenMessenger V2',
          address: '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d',
        },
      ],
    },
    {
      id: 'roles',
      title: 'Roles',
      entries: [
        {
          name: 'Deployer / default admin & operator',
          address: '0xCFE217b11Aed9B8018fbe2A19285A5B2A19E2369',
        },
        {
          name: 'Performance fee recipient',
          address: '0xa5B86bFF6B73FBe1f079eE56fA0417E71a1BC969',
        },
      ],
    },
  ]
}

import { parseUnits } from 'ethers';
import { GasTokenPrice } from './types';

export const aListOfGasTokenPrices = (): GasTokenPrice[] => [
  {
    // USDC
    tokenAddress: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
    priceInETH: parseUnits('0.0005', 18),
    priceInUSD: 1.0,
    decimals: 6,
  },
  {
    // USDT
    tokenAddress: '0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8',
    priceInETH: parseUnits('0.0005', 18),
    priceInUSD: 1.0,
    decimals: 6,
  },
];

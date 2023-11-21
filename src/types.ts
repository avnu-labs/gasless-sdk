export interface Compatible {
  isCompatible: boolean;
}

export interface GasTokenPrice {
  // The address of the gas token
  tokenAddress: string;
  // The amount of tokens to get 1 ETH
  price: bigint;
}

export interface ExecuteCallsOptions {
  gasTokenAddress: string;
  maxGasTokenAmount?: bigint;
  estimatedGasFees?: bigint;
  gasTokenPrices?: GasTokenPrice[];
  maxFeesOverhead?: number;
}

export interface GaslessOptions {
  baseUrl?: string;
  abortSignal?: AbortSignal;
  apiPublicKey?: string;
}

export interface RequestError {
  messages: string[];
}

export interface InvokeResponse {
  transactionHash: string;
}

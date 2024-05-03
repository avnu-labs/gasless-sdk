export interface GaslessStatus {
  //The gasless status
  status: boolean;
}

export interface GaslessCompatibility {
  //Indicates if the account is compatible with the gasless service
  isCompatible: boolean;
  //The validation's gas consumed overhead
  gasConsumedOverhead: bigint;
  //The validation's data gas consumed overhead
  dataGasConsumedOverhead: bigint;
}

export interface GasTokenPrice {
  // The gas token's address
  tokenAddress: string;
  // The price of 1 token in ETH
  priceInETH: bigint;
  // The price of 1 token in USD
  priceInUSD: number;
  // The token's number of decimals
  decimals: number;
}

export interface ExecuteCallsOptions {
  gasTokenAddress: string;
  maxGasTokenAmount: bigint;
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

import { parseUnits, toBeHex } from 'ethers';
import { AccountInterface, Call, ec, hash, Signature, TypedData } from 'starknet';
import { BASE_URL, TESTNET_BASE_URL } from './constants';
import { GaslessOptions, Compatible, ExecuteCallsOptions, GasTokenPrice, InvokeResponse, RequestError } from './types';

const baseUrl = (options?: GaslessOptions): string =>
  options?.baseUrl ?? (process.env.NODE_ENV === 'dev' ? TESTNET_BASE_URL : BASE_URL);
const getRequest = (options?: GaslessOptions): RequestInit => ({
  signal: options?.abortSignal,
  headers: { ...(options?.apiPublicKey !== undefined && { 'ask-signature': 'true' }) },
});
const postRequest = (body: unknown, options?: GaslessOptions): RequestInit => ({
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options?.apiPublicKey && { 'ask-signature': 'true' }),
  },
  body: JSON.stringify(body),
});

const parseResponse = <T>(response: Response, apiPublicKey?: string): Promise<T> => {
  if (response.status === 400) {
    return response.json().then((error: RequestError) => {
      throw new Error(error.messages[0]);
    });
  }
  if (response.status > 400) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  if (apiPublicKey) {
    const signature = response.headers.get('signature');
    if (!signature) throw new Error('No server signature');
    return response
      .clone()
      .text()
      .then((textResponse) => {
        const hashResponse = hash.computeHashOnElements([hash.starknetKeccak(textResponse)]);
        const formattedSig = signature.split(',').map((s) => BigInt(s));
        const signatureType = new ec.starkCurve.Signature(formattedSig[0], formattedSig[1]);
        if (!ec.starkCurve.verify(signatureType, hashResponse, apiPublicKey))
          throw new Error('Invalid server signature');
      })
      .then(() => response.json());
  }
  return response.json();
};

/**
 * Calls API to know is the account can use the gasless feature
 * If not, the user may need to upgrade his contract or use a compatible wallet
 * @param accountAddress The account address
 * @param options Optional options
 */
const fetchIsCompatible = (accountAddress: string, options?: GaslessOptions): Promise<boolean> =>
  fetch(`${baseUrl(options)}/gasless/v1/accounts/${accountAddress}/compatible`, getRequest(options))
    .then((response) => parseResponse<Compatible>(response, options?.apiPublicKey))
    .then((compatible) => compatible.isCompatible);

/**
 * Calls API to retrieve gas token prices
 * Each gas token price is the amount of tokens to get 1 ETH
 * @param options Optional options
 */
const fetchGasTokenPrices = (options?: GaslessOptions): Promise<GasTokenPrice[]> =>
  fetch(`${baseUrl(options)}/gasless/v1/gas-token-prices`, getRequest(options))
    .then((response) => parseResponse<GasTokenPrice[]>(response, options?.apiPublicKey))
    .then((gasTokenPrices) =>
      gasTokenPrices.map((gasTokenPrice) => ({
        ...gasTokenPrice,
        price: BigInt(gasTokenPrice.price),
      })),
    );

/**
 * Calls API to retrieve the typed data that the user will have to sign.
 * @param calls Calls that will be executed with the gasless feature
 * @param gasTokenAddress The gas token address that will be used to pay the gas fees
 * @param maxGasTokenAmount The maximum amount of gas token that the user is willing to spend
 * @param options Optional options
 * @returns The best quotes
 */
const fetchBuildTypedData = (
  calls: Call[],
  gasTokenAddress: string,
  maxGasTokenAmount: bigint,
  options?: GaslessOptions,
): Promise<TypedData> =>
  fetch(
    `${baseUrl(options)}/gasless/v1/build-typed-data`,
    postRequest(
      {
        calls,
        gasTokenAddress,
        maxGasTokenAmount: toBeHex(maxGasTokenAmount),
      },
      options,
    ),
  ).then((response) => parseResponse<TypedData>(response, options?.apiPublicKey));

/**
 * Calls API to execute transaction using the gasless feature
 * @param userAddress The user address
 * @param typedData The typed data that the user signed
 * @param signature The typed data's signature
 * @param options Optional options.
 * @returns The best quotes
 */
const fetchExecuteTransaction = (
  userAddress: string,
  typedData: string,
  signature: Signature,
  options?: GaslessOptions,
): Promise<InvokeResponse> => {
  if (Array.isArray(signature)) {
    signature = signature.map((sig) => toBeHex(BigInt(sig)));
  } else if (signature.r && signature.s) {
    signature = [toBeHex(BigInt(signature.r)), toBeHex(BigInt(signature.s))];
  }
  return fetch(
    `${baseUrl(options)}/gasless/v1/execute`,
    postRequest(
      {
        userAddress,
        typedData,
        signature,
      },
      options,
    ),
  ).then((response) => parseResponse<InvokeResponse>(response, options?.apiPublicKey));
};

/**
 * Execute list of calls using the gasless feature
 * You can directly provide the maxGasTokenAmount or let us compute it for you by providing estimatedGasFees, gasTokenPrices and maxFeesOverhead
 * @param account The user's account
 * @param calls Calls that will be executed
 * @param gasTokenAddress The gas token address that will be used to pay the gas fees
 * @param maxGasTokenAmount The maximum amount of gas token that the user is willing to spend
 * @param estimatedGasFees The estimated gas fees amount in ETH
 * @param gasTokenPrices The list of token prices. This list can be retrieved using `fetchGasTokenPrices`
 * @param maxFeesOverhead The overhead of the gas fees. When estimating a tx to 0.0001 ETH, the user will approve to spend 0.0002 ETH max when overhead is 1 (100%) and 0.0004 when overhead is 4 (400%).
 * @param options Optional options.
 * @returns Promise<InvokeSwapResponse>
 */
const executeCalls = async (
  account: AccountInterface,
  calls: Call[],
  { gasTokenAddress, maxGasTokenAmount, estimatedGasFees, gasTokenPrices, maxFeesOverhead = 3 }: ExecuteCallsOptions,
  options?: GaslessOptions,
): Promise<InvokeResponse> => {
  if (estimatedGasFees && gasTokenPrices && gasTokenAddress) {
    maxGasTokenAmount = computeMaxGasTokenAmount(gasTokenAddress, estimatedGasFees, gasTokenPrices, maxFeesOverhead);
  }
  if (maxGasTokenAmount === undefined) {
    throw Error(`Provide maxGasTokenAmount or estimatedGasFees, gasTokenPrices and gasTokenAddress`);
  }
  const typedData = await fetchBuildTypedData(calls, gasTokenAddress, maxGasTokenAmount, options);
  const signature = await account.signMessage(typedData);
  return fetchExecuteTransaction(account.address, JSON.stringify(typedData), signature, options).then((value) => ({
    transactionHash: value.transactionHash,
  }));
};

/**
 * Calculate the maximum gas token amount
 * @param gasTokenAddress The gas token address that will be used to pay the gas fees
 * @param estimatedGasFees The estimated gas fees amount in ETH
 * @param gasTokenPrices The list of token prices. This list can be retrieved using `fetchGasTokenPrices`
 * @param maxFeesOverhead The overhead of the gas fees. When estimating a tx to 0.0001 ETH, the user will approve to spend 0.0002 ETH max when overhead is 1 (100%) and 0.0004 when overhead is 4 (400%).
 * @returns bigint
 */
const computeMaxGasTokenAmount = (
  gasTokenAddress: string,
  estimatedGasFees: bigint,
  gasTokenPrices: GasTokenPrice[],
  maxFeesOverhead: number,
): bigint => {
  const price = gasTokenPrices.filter((gasTokenPrice) => gasTokenPrice.tokenAddress === gasTokenAddress)[0].price;
  return (estimatedGasFees * price * BigInt(maxFeesOverhead)) / parseUnits('1', 18);
};

export {
  computeMaxGasTokenAmount,
  executeCalls,
  fetchBuildTypedData,
  fetchExecuteTransaction,
  fetchGasTokenPrices,
  fetchIsCompatible,
};

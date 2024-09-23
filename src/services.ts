import { toBeHex } from 'ethers';
import qs from 'qs';
import { AccountInterface, Call, CallData, ec, hash, RawArgs, Signature, TypedData } from 'starknet';
import { BASE_URL } from './constants';
import {
  AccountsRewardsOptions,
  ContractError,
  DeploymentData,
  ExecuteCallsOptions,
  GaslessCompatibility,
  GaslessOptions,
  GaslessStatus,
  GasTokenPrice,
  InvokeResponse,
  PaymasterReward,
  RequestError,
} from './types';

const baseUrl = (options?: GaslessOptions): string => options?.baseUrl ?? BASE_URL;
const getRequest = (options?: GaslessOptions): RequestInit => ({
  signal: options?.abortSignal,
  headers: {
    ...(options?.apiPublicKey !== undefined && { 'ask-signature': 'true' }),
    ...(options?.apiKey && { 'api-key': options.apiKey }),
  },
});
const postRequest = (body: unknown, options?: GaslessOptions): RequestInit => ({
  method: 'POST',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options?.apiKey && { 'api-key': options.apiKey }),
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
  if (response.status === 500) {
    return response.json().then((error: RequestError) => {
      if (error.messages.length >= 0 && error.messages[0].includes('Contract error')) {
        throw new ContractError(error.messages[0], error.revertError || '');
      } else {
        throw new Error(error.messages[0]);
      }
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
 * Calls API to know if gasless service is up
 * @param options Optional options
 */
const fetchGaslessStatus = (options?: GaslessOptions): Promise<GaslessStatus> =>
  fetch(`${baseUrl(options)}/paymaster/v1/status`, getRequest(options)).then((response) =>
    parseResponse<GaslessStatus>(response, options?.apiPublicKey),
  );

/**
 * Calls API to know if the account can use the gasless feature
 * If not, the user may need to upgrade his contract or use a compatible wallet
 * @param accountAddress The account address
 * @param options Optional options
 */
const fetchAccountCompatibility = (accountAddress: string, options?: GaslessOptions): Promise<GaslessCompatibility> =>
  fetch(`${baseUrl(options)}/paymaster/v1/accounts/${accountAddress}/compatible`, getRequest(options))
    .then((response) => parseResponse<GaslessCompatibility>(response, options?.apiPublicKey))
    .then((response) => ({
      ...response,
      gasConsumedOverhead: BigInt(response.gasConsumedOverhead),
      dataGasConsumedOverhead: BigInt(response.dataGasConsumedOverhead),
    }));

/**
 * Fetches the list of user's paymaster rewards.
 * Rewards are registered by a sponsor. This sponsor will pay account's gas fees.
 * @param accountAddress The account address
 * @param options Optional options
 */
const fetchAccountsRewards = (
  accountAddress: string,
  options?: AccountsRewardsOptions & GaslessOptions,
): Promise<PaymasterReward[]> => {
  const queryParams = qs.stringify(
    {
      ...(options?.sponsor && { sponsor: options.sponsor }),
      ...(options?.campaign && { campaign: options.campaign }),
      ...(options?.protocol && { protocol: options.protocol }),
    },
    { arrayFormat: 'repeat' },
  );
  return fetch(
    `${baseUrl(options)}/paymaster/v1/accounts/${accountAddress}/rewards?${queryParams}`,
    getRequest(options),
  ).then((response) => parseResponse<PaymasterReward[]>(response, options?.apiPublicKey));
};

/**
 * Calls API to retrieve gas token prices
 * @param options Optional options
 */
const fetchGasTokenPrices = (options?: GaslessOptions): Promise<GasTokenPrice[]> =>
  fetch(`${baseUrl(options)}/paymaster/v1/gas-token-prices`, getRequest(options))
    .then((response) => parseResponse<GasTokenPrice[]>(response, options?.apiPublicKey))
    .then((prices) =>
      prices.map((price) => ({
        ...price,
        priceInETH: BigInt(price.priceInETH),
      })),
    );

/**
 * Calls API to retrieve the typed data that the user will have to sign.
 * @param userAddress The user's address
 * @param calls The list of calls that will be executed
 * @param gasTokenAddress The gas token address that will be used to pay the gas fees. If null, there is two options:
 * 1. the user must have a reward compatible with the calls. In this case, the reward's sponsor will pay the gas fees in ETH.
 * 2. the api-key header must be field. The api-key's owner will be charged for the consumed gas fees in ETH
 * @param maxGasTokenAmount The maximum amount of gas token that the user is willing to spend. If null, there is two options:
 * 1. the user must have a reward compatible with the calls. In this case, the reward's sponsor will pay the gas fees in ETH.
 * 2. the api-key header must be field. The api-key's owner will be charged for the consumed gas fees in ETH
 * @param accountClassHash Only set this field when the account is not deployed.
 * When the accountClassHash is defined, the API will not check the gasless compatibility by calling
 * the supportsInterface entrypoint but will instead look into an internal map.
 * If the classHash is not supported by the API, please contact us so we can quickly add support.
 * @param options Optional options
 * @returns The best quotes
 */
const fetchBuildTypedData = (
  userAddress: string,
  calls: Call[],
  gasTokenAddress: string | undefined,
  maxGasTokenAmount: bigint | undefined,
  options?: GaslessOptions,
  accountClassHash?: string | undefined,
): Promise<TypedData> =>
  fetch(
    `${baseUrl(options)}/paymaster/v1/build-typed-data`,
    postRequest(
      {
        userAddress,
        calls: formatCall(calls),
        gasTokenAddress,
        accountClassHash,
        ...(maxGasTokenAmount !== undefined && { maxGasTokenAmount: toBeHex(maxGasTokenAmount) }),
      },
      options,
    ),
  ).then((response) => parseResponse<TypedData>(response, options?.apiPublicKey));

const formatCall = (calls: Call[]): Call[] =>
  calls.map((call) => ({
    contractAddress: call.contractAddress,
    entrypoint: call.entrypoint,
    calldata: (Array.isArray(call.calldata) && '__compiled__' in call.calldata
      ? call.calldata // Calldata type
      : CallData.compile(call.calldata as RawArgs)
    ) // RawArgsObject | RawArgsArray type
      .map((calldata) => toBeHex(calldata)),
  }));

/**
 * Calls API to execute transaction using the gasless feature
 * @param userAddress The user address
 * @param typedData The typed data that the user signed
 * @param signature The typed data's signature
 * @param deploymentData When this field is set, the paymaster will deploy the user's account
 * before executing the typed data. To retrieve the deployment data, you can read
 * https://community.starknet.io/t/snip-deployment-interface-between-dapps-and-wallets/101923.
 * For now, the paymaster only allows the deployment of account for sponsored transactions.
 * @param options Optional options.
 * @returns The best quotes
 */
const fetchExecuteTransaction = (
  userAddress: string,
  typedData: string,
  signature: Signature,
  options?: GaslessOptions,
  deploymentData?: DeploymentData | undefined,
): Promise<InvokeResponse> => {
  if (Array.isArray(signature)) {
    signature = signature.map((sig) => toBeHex(BigInt(sig)));
  } else if (signature.r && signature.s) {
    signature = [toBeHex(BigInt(signature.r)), toBeHex(BigInt(signature.s))];
  }
  return fetch(
    `${baseUrl(options)}/paymaster/v1/execute`,
    postRequest(
      {
        userAddress,
        typedData,
        signature,
        ...(deploymentData && {
          deploymentData: {
            ...deploymentData,
            sigdata: deploymentData.sigdata?.map((sig) => toBeHex(BigInt(sig))),
          },
        }),
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
 * @param gasTokenAddress The gas token address that will be used to pay the gas fees. If null, there is two options:
 * 1. the user must have a reward compatible with the calls. In this case, the reward's sponsor will pay the gas fees in ETH.
 * 2. the api-key header must be field. The api-key's owner will be charged for the consumed gas fees in ETH
 * @param maxGasTokenAmount The maximum amount of gas token that the user is willing to spend. If null, there is two options:
 * 1. the user must have a reward compatible with the calls. In this case, the reward's sponsor will pay the gas fees in ETH.
 * 2. the api-key header must be field. The api-key's owner will be charged for the consumed gas fees in ETH
 * @param estimatedGasFees The estimated gas fees amount in ETH
 * @param options Optional options.
 * @returns Promise<InvokeSwapResponse>
 */
const executeCalls = async (
  account: AccountInterface,
  calls: Call[],
  { gasTokenAddress, maxGasTokenAmount, deploymentData }: ExecuteCallsOptions,
  options?: GaslessOptions,
): Promise<InvokeResponse> => {
  const accountClassHash = deploymentData ? deploymentData.class_hash : undefined;
  const typedData = await fetchBuildTypedData(
    account.address,
    calls,
    gasTokenAddress,
    maxGasTokenAmount,
    options,
    accountClassHash,
  );
  const signature = await account.signMessage(typedData);
  return fetchExecuteTransaction(account.address, JSON.stringify(typedData), signature, options, deploymentData).then(
    (value) => ({
      transactionHash: value.transactionHash,
    }),
  );
};

const shouldAddValidationOverhead = (
  gasCost: bigint | undefined,
  dataGasCost: bigint | undefined,
  gasConsumedOverhead: bigint,
  dataGasConsumedOverhead: bigint,
): boolean => {
  if (gasCost === undefined || dataGasCost === undefined) return false;
  return !(gasConsumedOverhead === BigInt(0) && dataGasConsumedOverhead === BigInt(0));
};

const addValidationGasOverhead = (
  estimatedGasFees: bigint,
  gasCost: bigint | undefined,
  dataGasCost: bigint | undefined,
  gasConsumedOverhead: bigint,
  dataGasConsumedOverhead: bigint,
): bigint => {
  if (shouldAddValidationOverhead(gasCost, dataGasCost, gasConsumedOverhead, dataGasConsumedOverhead)) {
    return estimatedGasFees + gasCost! * gasConsumedOverhead + dataGasCost! * dataGasConsumedOverhead;
  }
  return estimatedGasFees;
};

/**
 * Calculate the gas fees in gas token
 * @param estimatedGasFeesInETH The estimated amount gas fees (overall_fee)
 * @param gasTokenPrice The selected gasTokenPrice
 * @param gasCost The current gas_price
 * @param dataGasCost The current data_gas_price
 * @param gasConsumedOverhead The gaslessCompatibility's gasConsumedOverhead (see fetchAccountCompatibility)
 * @param dataGasConsumedOverhead The gaslessCompatibility's dataGasConsumedOverhead (see fetchAccountCompatibility)
 * @returns bigint
 */
const getGasFeesInGasToken = (
  estimatedGasFeesInETH: bigint,
  gasTokenPrice: GasTokenPrice,
  gasCost: bigint | undefined,
  dataGasCost: bigint | undefined,
  gasConsumedOverhead: bigint,
  dataGasConsumedOverhead: bigint,
): bigint => {
  const gasFeesInETH: bigint = addValidationGasOverhead(
    estimatedGasFeesInETH,
    gasCost,
    dataGasCost,
    gasConsumedOverhead,
    dataGasConsumedOverhead,
  );
  const gasFeesInGasToken = Number(gasFeesInETH) / Number(gasTokenPrice.priceInETH);
  return BigInt(~~(gasFeesInGasToken * 10 ** gasTokenPrice.decimals));
};

export {
  executeCalls,
  fetchAccountCompatibility,
  fetchAccountsRewards,
  fetchBuildTypedData,
  fetchExecuteTransaction,
  fetchGaslessStatus,
  fetchGasTokenPrices,
  formatCall,
  getGasFeesInGasToken,
};

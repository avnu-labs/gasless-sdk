import { useAccount, useNetwork, useProvider } from '@starknet-react/core';
import { FC, useCallback, useEffect, useState } from 'react';
import Connect from './Connect';
import { AccountInterface, Call, EstimateFeeResponse, stark, transaction } from 'starknet';
import {
  executeCalls,
  fetchAccountCompatibility,
  fetchGasTokenPrices,
  GaslessCompatibility,
  GaslessOptions,
  GasTokenPrice,
  getGasFeesInGasToken,
  SEPOLIA_BASE_URL,
} from '@avnu/gasless-sdk';
import { formatUnits } from 'ethers';

const options: GaslessOptions = { baseUrl: SEPOLIA_BASE_URL };
const initialValue: Call[] = [
  {
    entrypoint: 'approve',
    contractAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    calldata: ['0x0498E484Da80A8895c77DcaD5362aE483758050F22a92aF29A385459b0365BFE', '0xf', '0x0'],
  },
];
const isValidJSON = (str: string): boolean => {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
};

const Form: FC = () => {
  const { account, isConnected } = useAccount();
  const { address } = useAccount();
  const { chain } = useNetwork();
  const { provider } = useProvider();
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState<string>();
  const [calls, setCalls] = useState(JSON.stringify(initialValue, null, 2));
  const [gasTokenPrices, setGasTokenPrices] = useState<GasTokenPrice[]>([]);
  const [gasTokenPrice, setGasTokenPrice] = useState<GasTokenPrice>();
  const [maxGasTokenAmount, setMaxGasTokenAmount] = useState<bigint>();
  const [gaslessCompatibility, setGaslessCompatibility] = useState<GaslessCompatibility>();
  const [errorMessage, setErrorMessage] = useState<string>();

  useEffect(() => {
    if (!account) return;
    fetchAccountCompatibility(account.address).then(setGaslessCompatibility);
  }, [account]);

  // The account.estimateInvokeFee doesn't work...
  const estimateCalls = useCallback(
    async (account: AccountInterface, calls: Call[]): Promise<EstimateFeeResponse> => {
      const contractVersion = await provider.getContractVersion(account.address);
      const nonce = await provider.getNonceForAddress(account.address);
      const details = stark.v3Details({ skipValidate: true });
      const invocation = {
        ...details,
        contractAddress: account.address,
        calldata: transaction.getExecuteCalldata(calls, contractVersion.cairo),
        signature: [],
      };
      return provider.getInvokeEstimateFee({ ...invocation }, { ...details, nonce }, 'pending', true);
    },
    [provider],
  );

  // Retrieve estimated gas fees
  useEffect(() => {
    if (!account || !gasTokenPrice || !gaslessCompatibility) return;
    setErrorMessage(undefined);
    if (!isValidJSON(calls)) {
      setErrorMessage('Invalid calls');
      return;
    }
    const parsedCalls: Call[] = JSON.parse(calls);
    estimateCalls(account, parsedCalls).then((fees) => {
      const estimatedGasFeesInGasToken = getGasFeesInGasToken(
        BigInt(fees.overall_fee),
        gasTokenPrice,
        BigInt(fees.gas_price!),
        BigInt(fees.data_gas_price ?? '0x1'),
        gaslessCompatibility.gasConsumedOverhead,
        gaslessCompatibility.dataGasConsumedOverhead,
      );
      setMaxGasTokenAmount(estimatedGasFeesInGasToken * BigInt(2));
    });
  }, [calls, account, gasTokenPrice, gaslessCompatibility, estimateCalls]);

  const onClickExecute = async () => {
    if (!account || !gasTokenPrice) return;
    setLoading(true);
    setTx(undefined);
    return executeCalls(
      account,
      JSON.parse(calls),
      {
        gasTokenAddress: gasTokenPrice.tokenAddress,
        maxGasTokenAmount,
      },
      options,
    )
      .then((response) => {
        setTx(response.transactionHash);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchGasTokenPrices(options).then(setGasTokenPrices);
  }, []);

  if (!isConnected) {
    return <Connect />;
  }

  if (chain !== undefined && chain.name !== 'Starknet Sepolia Testnet') {
    return <p>Please connect with a sepolia account</p>;
  }

  return (
    <div>
      <p>Connected with account: {address}</p>
      <p>Execute tx:</p>
      <textarea
        value={calls}
        onChange={(e) => setCalls(e.target.value)}
        style={{ minHeight: '500px', minWidth: '1000px' }}
      />
      <div>
        <p>Gas tokens</p>
        {gasTokenPrices.map((price) => (
          <button disabled={price.tokenAddress === gasTokenPrice?.tokenAddress} onClick={() => setGasTokenPrice(price)}>
            {price.tokenAddress}
          </button>
        ))}
      </div>
      {tx && (
        <a href={`https://sepolia.voyager.online/tx/${tx}`} target={'_blank'} rel='noreferrer'>
          Success:{tx}
        </a>
      )}
      {errorMessage && <p style={{ color: 'red' }}>{errorMessage}</p>}
      {!gasTokenPrice && <p>Select a gas token</p>}
      {maxGasTokenAmount !== undefined && gasTokenPrice !== undefined && (
        <p>Max gas fees in gas token: {formatUnits(maxGasTokenAmount, gasTokenPrice.decimals)}</p>
      )}
      <div>
        {account && (
          <button disabled={!isValidJSON(calls) || loading || !gasTokenPrice} onClick={onClickExecute}>
            {loading ? 'Loading' : 'Execute'}
          </button>
        )}
      </div>
    </div>
  );
};

export default Form;

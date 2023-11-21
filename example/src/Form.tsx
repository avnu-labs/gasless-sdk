import { useAccount } from '@starknet-react/core'
import { FC, useEffect, useState } from "react";
import Connect from "./Connect";
import { Call } from "starknet";
import { AvnuOptions, executeCalls, fetchGasTokenPrices, GasTokenPrice, TESTNET_BASE_URL } from "@avnu/gasless-sdk";
import { parseUnits } from "ethers";

const options: AvnuOptions = { baseUrl: TESTNET_BASE_URL }
const initialValue: Call[] = [
  {
    entrypoint: 'transfer',
    contractAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
    calldata: [ '0x0498E484Da80A8895c77DcaD5362aE483758050F22a92aF29A385459b0365BFE', '0xf', '0x0' ],
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
  const { address } = useAccount()
  const [ loading, setLoading ] = useState(false);
  const [ tx, setTx ] = useState<string>();
  const [ calls, setCalls ] = useState(JSON.stringify(initialValue, null, 2));
  const [ gasTokenPrices, setGasTokenPrices ] = useState<GasTokenPrice[]>([])
  const [ gasTokenAddress, setGasTokenAddress ] = useState<string>()

  const onClickExecute = async () => {
    if (!account || !gasTokenAddress) return;
    setLoading(true);
    setTx(undefined);

    // TODO: estimate fees
    // const fees = await account.estimateInvokeFee(JSON.parse(calls), {blockIdentifier: 'latest', skipValidate: true})
    // const estimatedGasFees = fees.overall_fee
    const estimatedGasFees = parseUnits('0.0001', 18)

    return executeCalls(account, JSON.parse(calls), {
      gasTokenAddress,
      gasTokenPrices,
      estimatedGasFees
    }, options).then((response) => {
      setTx(response.transactionHash);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });
  }

  useEffect(() => {
    fetchGasTokenPrices(options).then(setGasTokenPrices)
  }, []);

  if (!isConnected) {
    return <Connect/>
  }

  return (
    <div>
      <p>Connected with account: {address}</p>
      <p>Execute tx:</p>
      <textarea value={calls} onChange={(e) => setCalls(e.target.value)}
                style={{ minHeight: '500px', minWidth: '1000px' }}
      />
      <div>

        <p>Gas tokens</p>
        {gasTokenPrices.map((gasTokenPrice) => (
          <button disabled={gasTokenPrice.tokenAddress === gasTokenAddress}
                  onClick={() => setGasTokenAddress(gasTokenPrice.tokenAddress)}>
            {gasTokenPrice.tokenAddress}
          </button>
        ))}
      </div>
      {tx && (
        <a href={`https://goerli.voyager.online/tx/${tx}`} target={"_blank"} rel="noreferrer">
          Success:{tx}
        </a>
      )}
      {!gasTokenAddress && <p>Select a gas token</p>}
      <div>
        {account && (
          <button
            disabled={!isValidJSON(calls) || loading || !gasTokenAddress}
            onClick={onClickExecute}
          >
            {loading ? 'Loading' : 'Execute'}
          </button>
        )}
      </div>
    </div>
  )
}

export default Form;

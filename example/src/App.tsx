import { FC, useEffect, useState } from 'react';
import { connect } from 'get-starknet'; // v4 only
import { Account, PaymasterRpc, RpcProvider, TokenData, WalletAccount } from "starknet"; // v7.4.0+

const paymasterRpc = new PaymasterRpc({ nodeUrl: 'https://sepolia.paymaster.avnu.fi' });
const starknetRpc = new RpcProvider({ nodeUrl: 'https://starknet-sepolia.public.blastapi.io' });

const App: FC = () => {
  const [account, setAccount] = useState<Account>();
  const [loading, setLoading] = useState(false);
  const [tx, setTx] = useState<string>();
  const [gasToken, setGasToken] = useState<TokenData>();
  const [gasTokens, setGasTokens] = useState<TokenData[]>([]);

  const handleConnect = async () => {
    const starknet = await connect({ modalMode: 'alwaysAsk' });
    if (!starknet) return;
    await starknet.enable();
    const account = await WalletAccount.connect(starknetRpc, starknet,  undefined, paymasterRpc);
    setAccount(account);
  };

  useEffect(() => {
    paymasterRpc.getSupportedTokens().then((tokens) => {
      setGasTokens(tokens);
    });
  }, []);

  if (!account) {
    return <button onClick={handleConnect}>Connect Wallet</button>;
  }

  const onClickExecute = () => {
    if (!gasToken) return;
    const calls = [
      {
        entrypoint: 'approve',
        contractAddress: '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7',
        calldata: ['0x0498E484Da80A8895c77DcaD5362aE483758050F22a92aF29A385459b0365BFE', '0xf', '0x0'],
      },
    ];
    setLoading(true);
    console.log(account);
    account
      .executePaymasterTransaction(calls, { feeMode: { mode: 'default', gasToken: gasToken.token_address } })
      .then((res) => {
        setTx(res.transaction_hash);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  };

  return (
    <div>
      <div>
        <p>
          <strong>Gas tokens</strong>
        </p>
        {gasTokens.map((token) => (
          <button disabled={token.token_address === gasToken?.token_address} onClick={() => setGasToken(token)}>
            {token.token_address}
          </button>
        ))}
      </div>
      {tx && (
        <a href={`https://sepolia.voyager.online/tx/${tx}`} target={'_blank'} rel='noreferrer'>
          Success:{tx}
        </a>
      )}
      {!gasToken && <p>Select a gas token</p>}
      <div>
        {account && (
          <button disabled={loading || !gasToken} onClick={onClickExecute}>
            {loading ? 'Loading' : 'Execute'}
          </button>
        )}
      </div>
    </div>
  );
};

export default App;

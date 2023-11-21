import React, { FC } from 'react';
import { useConnect } from "@starknet-react/core";

const Connect: FC = () => {
  const { connect, connectors } = useConnect();
  return (
    <div>
      <p>Select a wallet</p>
      <ul>
        {connectors.map((connector) => (
          <li key={connector.id}>
            <button onClick={() => connect({ connector })}>
              {connector.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Connect;

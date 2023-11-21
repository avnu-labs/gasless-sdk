import { goerli, mainnet } from "@starknet-react/chains";
import { argent, publicProvider, StarknetConfig, } from "@starknet-react/core";
import { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

const StarknetProvider: FC<Props> = ({ children }) => {
  // Braavos does not support Gasless transaction yet
  return (
    <StarknetConfig
      chains={[ mainnet, goerli ]}
      provider={publicProvider()}
      connectors={[ argent() ]}
    >
      {children}
    </StarknetConfig>
  );
}

export default StarknetProvider;

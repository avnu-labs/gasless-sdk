import { sepolia } from '@starknet-react/chains';
import { InjectedConnector, publicProvider, StarknetConfig } from '@starknet-react/core';
import { FC, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

const connectors = [
  new InjectedConnector({ options: { id: 'argentX' } }),
  new InjectedConnector({ options: { id: 'braavos' } }),
];

const StarknetProvider: FC<Props> = ({ children }) => (
  <StarknetConfig chains={[sepolia]} provider={publicProvider()} connectors={connectors}>
    {children}
  </StarknetConfig>
);

export default StarknetProvider;

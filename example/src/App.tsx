import React, { FC } from 'react';
import Form from "./Form";
import StarknetProvider from "./StarknetProvider";

const App: FC = () => (
  <StarknetProvider>
    <Form/>
  </StarknetProvider>
);

export default App;

import { parseUnits } from 'ethers';
import { aListOfGasTokenPrices } from './fixtures';
import { computeMaxGasTokenAmount, getGasFeesInGasToken } from './services';
import { GasTokenPrice } from './types';

describe('Gasless services', () => {
  describe('computeMaxGasTokenAmount', () => {
    it('should return max gas token amount', () => {
      // Given
      const gasTokenAddress = '0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8';
      const estimatedGasFees = parseUnits('0.0001', 18);
      const gasTokenPrices = aListOfGasTokenPrices();
      const maxFeesOverhead = 3;

      // When
      const result = computeMaxGasTokenAmount(gasTokenAddress, estimatedGasFees, gasTokenPrices, maxFeesOverhead);

      // Then
      expect(result).toBe(BigInt(600000));
    });
  });

  describe('getGasFeesInGasToken', () => {
    const gasTokenPrice: GasTokenPrice = {
      tokenAddress: '0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
      priceInETH: parseUnits('0.0005', 18),
      priceInUSD: 1.0,
      decimals: 6,
    };

    [
      {
        reason: 'no validation overhead',
        estimatedGasFeesInETH: parseUnits('0.0005', 18),
        gasCost: BigInt(23000000000),
        dataGasCost: BigInt(0x1),
        gasConsumedOverhead: BigInt(0x0),
        dataGasConsumedOverhead: BigInt(0x0),
        expected: parseUnits('1', 6),
      },
      {
        reason: 'no validation overhead',
        estimatedGasFeesInETH: parseUnits('0.0001', 18),
        gasCost: BigInt(23000000000),
        dataGasCost: BigInt(0x1),
        gasConsumedOverhead: BigInt(0x0),
        dataGasConsumedOverhead: BigInt(0x0),
        expected: parseUnits('0.2', 6),
      },
      {
        reason: 'no validation overhead',
        estimatedGasFeesInETH: parseUnits('0.00001', 18),
        gasCost: BigInt(23000000000),
        dataGasCost: BigInt(0x1),
        gasConsumedOverhead: BigInt(0x0),
        dataGasConsumedOverhead: BigInt(0x0),
        expected: parseUnits('0.02', 6),
      },
      {
        reason: 'no validation overhead',
        estimatedGasFeesInETH: parseUnits('1', 18),
        gasCost: BigInt(23000000000),
        dataGasCost: BigInt(0x1),
        gasConsumedOverhead: BigInt(0x0),
        dataGasConsumedOverhead: BigInt(0x0),
        expected: parseUnits('2000', 6),
      },
      {
        reason: 'validation overhead not 0x0',
        estimatedGasFeesInETH: parseUnits('0.0005', 18),
        gasCost: BigInt(23000000000),
        dataGasCost: BigInt(0x1),
        gasConsumedOverhead: BigInt(1000),
        dataGasConsumedOverhead: BigInt(0x0),
        expected: parseUnits('1.046', 6),
      },
    ].forEach(
      ({
        estimatedGasFeesInETH,
        expected,
        reason,
        gasCost,
        dataGasCost,
        gasConsumedOverhead,
        dataGasConsumedOverhead,
      }) =>
        it(`should return ${expected} when estimatedGasFeesInETH is ${estimatedGasFeesInETH} and ${reason}`, () => {
          // When
          const result = getGasFeesInGasToken(
            estimatedGasFeesInETH,
            gasTokenPrice,
            gasCost,
            dataGasCost,
            gasConsumedOverhead,
            dataGasConsumedOverhead,
          );

          // Then
          expect(result).toStrictEqual(expected);
        }),
    );
  });
});

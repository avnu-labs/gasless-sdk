import { parseUnits } from 'ethers';
import { cairo, Call } from 'starknet';
import { formatCall, getGasFeesInGasToken } from './services';
import { GasTokenPrice } from './types';

describe('Gasless services', () => {
  describe('formatCall', () => {
    it('should format call', () => {
      // Given
      const calls: Call[] = [
        {
          entrypoint: 'entrypoing',
          contractAddress: '0x1887f83f4e26d37a240f36322fc3c9ace5b55e854f3a3090330e0e4b45f757a',
          calldata: [
            '2',
            cairo.tuple('1', 4),
            cairo.tuple('0xaedcba9876543210fedcba9876543210fedcba9876543210fedcba98765432', 5),
          ],
        },
      ];

      // When
      const result = formatCall(calls);

      // Then
      const expected = [
        {
          calldata: [
            '0x02',
            '0x01',
            '0x04',
            '0xaedcba9876543210fedcba9876543210fedcba9876543210fedcba98765432',
            '0x05',
          ],
          contractAddress: '0x1887f83f4e26d37a240f36322fc3c9ace5b55e854f3a3090330e0e4b45f757a',
          entrypoint: 'entrypoing',
        },
      ];
      expect(result).toStrictEqual(expected);
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
      {
        reason: 'validation overhead not 0x0',
        estimatedGasFeesInETH: BigInt(353689424262),
        gasCost: BigInt(16540204002),
        dataGasCost: BigInt(205341397),
        gasConsumedOverhead: BigInt(0),
        dataGasConsumedOverhead: BigInt(0),
        expected: BigInt(1330),
        selectedGasTokenPrice: {
          decimals: 6,
          priceInETH: BigInt(265901307596508),
          priceInUSD: 1.0014640948007292,
          tokenAddress: '0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8',
        },
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
        selectedGasTokenPrice,
      }) =>
        it(`should return ${expected} when estimatedGasFeesInETH is ${estimatedGasFeesInETH} and ${reason}`, () => {
          // When
          const result = getGasFeesInGasToken(
            estimatedGasFeesInETH,
            selectedGasTokenPrice ?? gasTokenPrice,
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

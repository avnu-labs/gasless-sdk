import { parseUnits } from 'ethers';
import { aListOfGasTokenPrices } from './fixtures';
import { computeMaxGasTokenAmount } from './services';

describe('Avnu services', () => {
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
});

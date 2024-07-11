import { applyTryTacticToBlock } from '../../src/fallback.js';
describe('fallback', () => {
  describe('applyTryTactic', () => {
    describe('flip-block', () => {
      it('flips raw values', () => {
        const result = applyTryTacticToBlock({ bottom: '12px' }, 'flip-block');
        expect(result).toMatchObject({ top: '12px', bottom: 'revert' });
      });
      it('flips anchors', () => {
        const result = applyTryTacticToBlock(
          { bottom: 'anchor(top)', top: 'anchor(--a top)' },
          'flip-block',
        );
        expect(result).toMatchObject({
          top: 'anchor(bottom)',
          bottom: 'anchor(--a bottom)',
        });
      });
    });
  });
});

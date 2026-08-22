import { adjustmentKeys } from './adjustments';
import { bundledLooks, cloneLookAdjustments } from './looks';

describe('bundled Looks', () => {
  it('ships seven distinct, descriptive starting points', () => {
    expect(bundledLooks).toHaveLength(7);
    expect(new Set(bundledLooks.map((look) => look.title)).size).toBe(7);
    expect(bundledLooks.every((look) => look.description.length > 20)).toBe(true);
  });

  it('keeps bundled values inside the shared adjustment model', () => {
    for (const look of bundledLooks) {
      expect(Object.keys(look.adjustments).sort()).toEqual([...adjustmentKeys, 'toneCurve'].sort());
      expect(cloneLookAdjustments(look.adjustments)).toEqual(look.adjustments);
    }
  });
});

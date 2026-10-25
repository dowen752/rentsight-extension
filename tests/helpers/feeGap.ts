import { it } from 'vitest';

// Expected failures keep the regular regression suite useful while unsupported
// behavior stays executable. Strict mode is a readiness gate: every desired
// assertion must pass normally. Never infer gap status from observed output.
export const feeGap =
  process.env.RENTSIGHT_REQUIRE_FEE_SUPPORT === '1' ? it : it.fails;

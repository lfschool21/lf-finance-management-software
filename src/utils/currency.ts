/**
 * Format number in Indian Rupee format with proper lakhs/crores grouping.
 * Examples: ₹1,23,456 | ₹12,34,567 | ₹1,00,00,000
 */
export function formatINR(amount: number, showPaise = false): string {
  const isNegative = amount < 0;
  const abs = Math.abs(amount);

  if (showPaise && abs % 1 !== 0) {
    const parts = abs.toFixed(2).split('.');
    const intPart = formatIndianInt(parts[0]);
    return `${isNegative ? '-' : ''}₹${intPart}.${parts[1]}`;
  }

  const rounded = Math.round(abs);
  return `${isNegative ? '-' : ''}₹${formatIndianInt(rounded.toString())}`;
}

function formatIndianInt(numStr: string): string {
  const len = numStr.length;
  if (len <= 3) return numStr;

  let result = numStr.slice(-3);
  let remaining = numStr.slice(0, -3);

  while (remaining.length > 0) {
    const chunk = remaining.slice(-2);
    result = chunk + ',' + result;
    remaining = remaining.slice(0, -2);
  }

  return result;
}

/**
 * Abbreviated format for large numbers: ₹12.5L, ₹1.75L, ₹1.2Cr
 */
export function formatINRAbbr(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 1_00_00_000) {
    const cr = abs / 1_00_00_000;
    return `${sign}₹${formatCompactDecimal(cr)}Cr`;
  }
  if (abs >= 1_00_000) {
    const l = abs / 1_00_000;
    return `${sign}₹${formatCompactDecimal(l)}L`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}₹${formatCompactDecimal(k)}K`;
  }
  return formatINR(amount);
}

function formatCompactDecimal(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Parse a string that might contain ₹, commas etc. into a number.
 */
export function parseINR(value: string): number {
  const cleaned = value.replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

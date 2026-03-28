/**
 * Indian phone number helpers.
 * Storage format: +91XXXXXXXXXX (13 chars)
 */

export function normalizePhone(input: string): string | null {
  // Strip all non-digits
  const digits = input.replace(/\D/g, "");

  // Accept 10-digit (no country code) or 12-digit (+91 prefix)
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits[2])) {
    return `+${digits}`;
  }

  return null;
}

export function formatPhoneDisplay(phone: string): string {
  // +91XXXXXXXXXX → +91 XXXXX XXXXX
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

export function isValidIndianPhone(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

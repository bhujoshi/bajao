import { parsePhoneNumberFromString } from "libphonenumber-js/max";
export function validEmail(value: string): boolean {
  const email = value.trim();
  if (email.length > 254 || /\s/.test(email)) return false;
  const parts = email.split("@");
  return parts.length === 2 && parts[0].length > 0 && parts[0].length <= 64 && !parts[0].startsWith(".") && !parts[0].endsWith(".") && !parts[0].includes("..") && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(parts[0]) && /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(parts[1]);
}
export function validPhone(value: string): boolean {
  if (!/^\+[\d\s().-]+$/.test(value.trim())) return false;
  return Boolean(parsePhoneNumberFromString(value)?.isValid());
}
export function validateIdentifier(value: string, channel: string): string {
  if (typeof value !== "string") throw new Error("Enter an email address or phone number.");
  if (channel === "email") {
    if (!validEmail(value)) throw new Error("Enter a valid email address, for example name@example.com.");
    return value.trim().toLowerCase();
  }
  if (channel !== "phone" || !validPhone(value)) throw new Error("Select your country code and enter a valid phone number for that country.");
  return parsePhoneNumberFromString(value)!.number;
}

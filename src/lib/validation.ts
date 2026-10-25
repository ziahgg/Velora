import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email, e.g. name@domain.com');
const name = z.string().trim().min(2, 'Enter your full name').max(80, 'Name is too long');
/** E.164-ish: optional +, digits and spaces, 7–15 digits. */
const phone = z
  .string()
  .trim()
  .refine((v) => /^\+?[\d\s()-]+$/.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15, 'Enter a valid phone number');
const password = z
  .string()
  .min(8, 'At least 8 characters with a number')
  .max(72, 'Password is too long')
  .refine((v) => /\d/.test(v), 'At least 8 characters with a number');

export const signInSchema = z.object({ email, password: z.string().min(1, 'Enter your password') });
export const signUpSchema = z.object({
  fullName: name,
  email,
  password,
  acceptTerms: z.literal(true, { error: 'Please accept the Terms and Privacy Policy' }),
});
export const forgotSchema = z.object({ email });
export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Passwords don’t match', path: ['confirm'] });

export const guestSchema = z.object({
  guestName: name,
  guestPhone: phone,
  specialRequests: z.string().trim().max(300, 'Keep requests under 300 characters'),
});

export const billingSchema = z.object({ cardholder: name, receiptEmail: email });

export const profileSchema = z.object({ fullName: name, phone: z.union([z.literal(''), phone]) });

/** First message per field, for inline errors. */
export function fieldErrors<T extends z.ZodType>(schema: T, value: unknown): Partial<Record<string, string>> {
  const r = schema.safeParse(value);
  if (r.success) return {};
  const out: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

import { z } from 'zod';

/**
 * Business categories AirExpay will not onboard because they are commonly
 * prohibited by NOWPayments merchant terms. Counsel still has to confirm the
 * current provider list. This is not a compliance or licensing statement.
 */
export const PROHIBITED_BUSINESS_CATEGORIES = [
  'drugs',
  'weapons',
  'adult_content',
  'gambling',
  'counterfeit_goods',
  'unlicensed_money_service',
  'pyramid_scheme',
  'crypto_mixing',
  'stolen_goods',
  'fraud',
] as const;

export const ALLOWED_BUSINESS_CATEGORIES = [
  'retail',
  'software',
  'professional_services',
  'education',
  'hospitality',
  'digital_goods',
  'nonprofit',
  'marketplace',
] as const;

export type BusinessCategory = (typeof ALLOWED_BUSINESS_CATEGORIES)[number];

export const ENTITY_TYPES = [
  'sole_proprietor',
  'llc',
  'corporation',
  'partnership',
  'nonprofit',
] as const;

const country = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, 'Use a two-letter country code')
  .transform((value) => value.toUpperCase());

const personName = z.string().trim().min(1).max(80);
const dob = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const signupSchema = z
  .object({
    email: z.string().trim().email().max(200),
    password: z.string().min(8).max(72),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    email: z.string().trim().email().max(200),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Enter the 6-digit code'),
  })
  .strict();

export const businessProfileSchema = z
  .object({
    legal_name: z.string().trim().min(2).max(200),
    country,
    entity_type: z.enum(ENTITY_TYPES),
    website: z.string().trim().url().max(2000),
    category: z.string().trim().min(1).max(80),
    expected_monthly_volume: z
      .string()
      .regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/, 'Volume must be a USD amount'),
  })
  .strict()
  .superRefine((value, context) => {
    if ((PROHIBITED_BUSINESS_CATEGORIES as readonly string[]).includes(value.category)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'This business category cannot be onboarded',
      });
    } else if (!(ALLOWED_BUSINESS_CATEGORIES as readonly string[]).includes(value.category)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Choose a supported business category',
      });
    }
  });

export const representativeSchema = z
  .object({
    given_name: personName,
    family_name: personName,
    date_of_birth: dob,
    nationality: country,
  })
  .strict()
  .superRefine((value, context) => {
    if (!isAdult(value.date_of_birth)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['date_of_birth'],
        message: 'The representative must be 18 or older',
      });
    }
  });

export const ownerSchema = representativeSchema.and(
  z
    .object({
      ownership_percent: z.number().min(25).max(100),
    })
    .strict(),
);

export const ownersStepSchema = z
  .object({
    representative: representativeSchema,
    owners: z.array(ownerSchema).max(10),
    no_ubo: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    const total = value.owners.reduce((sum, owner) => sum + owner.ownership_percent, 0);
    if (total > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['owners'],
        message: 'Ownership cannot add up to more than 100%',
      });
    }
    if (!value.no_ubo && value.owners.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['owners'],
        message: 'List every person who owns 25% or more, or confirm that nobody does',
      });
    }
  });

export const consentsSchema = z
  .object({
    terms: z.literal(true),
    privacy: z.literal(true),
    accuracy: z.literal(true),
  })
  .strict();

export const simulateOnboardingSchema = z
  .object({
    outcome: z.enum(['approved', 'rejected', 'needs_more_info', 'under_review']),
    item: z.string().trim().min(1).max(80).optional(),
    reason: z.string().trim().min(1).max(500).optional(),
  })
  .strict();

export function isAdult(isoDate: string, now = new Date()): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const born = new Date(Date.UTC(year, month - 1, day));
  if (
    born.getUTCFullYear() !== year ||
    born.getUTCMonth() !== month - 1 ||
    born.getUTCDate() !== day
  ) {
    return false;
  }
  const adult = new Date(Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()));
  return born.getTime() <= adult.getTime();
}

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export type DocumentMime = 'image/jpeg' | 'image/png' | 'application/pdf';

/** Identify JPG, PNG, or PDF from magic bytes. The declared type is ignored. */
export function documentMimeFromBytes(bytes: Uint8Array): DocumentMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }
  return null;
}

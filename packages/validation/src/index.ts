import { z } from 'zod';

const decimal = z.string().regex(/^(0|[1-9]\d*)(\.\d{1,8})?$/, 'Amount must be a decimal string');
const currency = z
  .string()
  .regex(/^[A-Za-z0-9]{2,10}$/)
  .transform((value) => value.toUpperCase());

export const createInvoiceSchema = z
  .object({
    price_amount: decimal,
    price_currency: currency,
    pay_currency: currency.optional(),
    order_id: z.string().trim().min(1).max(128),
    description: z.string().trim().max(500).optional(),
    success_url: z.string().url().max(2000).optional(),
    cancel_url: z.string().url().max(2000).optional(),
  })
  .strict();

export type CreateInvoiceBody = z.infer<typeof createInvoiceSchema>;

export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[\x21-\x7e]+$/, 'Idempotency-Key must be printable ASCII');

export const nowPaymentsIpnSchema = z
  .object({
    payment_id: z.union([z.string().min(1), z.number()]),
    payment_status: z.string().min(1),
    order_id: z.string().optional(),
    pay_address: z.string().optional(),
    pay_amount: z.union([z.string(), z.number()]).optional(),
    actually_paid: z.union([z.string(), z.number()]).optional(),
    pay_currency: z.string().optional(),
    price_amount: z.union([z.string(), z.number()]).optional(),
    price_currency: z.string().optional(),
    invoice_id: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough();

export type NowPaymentsIpn = z.infer<typeof nowPaymentsIpnSchema>;

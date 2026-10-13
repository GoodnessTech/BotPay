/*
# Create BotPay payment request records

1. New Tables
- `payment_requests`
- `id` (uuid, primary key)
- `requester_agent` (text, agent identifier)
- `provider_agent` (text, service provider identifier)
- `service_category` (text, API, compute, or data)
- `service_description` (text, requested work)
- `amount` (numeric, quoted payment amount)
- `token` (text, payment token)
- `deadline` (timestamptz, delivery expiry)
- `verification_requirements` (text, agreed verification conditions)
- `delivery_reference` (text, optional delivery endpoint or reference)
- `payment_conditions` (text, agreement conditions)
- `status` (text, initial lifecycle status)
- `created_at` (timestamptz, creation time)
2. Security
- Enable row level security on `payment_requests`.
- Allow anonymous and authenticated clients to create and view records in this single-tenant prototype because no sign-in screen is present.
3. Important notes
- Records are coordination requests only; this does not authorize a wallet or move funds.
- Lifecycle and settlement fields remain intentionally out of scope until a verified BOT Chain integration exists.
*/

CREATE TABLE IF NOT EXISTS payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_agent text NOT NULL,
  provider_agent text NOT NULL,
  service_category text NOT NULL,
  service_description text NOT NULL,
  amount numeric(20, 8) NOT NULL CHECK (amount > 0),
  token text NOT NULL DEFAULT 'BOT',
  deadline timestamptz NOT NULL,
  verification_requirements text NOT NULL,
  delivery_reference text,
  payment_conditions text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_authorization',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view BotPay requests" ON payment_requests;
CREATE POLICY "Public can view BotPay requests"
ON payment_requests FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Public can create BotPay requests" ON payment_requests;
CREATE POLICY "Public can create BotPay requests"
ON payment_requests FOR INSERT
TO anon, authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update BotPay requests" ON payment_requests;
CREATE POLICY "Public can update BotPay requests"
ON payment_requests FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Public can delete BotPay requests" ON payment_requests;
CREATE POLICY "Public can delete BotPay requests"
ON payment_requests FOR DELETE
TO anon, authenticated
USING (true);

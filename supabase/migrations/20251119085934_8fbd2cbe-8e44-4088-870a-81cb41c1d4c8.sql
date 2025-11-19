-- Add payment instructions field to agencies table
ALTER TABLE public.agencies 
ADD COLUMN payment_instructions JSONB DEFAULT '{
  "tr": {
    "bank_name": "",
    "account_holder": "",
    "iban": "",
    "additional_info": ""
  },
  "en": {
    "bank_name": "",
    "account_holder": "",
    "iban": "",
    "additional_info": ""
  }
}'::jsonb;

COMMENT ON COLUMN public.agencies.payment_instructions IS 'Multi-language payment instructions for customers. Includes bank details and additional payment info.';
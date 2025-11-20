-- Rename agency_name to name for simpler API
ALTER TABLE public.agencies RENAME COLUMN agency_name TO name;

-- Upsert demo agency with payment instructions
INSERT INTO public.agencies (id, name, city, payment_instructions)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'Demo Travel Agency',
  'İzmir',
  '{
    "payment_methods": [
      "bank_transfer",
      "cash_office",
      "cash_on_tour",
      "credit_card"
    ],
    "payment_type": "deposit",
    "deposit_percentage": 30,
    "tr": {
      "bank_name": "Garanti BBVA",
      "iban": "TR00 0000 0000 0000 0000 0000 00",
      "account_holder": "Demo Turizm Seyahat Acentesi",
      "additional_info": "Lütfen açıklama kısmına ad-soyad ve tur ismini yazınız."
    },
    "en": {
      "bank_name": "Garanti BBVA",
      "iban": "TR00 0000 0000 0000 0000 0000 00",
      "account_holder": "Demo Travel Agency",
      "additional_info": "Please write your full name and tour name in the description."
    },
    "office_address": "Atatürk Cad. No:10/2 - İzmir",
    "working_hours": "Hafta içi 09:00 - 18:00",
    "phone_number": "+90 555 555 55 55"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  city = EXCLUDED.city,
  payment_instructions = EXCLUDED.payment_instructions;
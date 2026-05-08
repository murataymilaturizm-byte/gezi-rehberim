-- FIX 1: Update plan_features to match final product values
-- Starter:      1 language, 10 tours,  1,000 messages/month
-- Professional: 4 language, 50 tours,  5,000 messages/month
-- Enterprise:   7 language, unlimited, unlimited messages

UPDATE public.plan_features
SET max_languages = 1, max_tours = 10, message_limit = 1000
WHERE plan_type = 'starter';

UPDATE public.plan_features
SET max_languages = 4, max_tours = 50, message_limit = 5000
WHERE plan_type = 'professional';

UPDATE public.plan_features
SET max_languages = 7, max_tours = -1, message_limit = -1
WHERE plan_type = 'enterprise';

-- Sync agencies.message_limit with updated plan_features values
UPDATE public.agencies
SET message_limit = 1000
WHERE plan_type = 'starter';

UPDATE public.agencies
SET message_limit = 5000
WHERE plan_type = 'professional';

UPDATE public.agencies
SET message_limit = -1
WHERE plan_type = 'enterprise';

-- Fix starter agencies that accidentally have more than 1 enabled language
-- (keep only the first element, default to 'tr' if empty)
UPDATE public.agencies
SET enabled_languages = ARRAY[
  COALESCE(
    (SELECT elem FROM unnest(enabled_languages) WITH ORDINALITY AS t(elem, ord)
     WHERE ord = 1 LIMIT 1),
    'tr'
  )
]
WHERE plan_type = 'starter'
  AND array_length(enabled_languages, 1) > 1;

-- FIX 10: Verification query for Aymila Turizm
-- Run manually to verify:
-- SELECT id, name, plan_type, subscription_status, monthly_message_count, message_limit,
--        array_length(enabled_languages,1) AS lang_count, enabled_languages
-- FROM public.agencies
-- WHERE name ILIKE '%aymila%';

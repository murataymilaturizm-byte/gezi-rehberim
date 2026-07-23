-- İş1c: TELEFON NORMALİZASYONU + PROFİL BİRLEŞTİRME (2026-07-23)
-- KANONİK format: E.164 rakam, +'sız, ülke-kodlu ("905419990011").
-- registrations.phone'a DOKUNULMAZ (görüntü formatı orada kalır; eşleşme normalize-karşılaştırma ile).
-- Demo/junk profiller (session_..., harf içeren) DOKUNULMAZ.

-- 1) YARDIMCI FONKSİYONLAR (JS _shared/phone.ts ile aynı mantık) --------------
create or replace function normalize_phone(p text) returns text language sql immutable as $$
  select case
    when p is null then null
    when replace(lower(p),'whatsapp:','') ~ '[a-z]' then p            -- telefon değil → dokunma
    else (
      select case
        when x = '' then p
        when length(x) not between 10 and 15 then p                    -- telefon değil → dokunma
        when left(x,2) = '00' then substr(x,3)                         -- uluslararası erişim öneki
        when left(x,1) = '0'  then '90' || substr(x,2)                 -- TR trunk 0 → 90
        when length(x) = 10 and left(x,1) = '5' then '90' || x         -- TR mobil öneksiz
        else x
      end
      from (select regexp_replace(replace(lower(p),'whatsapp:',''),'[^0-9]','','g') as x) d
    )
  end;
$$;

create or replace function is_real_phone(p text) returns boolean language sql immutable as $$
  select p is not null
     and replace(lower(p),'whatsapp:','') !~ '[a-z]'
     and length(regexp_replace(replace(lower(p),'whatsapp:',''),'[^0-9]','','g')) between 10 and 15;
$$;

-- 2) KONUŞMA/GERİBİLDİRİM/LOG TABLOLARINI KANONİKLEŞTİR (registrations HARİÇ) ---
update whatsapp_conversations           set phone = normalize_phone(phone)          where is_real_phone(phone) and phone is distinct from normalize_phone(phone);
update whatsapp_conversation_summaries  set phone = normalize_phone(phone)          where is_real_phone(phone) and phone is distinct from normalize_phone(phone);
update tour_feedback                    set customer_phone = normalize_phone(customer_phone) where is_real_phone(customer_phone) and customer_phone is distinct from normalize_phone(customer_phone);
update template_send_log                set recipient_phone = normalize_phone(recipient_phone) where is_real_phone(recipient_phone) and recipient_phone is distinct from normalize_phone(recipient_phone);
update complaints                       set phone = normalize_phone(phone)          where is_real_phone(phone) and phone is distinct from normalize_phone(phone);
update data_deletion_requests           set phone = normalize_phone(phone)          where is_real_phone(phone) and phone is distinct from normalize_phone(phone);

-- 3) PROFİL BİRLEŞTİRME (fuller-field-wins, sayaçlar toplanır) -----------------
create temp table _grp on commit drop as
select id, agency_id, phone, normalize_phone(phone) as canon,
  row_number() over (partition by agency_id, normalize_phone(phone)
                     order by coalesce(total_messages,0) desc, created_at asc) as rn,
  count(*)     over (partition by agency_id, normalize_phone(phone)) as cnt
from whatsapp_user_profiles
where is_real_phone(phone);

-- 3a) Grup alanlarını survivor'a (rn=1) topla
with tags_agg as (
  select w.agency_id, normalize_phone(w.phone) canon, array_agg(distinct t) tags_union
  from whatsapp_user_profiles w join _grp g on g.id = w.id
  cross join lateral unnest(coalesce(w.tags, '{}'::text[])) t
  where g.cnt > 1 group by 1,2
),
dest_agg as (
  select w.agency_id, normalize_phone(w.phone) canon, array_agg(distinct d) dest_union
  from whatsapp_user_profiles w join _grp g on g.id = w.id
  cross join lateral unnest(coalesce(w.preferred_destinations, '{}'::text[])) d
  where g.cnt > 1 group by 1,2
),
agg as (
  select w.agency_id, normalize_phone(w.phone) canon,
    sum(coalesce(w.total_messages,0))  tot_msg,
    sum(coalesce(w.total_bookings,0))  tot_book,
    sum(coalesce(w.total_spent,0))     tot_spent,
    max(w.last_interaction_at)         last_int,
    min(w.first_interaction_at)        first_int,
    max(w.last_feedback_sent_at)       last_fb,
    max(w.last_follow_up_sent_at)      last_fu,
    (array_agg(w.full_name           order by coalesce(w.total_messages,0) desc) filter (where nullif(w.full_name,'') is not null))[1]           full_name,
    (array_agg(w.email               order by coalesce(w.total_messages,0) desc) filter (where nullif(w.email,'') is not null))[1]               email,
    (array_agg(w.notes               order by coalesce(w.total_messages,0) desc) filter (where nullif(w.notes,'') is not null))[1]               notes,
    (array_agg(w.language_preference order by coalesce(w.total_messages,0) desc) filter (where nullif(w.language_preference,'') is not null))[1] lang,
    (array_agg(w.feedback_comment    order by coalesce(w.total_messages,0) desc) filter (where nullif(w.feedback_comment,'') is not null))[1]    fb_comment,
    (array_agg(w.feedback_score      order by coalesce(w.total_messages,0) desc) filter (where w.feedback_score is not null))[1]                 fb_score,
    (array_agg(w.source              order by coalesce(w.total_messages,0) desc) filter (where nullif(w.source,'') is not null))[1]              source,
    (array_agg(w.preferences order by coalesce(w.total_messages,0) desc) filter (where w.preferences is not null and w.preferences <> '{}'::jsonb))[1] prefs
  from whatsapp_user_profiles w
  join _grp g on g.id = w.id
  where g.cnt > 1
  group by w.agency_id, normalize_phone(w.phone)
)
update whatsapp_user_profiles s set
  total_messages       = a.tot_msg,
  total_bookings       = a.tot_book,
  total_spent          = a.tot_spent,
  last_interaction_at  = a.last_int,
  first_interaction_at = a.first_int,
  last_feedback_sent_at= a.last_fb,
  last_follow_up_sent_at = a.last_fu,
  full_name            = coalesce(nullif(s.full_name,''), a.full_name),
  email                = coalesce(nullif(s.email,''), a.email),
  notes                = coalesce(nullif(s.notes,''), a.notes),
  language_preference  = coalesce(nullif(s.language_preference,''), a.lang),
  feedback_comment     = coalesce(nullif(s.feedback_comment,''), a.fb_comment),
  feedback_score       = coalesce(s.feedback_score, a.fb_score),
  source               = coalesce(nullif(s.source,''), a.source),
  tags                 = coalesce(ta.tags_union, s.tags),
  preferred_destinations = coalesce(da.dest_union, s.preferred_destinations),
  preferences          = coalesce(a.prefs, s.preferences)
from agg a
  left join tags_agg ta on ta.agency_id = a.agency_id and ta.canon = a.canon
  left join dest_agg da on da.agency_id = a.agency_id and da.canon = a.canon,
  _grp g
where s.id = g.id and g.rn = 1 and g.cnt > 1
  and g.agency_id = a.agency_id and g.canon = a.canon;

-- 3b) survivor-olmayan çift profilleri sil (id'ye FK yok — güvenli)
delete from whatsapp_user_profiles w using _grp g where w.id = g.id and g.rn > 1;

-- 3c) survivor + tekil gerçek-telefon profillerini kanonik phone'a çek
update whatsapp_user_profiles s set phone = g.canon
from _grp g where s.id = g.id and g.rn = 1 and s.phone is distinct from g.canon;

update whatsapp_user_profiles s set phone = normalize_phone(s.phone)
where is_real_phone(s.phone) and s.phone is distinct from normalize_phone(s.phone)
  and not exists (select 1 from whatsapp_user_profiles w2
                  where w2.id <> s.id and w2.phone = normalize_phone(s.phone));

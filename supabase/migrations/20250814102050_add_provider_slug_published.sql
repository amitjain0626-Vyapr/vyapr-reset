alter table providers
  add column if not exists slug text unique,
  add column if not exists published boolean default false;

-- Optional: make phone non-unique if legacy test data conflicts (comment out if you want it unique)
-- alter table providers drop constraint if exists providers_phone_key;
-- create unique index if not exists providers_slug_key on providers(slug);

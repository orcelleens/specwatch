-- Seed vendor registry. Spec URLs are the vendors' published OpenAPI documents
-- (all public, stable locations). Changelog adapters: rss / html / none.
-- Adding a vendor later = one row here (or via the request-a-vendor flow).

insert into public.vendors
  (slug, name, homepage, spec_url, spec_format, changelog, poll_interval_minutes, poll_offset_minutes, next_poll_at)
values
  ('stripe', 'Stripe', 'https://stripe.com',
   'https://raw.githubusercontent.com/stripe/openapi/master/latest/openapi.spec3.yaml',
   'openapi3', '{"type":"html","url":"https://docs.stripe.com/changelog"}'::jsonb,
   60, 0, now()),

  ('github', 'GitHub', 'https://github.com',
   'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
   'openapi3', '{"type":"rss","url":"https://github.blog/changelog/feed/"}'::jsonb,
   60, 7, now() + interval '7 minutes'),

  ('openai', 'OpenAI', 'https://openai.com',
   'https://raw.githubusercontent.com/openai/openai-openapi/master/openapi.yaml',
   'openapi3', '{"type":"none"}'::jsonb,
   120, 14, now() + interval '14 minutes'),

  ('twilio', 'Twilio', 'https://twilio.com',
   'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json',
   'openapi3', '{"type":"none"}'::jsonb,
   120, 21, now() + interval '21 minutes'),

  ('slack', 'Slack', 'https://slack.com',
   'https://raw.githubusercontent.com/slackapi/slack-api-specs/master/web-api/slack_web_openapi_v2.json',
   'swagger2', '{"type":"html","url":"https://api.slack.com/changelog"}'::jsonb,
   120, 28, now() + interval '28 minutes'),

  ('supabase', 'Supabase', 'https://supabase.com',
   'https://api.supabase.com/api/v1-json',
   'openapi3', '{"type":"none"}'::jsonb,
   120, 35, now() + interval '35 minutes'),

  ('cloudflare', 'Cloudflare', 'https://cloudflare.com',
   'https://raw.githubusercontent.com/cloudflare/api-schemas/main/openapi.json',
   'openapi3', '{"type":"none"}'::jsonb,
   120, 42, now() + interval '42 minutes'),

  ('square', 'Square', 'https://squareup.com',
   'https://raw.githubusercontent.com/square/connect-api-specification/master/api.json',
   'openapi3', '{"type":"none"}'::jsonb,
   120, 49, now() + interval '49 minutes'),

  ('plaid', 'Plaid', 'https://plaid.com',
   'https://raw.githubusercontent.com/plaid/plaid-openapi/master/2020-09-14.yml',
   'openapi3', '{"type":"none"}'::jsonb,
   120, 56, now() + interval '56 minutes')

on conflict (slug) do nothing;

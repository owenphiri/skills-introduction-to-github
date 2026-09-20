-- Demo micro-task campaigns (gigs/profiles are created by real signups).
insert into public.micro_tasks (title, kind, reward_zmw, minutes, slots_total, campaign_sponsor) values
  ('5-min survey: mobile money habits',                    'survey',       15, 5,  120, 'FinTech Insights ZM'),
  ('Test a new banking app and report 3 issues',           'app_test',     60, 20, 25,  'Zed Digital Bank'),
  ('Label 50 photos of Zambian road signs',                'data_label',   40, 25, 80,  'RoadAI Africa'),
  ('Share a local business promo to your WhatsApp status', 'social',       10, 2,  300, 'Lusaka SME Hub'),
  ('Mystery-shop a supermarket till and rate service',     'mystery_shop', 70, 30, 10,  'RetailPulse'),
  ('10-min survey: transport costs in your area',          'survey',       25, 10, 60,  null);

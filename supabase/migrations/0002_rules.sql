-- The clocks and stage lists the checks use, with their sources. docs/compliance.md has the
-- quoted wording and what was and was not verified. Change a rule with a new migration.

insert into rules (code, jurisdiction, description, days, day_kind, source) values
 ('LODGE', 'QLD', 'Private certifier gives the local government a copy of the application and approval documents', 5, 'business',
  'Building Act 1975 (Qld) s 86(1)(a): https://www.legislation.qld.gov.au/view/whole/html/inforce/current/act-1975-011'),
 ('LODGE', 'VIC', 'Building surveyor gives the relevant council a copy of the building permit, plans and documents', 7, 'calendar',
  'Building Act 1993 (Vic) s 30(1): https://content.legislation.vic.gov.au/sites/default/files/2026-09/93-126aa152-authorised.pdf'),
 ('LODGE', 'NSW', 'Private certifier forwards the certificate, plans and specifications to council after determination', 2, 'calendar',
  'NSW Department of Planning guide, Your guide to the post-consent process (confirm against the Development Certification and Fire Safety Regulation 2021): https://www.planning.nsw.gov.au/sites/default/files/2026-05/your-guide-to-the-post-consent-process.pdf'),
 ('COMMENCE', 'NSW', 'Notice of intention to commence work given at least 2 days before work starts', 2, 'calendar',
  'NSW Department of Planning guide (Development Certification and Fire Safety Regulation 2021 s 59 per the NSW Planning Portal guide): https://www.planning.nsw.gov.au/sites/default/files/2026-05/your-guide-to-the-post-consent-process.pdf'),
 ('RETAIN', 'QLD', 'Keep a copy of the application and approval documents for at least 5 years', 5, null,
  'Building Act 1975 (Qld) s 147(2): https://www.legislation.qld.gov.au/view/whole/html/inforce/current/act-1975-011');

insert into stage_rules (jurisdiction, class_pattern, stage, sequence, source) values
 ('QLD', '^1a$', 'Excavation', 1, 'Building Regulation 2021 (Qld) s 44(1)(b)(i)'),
 ('QLD', '^1a$', 'Footings', 2, 'Building Regulation 2021 (Qld) s 44(1)(b)(ii)'),
 ('QLD', '^1a$', 'Slab', 3, 'Building Regulation 2021 (Qld) s 44(1)(b)(iii)'),
 ('QLD', '^1a$', 'Frame bracing', 4, 'Building Regulation 2021 (Qld) s 44(1)(b)(v)'),
 ('QLD', '^1a$', 'Cladding bracing', 5, 'Building Regulation 2021 (Qld) s 44(1)(b)(iv)'),
 ('QLD', '^1a$', 'Reinforced masonry', 6, 'Building Regulation 2021 (Qld) s 44(1)(b)(vi)'),
 ('QLD', '^1a$', 'Final', 7, 'Building Regulation 2021 (Qld) s 44(1)(b)(vii)'),
 ('QLD', '^10[ab]?$', 'Final', 1, 'Building Regulation 2021 (Qld) s 44(1)(d)'),
 ('VIC', '.*', 'Footings', 1, 'Building Regulations 2018 (Vic) reg 167(a)'),
 ('VIC', '.*', 'Reinforced concrete', 2, 'Building Regulations 2018 (Vic) reg 167(b)'),
 ('VIC', '.*', 'Frame', 3, 'Building Regulations 2018 (Vic) reg 167(c)'),
 ('VIC', '.*', 'Final', 4, 'Building Regulations 2018 (Vic) reg 167(e)'),
 ('NSW', '^1[ab]?$', 'Footings', 1, 'NSW Department of Planning guide, critical stage inspections'),
 ('NSW', '^1[ab]?$', 'Slab', 2, 'NSW Department of Planning guide, critical stage inspections'),
 ('NSW', '^1[ab]?$', 'Frame', 3, 'NSW Department of Planning guide, critical stage inspections'),
 ('NSW', '^1[ab]?$', 'Waterproofing', 4, 'NSW Department of Planning guide, critical stage inspections'),
 ('NSW', '^1[ab]?$', 'Stormwater', 5, 'NSW Department of Planning guide, critical stage inspections'),
 ('NSW', '^1[ab]?$', 'Final', 6, 'NSW Department of Planning guide, critical stage inspections');

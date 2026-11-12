-- Fictional demo desk across NSW, QLD and VIC. Dates are relative to today, so the overdue,
-- late and quiet rows stay overdue, late and quiet whenever you run it. Runs once: a second run does nothing.
do $$
declare d date := current_date;
begin
  if exists (select 1 from certifiers where code = 'CE-AM') then return; end if;

  insert into certifiers (code, name, jurisdiction, registration_no, registration_class, registration_expires) values
   ('CE-AM', 'Amelia Moretti', 'NSW', 'DEMO-NSW-0418', 'Registered certifier, building surveying, unrestricted', d + 40),
   ('CE-RK', 'Raj Kumar', 'QLD', 'DEMO-QLD-1102', 'Building certifier level 1', d + 400),
   ('CE-SL', 'Sophie Lin', 'VIC', 'DEMO-VIC-2290', 'Building surveyor, unlimited', d - 20),
   ('CE-TN', 'Tom Nguyen', 'VIC', 'DEMO-VIC-3315', 'Building surveyor, unlimited', d + 700);

  insert into councils (code, name, jurisdiction, lodgement_route) values
   ('CO-HBR', 'Harbourview Council (demo)', 'NSW', 'portal'),
   ('CO-RBC', 'Riverbend City Council (demo)', 'QLD', 'email'),
   ('CO-BAY', 'Baywater Shire Council (demo)', 'VIC', 'email');

  insert into clients (code, name, kind, email, phone) values
   ('CL-0001', 'Ridgeline Homes Pty Ltd', 'builder', 'admin@ridgeline.example', '02 5550 0101'),
   ('CL-0002', 'Summit Build Co', 'builder', 'office@summitbuild.example', '07 5550 0202'),
   ('CL-0003', 'J and M Taylor', 'owner', 'taylors@example.com', '0400 000 303'),
   ('CL-0004', 'Northgate Developments', 'developer', 'projects@northgate.example', '03 5550 0404');

  insert into quotes (code, client_id, site_address, jurisdiction, approval_type, building_class, description, fee_cents, inspections_included, sent_on, status, answered_on) values
   ('Q-0001', (select id from clients where code = 'CL-0004'), '12 Ocean Pde, Harbourview', 'NSW', 'Complying development certificate', '1a', 'New two-storey dwelling with garage', 385000, 6, d - 21, 'sent', null),
   ('Q-0002', (select id from clients where code = 'CL-0001'), '4 Gum Tree Ct, Riverbend', 'QLD', 'Building approval', '10a', 'Steel shed, 9 m by 6 m', 95000, 1, d - 3, 'sent', null),
   ('Q-0003', (select id from clients where code = 'CL-0003'), '27 Wattle St, Baywater', 'VIC', 'Building permit', '1a', 'Single-storey rear extension', 420000, 4, d - 30, 'accepted', d - 25),
   ('Q-0004', (select id from clients where code = 'CL-0002'), '88 Marine Dr, Harbourview', 'NSW', 'Construction certificate', '2', 'Six-unit residential building', 1850000, 8, d - 40, 'declined', d - 33);

  insert into applications (code, quote_id, client_id, council_id, certifier_id, jurisdiction, approval_type, building_class, site_address, description, status,
    received_on, decided_on, decision, council_lodged_on, commencement_notice_on, work_commenced_on, final_issued_on, final_type, closed_on,
    fee_cents, invoiced_cents, paid_cents, certifier_design_role, certifier_financial_interest, conflict_note) values
   ('J-0001', null, (select id from clients where code = 'CL-0001'), (select id from councils where code = 'CO-HBR'), (select id from certifiers where code = 'CE-AM'), 'NSW',
    'Complying development certificate', '1a', '9 Banksia Ave, Harbourview', 'New single-storey dwelling', 'approved',
    d - 20, d - 4, 'approved', null, null, null, null, null, null, 360000, 360000, 0, false, false, null),
   ('J-0002', null, (select id from clients where code = 'CL-0002'), (select id from councils where code = 'CO-HBR'), (select id from certifiers where code = 'CE-AM'), 'NSW',
    'Construction certificate', '1a', '15 Coral St, Harbourview', 'Two-storey dwelling', 'under construction',
    d - 120, d - 100, 'approved', d - 99, d - 92, d - 90, null, null, null, 520000, 260000, 260000, false, false, null),
   ('J-0003', null, (select id from clients where code = 'CL-0003'), (select id from councils where code = 'CO-RBC'), (select id from certifiers where code = 'CE-RK'), 'QLD',
    'Building approval', '10a', '3 Creek Rd, Riverbend', 'Detached garage', 'approved',
    d - 25, d - 14, 'approved', d - 2, null, null, null, null, null, 95000, 95000, 95000, false, false, null),
   ('J-0004', null, (select id from clients where code = 'CL-0001'), (select id from councils where code = 'CO-RBC'), (select id from certifiers where code = 'CE-RK'), 'QLD',
    'Building approval', '1a', '21 Jacaranda St, Riverbend', 'Single-storey dwelling, lightweight cladding', 'under construction',
    d - 200, d - 180, 'approved', d - 178, null, d - 170, null, null, null, 640000, 480000, 320000, false, false, null),
   ('J-0005', null, (select id from clients where code = 'CL-0004'), (select id from councils where code = 'CO-BAY'), (select id from certifiers where code = 'CE-TN'), 'VIC',
    'Building permit', '1a', '5 Pier St, Baywater', 'Townhouse with in situ slab', 'final issued',
    d - 300, d - 280, 'approved', d - 276, null, d - 270, d - 20, 'Occupancy permit', null, 780000, 780000, 780000, false, false, null),
   ('J-0006', (select id from quotes where code = 'Q-0003'), (select id from clients where code = 'CL-0003'), (select id from councils where code = 'CO-BAY'), (select id from certifiers where code = 'CE-TN'), 'VIC',
    'Building permit', '1a', '27 Wattle St, Baywater', 'Single-storey rear extension', 'information requested',
    d - 24, null, null, null, null, null, null, null, null, 420000, 0, 0, true, false, 'Certifier drew a concept sketch for the owners before the appointment'),
   ('J-0007', null, (select id from clients where code = 'CL-0004'), (select id from councils where code = 'CO-HBR'), (select id from certifiers where code = 'CE-AM'), 'NSW',
    'Complying development certificate', '1a', '40 Ridge Rd, Harbourview', 'New dwelling', 'under construction',
    d - 170, d - 150, 'approved', d - 149, d - 140, d - 138, null, null, null, 390000, 195000, 195000, false, false, null),
   ('J-0008', null, (select id from clients where code = 'CL-0002'), (select id from councils where code = 'CO-RBC'), (select id from certifiers where code = 'CE-RK'), 'QLD',
    'Building approval', '1a', '11 Mango Ln, Riverbend', 'Single-storey dwelling', 'closed',
    d - 900, d - 880, 'approved', d - 878, null, d - 870, d - 700, 'Final inspection certificate', d - 690, 610000, 610000, 610000, false, false, null),
   ('J-0009', null, (select id from clients where code = 'CL-0001'), (select id from councils where code = 'CO-HBR'), (select id from certifiers where code = 'CE-AM'), 'NSW',
    'Construction certificate', '1a', '2 Shell Cove Rd, Harbourview', 'Two-storey dwelling', 'under construction',
    d - 160, d - 140, 'approved', d - 139, null, d - 135, null, null, null, 480000, 480000, 0, false, false, null),
   ('J-0010', null, (select id from clients where code = 'CL-0002'), (select id from councils where code = 'CO-BAY'), (select id from certifiers where code = 'CE-SL'), 'VIC',
    'Building permit', '10a', '61 Bay Rd, Baywater', 'Carport', 'approved',
    d - 15, d - 5, 'approved', d - 3, null, null, null, null, null, 110000, 0, 0, false, false, null),
   ('J-0011', null, (select id from clients where code = 'CL-0003'), (select id from councils where code = 'CO-HBR'), (select id from certifiers where code = 'CE-AM'), 'NSW',
    'Construction certificate', '1a', '7 Fig Tree Ln, Harbourview', 'Alterations and first-floor addition', 'information requested',
    d - 6, null, null, null, null, null, null, null, null, 410000, 0, 0, false, false, null),
   ('J-0012', null, (select id from clients where code = 'CL-0004'), (select id from councils where code = 'CO-RBC'), (select id from certifiers where code = 'CE-RK'), 'QLD',
    'Building approval', '1a', '19 Palm Ct, Riverbend', 'Single-storey dwelling', 'approved',
    d - 18, d - 3, 'approved', null, null, null, null, null, null, 620000, 0, 0, false, false, null);

  insert into stage_exemptions (application_id, stage, reason, actor) values
   ((select id from applications where code = 'J-0004'), 'Reinforced masonry', 'No reinforced masonry in the approved design', 'Raj Kumar'),
   ((select id from applications where code = 'J-0008'), 'Reinforced masonry', 'No reinforced masonry in the approved design', 'Raj Kumar');

  insert into inspections (code, application_id, stage, booked_for, inspector_id, result, inspected_on, findings, evidence_ref)
  select v.code, a.id, v.stage, d + v.booked, ce.id, v.result, case when v.result in ('booked','cancelled') then null else d + v.booked end, v.findings, v.evidence
  from (values
   ('INS-0001', 'J-0002', 'Footings', -85, 'CE-AM', 'passed', 'Excavation and reinforcement to engineer''s details.', 'photos/J-0002/footings'),
   ('INS-0002', 'J-0002', 'Frame', -30, 'CE-AM', 'passed', 'Frame, bracing and tie-downs to approved plans.', 'photos/J-0002/frame'),
   ('INS-0003', 'J-0002', 'Waterproofing', 2, 'CE-AM', 'booked', '', null),
   ('INS-0004', 'J-0004', 'Excavation', -165, 'CE-RK', 'passed', 'Foundation material as per soil report.', 'photos/J-0004/excavation'),
   ('INS-0005', 'J-0004', 'Footings', -164, 'CE-RK', 'passed', 'Formwork and reinforcement checked.', 'photos/J-0004/footings'),
   ('INS-0006', 'J-0004', 'Slab', -150, 'CE-RK', 'passed', 'Slab reinforcement and set-downs checked.', 'photos/J-0004/slab'),
   ('INS-0007', 'J-0004', 'Frame bracing', -6, 'CE-RK', 'failed', 'Tie-downs missing at two internal wall junctions. Bracing panel B4 short of nailing schedule.', 'photos/J-0004/frame-1'),
   ('INS-0008', 'J-0004', 'Cladding bracing', -2, 'CE-RK', 'booked', '', null),
   ('INS-0009', 'J-0005', 'Footings', -265, 'CE-TN', 'passed', 'Footings to engineer''s design.', 'photos/J-0005/footings'),
   ('INS-0010', 'J-0005', 'Frame', -200, 'CE-TN', 'passed', 'Frame complete, no defects.', 'photos/J-0005/frame'),
   ('INS-0011', 'J-0005', 'Final', -22, 'CE-TN', 'passed', 'Work complete to approved plans.', 'photos/J-0005/final'),
   ('INS-0012', 'J-0007', 'Footings', -130, 'CE-AM', 'passed', 'Footings to engineer''s details.', 'photos/J-0007/footings'),
   ('INS-0013', 'J-0009', 'Footings', -128, 'CE-AM', 'passed', 'Footings checked.', 'photos/J-0009/footings'),
   ('INS-0014', 'J-0009', 'Slab', -110, 'CE-AM', 'passed', 'Slab checked.', 'photos/J-0009/slab'),
   ('INS-0015', 'J-0009', 'Frame', -70, 'CE-AM', 'not ready', 'Roof trusses not yet fixed. Rebook.', null),
   ('INS-0016', 'J-0009', 'Frame', -60, 'CE-AM', 'passed', 'Frame complete.', 'photos/J-0009/frame'),
   ('INS-0017', 'J-0009', 'Waterproofing', -40, 'CE-AM', 'passed', 'Wet areas membrane checked, bathroom and laundry.', 'photos/J-0009/waterproofing'),
   ('INS-0018', 'J-0009', 'Stormwater', -20, 'CE-AM', 'passed', 'Connection to street drainage checked.', 'photos/J-0009/stormwater'),
   ('INS-0019', 'J-0009', 'Final', -3, 'CE-AM', 'passed', 'Work complete. Smoke alarms and balustrades checked.', 'photos/J-0009/final'),
   ('INS-0020', 'J-0012', 'Excavation', 3, 'CE-RK', 'booked', '', null),
   ('INS-0021', 'J-0008', 'Excavation', -868, 'CE-RK', 'passed', 'Checked.', 'archive/J-0008'),
   ('INS-0022', 'J-0008', 'Footings', -866, 'CE-RK', 'passed', 'Checked.', 'archive/J-0008'),
   ('INS-0023', 'J-0008', 'Slab', -850, 'CE-RK', 'passed', 'Checked.', 'archive/J-0008'),
   ('INS-0024', 'J-0008', 'Frame bracing', -800, 'CE-RK', 'passed', 'Checked.', 'archive/J-0008'),
   ('INS-0025', 'J-0008', 'Cladding bracing', -760, 'CE-RK', 'passed', 'Checked.', 'archive/J-0008'),
   ('INS-0026', 'J-0008', 'Final', -702, 'CE-RK', 'passed', 'Work complete.', 'archive/J-0008')
  ) v(code, job, stage, booked, inspector, result, findings, evidence)
  join applications a on a.code = v.job
  join certifiers ce on ce.code = v.inspector;

  insert into info_requests (code, application_id, request, sent_on, due_on, received_on) values
   ('RFI-0001', (select id from applications where code = 'J-0006'), 'Engineer''s footing design and a site plan showing the boundary setback to the rear fence.', d - 20, d - 6, null),
   ('RFI-0002', (select id from applications where code = 'J-0011'), 'Bushfire attack level assessment and updated window schedule.', d - 2, d + 8, null);

  insert into notes (application_id, actor, body) values
   ((select id from applications where code = 'J-0004'), 'Raj Kumar', 'Builder says tie-downs will be fixed this week. Asked them to book the reinspection.'),
   ((select id from applications where code = 'J-0007'), 'Amelia Moretti', 'Owner changed builders. Site quiet since the footings.');

  insert into audit_log (entity, operation, actor, detail) values ('seed', 'demo data loaded', 'seed', '{"note":"fictional demo desk"}');
end $$;

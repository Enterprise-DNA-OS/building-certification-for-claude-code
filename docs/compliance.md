# The rules the checks use

Checked 12 November 2026. These are the clocks and inspection stages `npm run certify -- compliance` checks the job file against. They are prompts for the responsible certifier, not legal advice. A clean report does not mean a job complies. Confirm every rule against the current legislation for your practice before you rely on it, and change a rule with a new migration (see `/customise`).

Queensland and Victoria rules were read on the official legislation sites. The NSW legislation site could not be read for this release, so the NSW clocks and stages come from official NSW Government guidance and are marked for you to confirm against the regulation.

## Lodgement clock (rule LODGE, LODGE-LATE)

| State | Clock | Source, wording |
|---|---|---|
| QLD | 5 business days | Building Act 1975 s 86(1)(a): the private certifier must "within 5 business days, give the local government a copy of ... the application; ... the approval documents". [legislation.qld.gov.au](https://www.legislation.qld.gov.au/view/whole/html/inforce/current/act-1975-011) |
| VIC | 7 days | Building Act 1993 s 30(1): "within 7 days after issuing any building permit ... must give to the relevant council a copy of that permit and any plans and other documents". [Authorised Act](https://content.legislation.vic.gov.au/sites/default/files/2026-09/93-126aa152-authorised.pdf) |
| NSW | 2 days (confirm) | NSW Department of Planning, *Your guide to the post-consent process*: a private certifier must forward "a copy of the certificate, associated plans, and specifications ... to the relevant council within 2 days after the date of determination". [Guide](https://www.planning.nsw.gov.au/sites/default/files/2026-05/your-guide-to-the-post-consent-process.pdf). Building Commission NSW also requires certification data reported "no later than 2 days after each reportable event". [Reporting data](https://www.nsw.gov.au/housing-and-construction/compliance-and-regulation/building-certifiers/reporting-data) |

Business days skip Saturday and Sunday. Public holidays are only skipped once you add them to the `public_holidays` table. Other documents carry their own clocks (QLD certificate of occupancy s 108 and inspection documentation s 149, five business days; VIC occupancy permit documents reg 204 and certificate of final inspection reg 205, seven days). The base checks the approval clock only; add the others with `/customise`.

## Required stage inspections (rules STAGE-SKIPPED, STAGE-BEFORE-FINAL)

| State | Applies to | Stages | Source |
|---|---|---|---|
| QLD | Class 1a single detached house | Excavation, Footings, Slab, Frame bracing, Cladding bracing, Reinforced masonry, Final | Building Regulation 2021 s 44(1)(b)(i) to (vii). [legislation.qld.gov.au](https://www.legislation.qld.gov.au/view/whole/html/inforce/current/sl-2021-0126) |
| QLD | Class 10 | Final | Building Regulation 2021 s 44(1)(d) |
| VIC | Every building permit | Footings, Reinforced concrete, Frame, Final | Building Regulations 2018 reg 167(a), (b), (c), (e). Reg 170 lets the surveyor omit a stage that is not relevant; reg 171 requires the stages in the permit. [Authorised Regulations](https://content.legislation.vic.gov.au/sites/default/files/2026-10/18-38sra032-authorised.pdf) |
| NSW | Class 1 (confirm) | Footings, Slab, Frame, Waterproofing, Stormwater, Final | NSW Department of Planning guide above, which lists inspections that "may include" these stages. The statute is the Development Certification and Fire Safety Regulation 2021 s 61; confirm its list for your work. NSW class 10 stages are not encoded. |

Stages a job does not have (no slab, no reinforced masonry, no in situ concrete) are recorded per job with `stage-not-required` and a reason. Extra stages your approval names (QLD s 44, VIC reg 167(d)) are booked with `book-inspection` and checked by the certifier.

STAGE-SKIPPED fires when a later stage has passed on a job under construction while an earlier required stage has no passed or booked inspection. STAGE-BEFORE-FINAL fires when a final is recorded while any required stage has no passed inspection. `issue-final` refuses in that state; the check finds older or imported records.

## Notice of commencement (rules COMMENCEMENT, COMMENCEMENT-SHORT)

NSW only. The Department's guide: "You need to provide 2 days' notice before you intend to start work." The NSW Planning Portal guide cites the Development Certification and Fire Safety Regulation 2021 s 59. [Portal guide](https://www.planningportal.nsw.gov.au/sites/default/files/documents/2024/NSW%20Planning%20Portal%20-%20How%20to%20submit%20Intention%20to%20Commence%20Work%20v2_0.pdf)

## Conflicts of interest (rule CONFLICT)

A job opened with a design role or financial interest recorded is listed until it is withdrawn. The certifier decides; the check keeps it visible.

- NSW: Building and Development Certifiers Act 2018 s 29. A conflicted certifier "must not: carry out any inspection, issue any certificate". Private interests include being "involved in its design". [NSW Government](https://www.nsw.gov.au/housing-and-construction/compliance-and-regulation/building-certifiers/conflicts-of-interest)
- QLD: Building Act 1975 s 137: "A private certifier must not perform a private certifying function if ... the certifier has a conflict of interest", including a "direct or indirect pecuniary interest in the building" and preparing the design.
- VIC: Building Act 1993 s 79(1): the private building surveyor must not act if they or a related person "prepared the design" or has "a direct or indirect pecuniary interest".

## Registration (rule REGISTRATION)

An internal control: a decision recorded after the deciding certifier's registration expiry date. `decide` refuses it; the check finds older or imported records. `/certifiers` lists every registration expiring inside 60 days.

## Information requests (rule INFO-OVERDUE)

An internal control: a request for further information past the due date you set, not received.

## Keeping files (`/retention`)

| State | Period | Source |
|---|---|---|
| QLD | At least 5 years from the relevant day | Building Act 1975 s 147(2): "for at least 5 years from the relevant day, keep a copy of the application and the approval documents" |
| NSW | Not encoded | The Building and Development Certifiers Regulation 2020 Part 7 sets record keeping. Confirm the period and add it to `rules`. |
| VIC | Not encoded | No general period for building surveyors was found in the Act or Regulations. Set your practice's period. |

The base never deletes a file. The retention list says how long to keep it.

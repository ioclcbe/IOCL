# Production Acceptance Checklist

## Build and supply-chain gate

- `package-lock.json` generated in trusted connected CI, reviewed and committed
- Clean `npm ci`, type-check, unit tests and production builds passed
- Database migration tested from an empty database and from the previous release schema
- SAST, SCA, secret scan, container scan and SBOM review passed
- Dependency exceptions documented with owner and remediation date

## Business and integration gate

- Official QR payload examples, signing/verification method and anti-replay behaviour approved
- Official crew/pass source, outage mode and revocation behaviour approved
- Exact safety checklist, mandatory remarks and escalation SOP approved
- Customer/destination master source approved
- IN/OUT ownership and exit-lock integration tested
- Facility/gate/day-boundary rules approved
- User roles, password/MFA policy and leaver process approved
- Personal-data masking, retention, archival and deletion policy approved

## Infrastructure and operations gate

- HTTPS, HSTS, CORS, cookie domain, proxy hop count and firewall verified
- Secrets loaded from an approved secrets manager and rotation tested
- Database encryption, least-privilege account, backup, restore and disaster-recovery tests passed
- Central logs, security alerts, dashboards and on-call ownership active
- Concurrent gate/device tests passed
- Android camera, USB/Bluetooth scanner, screen-size and kiosk-mode tests passed
- Poor-network/reconnect behaviour tested at the actual gate
- Load/performance target passed on production-like data
- Penetration test findings closed or formally accepted
- IOCL logo/brand/legal approval received
- Supervisor and security-user UAT signed off

No live gate opening should occur until every applicable item is completed and formally approved.

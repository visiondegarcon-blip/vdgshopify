# Resend DNS records — news.visiondegarcon.fr

Sending subdomain for VDG marketing/transactional email.
Resend account: yungnihon3@gmail.com · Region: Ireland (eu-west-1)

A subdomain (`news.`) is used deliberately: it isolates bulk-send reputation
from the root domain, and none of these records disturb existing mail or the
website on visiondegarcon.fr.

Add these in Squarespace → Domains → visiondegarcon.fr → DNS Settings.
Squarespace appends the domain automatically, so enter the Host exactly as
shown (no trailing `.visiondegarcon.fr`).

| # | Type | Host | Priority | Value |
|---|------|------|----------|-------|
| 1 | TXT | `resend._domainkey.news` | — | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCWsQEjTOXTEuwI0Mjd0wtT3oWq5+zh7icK2+0AcfDBABdNA1eiAkfVuRFwFS1hdeRuJKRfXBI4pyWMxWLsduqHncVKC/9ytYDSjC/zqcBl9AdPqFE2VS+D+OmXg9utCETXgRjumXlVe9HicQJz6OiYrrgPMJF8hZt1vXsmsWoiCwIDAQAB` |
| 2 | MX | `send.news` | 10 | `feedback-smtp.eu-west-1.amazonses.com` |
| 3 | TXT | `send.news` | — | `v=spf1 include:amazonses.com ~all` |
| 4 | TXT | `_dmarc` | — | `v=DMARC1; p=none;` |

Record 4 (DMARC) is optional and applies to the whole domain, but `p=none` is
monitoring-only — it reports without ever causing mail to be rejected.

After the records propagate, click **Verify** on
https://resend.com/domains, then set the sender in the VDG admin under
Marketing → Campaigns (`email_from`), e.g. `VDG <hello@news.visiondegarcon.fr>`.
Until that's done, sends fall back to `onboarding@resend.dev`, which can only
deliver to the Resend account owner's own inbox.

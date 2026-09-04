# Circular product map

This scope combines the supplied 39-page Circle admin-console capture with Circle's public product and help documentation reviewed on 2 September 2026.

## Product pillars

1. Community: spaces, space groups, posts, comments, reactions, chat, rich member profiles, directory, moderation, gamification, notifications, and search.
2. Learning: courses, sections and lessons, video/content hosting, cohorts, progress, completion, and certificates.
3. Experiences: events, RSVPs, recurring event series, live rooms, live streams, recordings, and transcripts.
4. CRM and growth: contacts, members/non-members, custom profile fields, tags, segments, activity scores, invite links, forms, broadcasts, newsletters, and lifecycle email.
5. Automation and intelligence: trigger/action workflows, scheduled and bulk workflows, workflow history, AI filters/actions, AI agents, knowledge sources, moderation, support, analysis, and content co-pilot.
6. Web presence: visual website and landing-page builder, custom navigation, branding, custom domains, SEO, templates, and code snippets.
7. Monetization: Stripe-connected paywalls, recurring and one-time prices, trials, installment/BNPL options, coupons, access groups, subscriptions, transaction history, affiliates, commissions, and analytics.
8. Platform: multi-tenancy, roles and permissions, SSO, admin/headless APIs, webhooks/integrations, branded apps, analytics, and auditability.

## Current implementation

The local prototype exposes every pillar in a unified admin shell plus a member-facing community preview. It includes working navigation, tenant switching, command search, quick-create flows, a member-preview interaction, responsive layouts, and local-state persistence for the selected workspace.

The Supabase migration establishes tenant-scoped tables and row-level-security policies for the core domain. Items that need external infrastructure—real-time video, transactional email delivery, payment processing, AI model calls, file transcoding, native mobile apps, and custom-domain provisioning—are represented in the product and data model but intentionally remain adapter work for later phases.

## Official research sources

- Circle platform: https://circle.so/platform
- Circle customer communities: https://circle.so/platform/customer-communities
- Circle courses: https://circle.so/platform/courses
- Workflow overview: https://help.circle.so/p/workflows/workflow-setup/workflows-overview
- Workflow triggers and actions: https://help.circle.so/p/workflows/workflow-setup/workflows-roadmap
- Paywall setup: https://help.circle.so/p/payments/paywall-setup/paywalls-overviews
- Affiliates: https://help.circle.so/p/payments/affiliates

# Launch Funnel Assets (Steps 1-4)

This document gives deploy-ready assets for your launch funnel:

1. Landing page headline and CTA blocks
2. Segmentation quiz (offer matching)
3. First 5 launch emails
4. Recommended final pricing card

Use this as the source of truth for copy and offer structure while the app is pre-launch.

---

## 1) Landing Page Headline + CTA Blocks

### Primary Hero Copy (Revenue-first)

- Eyebrow: "Online Coaching for Busy Adults"
- Headline: "Lose Fat, Build Strength, and Stay Consistent With a Coach in Your Pocket"
- Subhead: "Get a personalized training program, weekly accountability, and direct in-app messaging with Scott. Apply now for founding client spots."

### Primary CTA

- Button label: "Apply for Coaching"
- Destination: `/apply` (or first step quiz)

### Secondary CTA

- Button label: "Join Waitlist"
- Destination: current waitlist submit

### Trust/Proof Row (below hero)

- "Personalized plans, not templates"
- "Message support with 24-hour response on weekdays"
- "Optional live sessions when you need higher-touch coaching"

### Offer Block Copy

- Section title: "Choose Your Coaching Path"
- Section subtitle: "Start with the level of support you need now, then upgrade when ready."

Card 1:
- Name: "Program + Messaging"
- One-liner: "High-accountability coaching without weekly calls."
- CTA: "Start Here"

Card 2:
- Name: "Hybrid Coaching"
- One-liner: "Program + messaging + 1 monthly video session."
- CTA: "Most Popular"

Card 3:
- Name: "Premium 1:1"
- One-liner: "Maximum support with weekly or biweekly sessions."
- CTA: "Apply for Premium"

### Objection Handling Block

- Title: "Not Sure Which Plan Fits?"
- Body: "Take the 2-minute fit quiz and we will recommend your best starting tier based on goals, schedule, and support needs."
- CTA: "Take the Fit Quiz"

### Bottom CTA

- Headline: "Ready to Start in the Next 14 Days?"
- Body: "Founding rates are limited and will increase after launch."
- Primary CTA: "Apply for Coaching"
- Secondary CTA: "Join Waitlist"

---

## 2) Fit Quiz Questions + Routing Logic

Use this as a multi-step form. Keep it to 2-3 minutes max.

### Quiz Questions

1. What is your main goal right now?
- Lose body fat
- Build muscle
- Improve strength/performance
- Rebuild consistency

2. How quickly do you want visible progress?
- ASAP (0-30 days)
- 1-3 months
- 3-6 months
- No strict timeline

3. How many days per week can you realistically train?
- 2
- 3
- 4
- 5+

4. Which support level do you prefer?
- Program only + check-ins
- Program + messaging access
- Program + messaging + monthly calls
- Weekly direct calls and hands-on coaching

5. What usually stops your progress?
- No clear plan
- Inconsistent accountability
- Nutrition/lifestyle habits
- Technique/form confidence

6. Have you worked with a coach before?
- Yes, and it worked
- Yes, but I did not stay consistent
- No, first time

7. Monthly investment comfort for coaching?
- Under $100
- $100-$200
- $200-$400
- $400+

8. How ready are you to start?
- This week
- Within 2 weeks
- Within 30 days
- Just researching

### Scoring + Offer Match

- Program + Messaging score signals:
  - support preference = program + messaging
  - budget = $100-$200
  - readiness = within 30 days or researching

- Hybrid score signals:
  - support preference = monthly calls
  - budget = $200-$400
  - readiness = this week/2 weeks

- Premium 1:1 score signals:
  - support preference = weekly direct calls
  - budget = $400+
  - urgency = ASAP or this week

### Routing Logic

- If budget is under $100 and readiness is "just researching":
  - route to waitlist + nurture sequence

- If score matches Program + Messaging:
  - route to checkout for Tier 1

- If score matches Hybrid:
  - route to checkout for Tier 2

- If score matches Premium 1:1:
  - route to short application + deposit checkout

### Data to Store for Sales Follow-up

- email
- goal
- support preference
- budget band
- readiness window
- recommended tier

---

## 3) First 5 Launch Emails (Copy)

Use 1 email per day over 5 days for new leads from waitlist/quiz.

### Email 1 - Method + Vision

- Subject: "How online coaching with me works"
- Preview: "What to expect in your first 30 days"

Body:
Hi {{first_name}},

Thanks for joining Scott Gordon Fitness.

My coaching is built for people who want real progress without guessing:
- custom training plan based on your schedule and equipment
- clear progression each week
- direct messaging support for questions and accountability

The goal is simple: remove confusion and build momentum fast.

Over the next few emails, I will show you exactly how clients get results and how to choose the right coaching tier.

CTA: Take the Fit Quiz

---

### Email 2 - Proof + Credibility

- Subject: "What changes when you stop winging it"
- Preview: "The consistency system clients use"

Body:
Most people do not fail because they are lazy. They fail because they are running without a system.

Inside coaching, we focus on:
- realistic weekly targets
- a progression plan that adapts to your life
- direct accountability so you do not drift

Clients usually report the biggest win first as consistency, then body composition and strength follow.

CTA: See Coaching Options

---

### Email 3 - Offer + Founder Pricing

- Subject: "Founding client rates are open"
- Preview: "Limited spots before public launch"

Body:
Founding client spots are now open for a limited number of members.

Current options:
- Program + Messaging
- Hybrid Coaching (most popular)
- Premium 1:1

Founding rates are locked for 6 months once you join.

CTA: Apply for Coaching

---

### Email 4 - Objection Handling

- Subject: "Not sure if this is the right fit?"
- Preview: "Here is who this is and is not for"

Body:
This coaching is for you if:
- you want structure and accountability
- you are ready to train consistently
- you want expert feedback without wasting time

This is not for you if:
- you want a one-off generic plan
- you are not ready to take action yet

If you are unsure, take the fit quiz and I will point you to the best starting tier.

CTA: Take the Fit Quiz

---

### Email 5 - Deadline + Clear Next Step

- Subject: "Last call: founding spots close tonight"
- Preview: "Rates increase after this window"

Body:
Quick reminder: founding client pricing closes tonight.

If you want coaching support this month, now is the best time to join.

Pick your path:
- ready now -> apply for coaching
- not ready -> stay on waitlist and get future opening alerts

CTA: Apply for Coaching

Secondary CTA: Join Waitlist

---

## 4) Recommended Final Pricing Card

Use this as your initial live pricing model. Tune after 30-60 days of data.

### Tier 1 - Program + Messaging

- Price: $149/month
- Includes:
  - personalized training program updates
  - in-app messaging support
  - weekly accountability check-in
  - response SLA: within 24h weekdays
- Best for: self-driven clients who need structure + feedback

### Tier 2 - Hybrid Coaching (Most Popular)

- Price: $299/month
- Includes everything in Tier 1, plus:
  - one 60-minute video session per month
  - monthly progress audit and plan recalibration
- Best for: clients who want both async support and regular live touchpoints

### Tier 3 - Premium 1:1

- Price: $699/month
- Includes everything in Tier 2, plus:
  - 4x 60-minute video sessions per month (weekly)
  - priority message support
  - deeper accountability + custom troubleshooting
- Best for: high-accountability clients and faster optimization

### Add-ons

- Extra 60-minute video session: $119
- Form check pack (3 videos reviewed): $49
- Nutrition audit add-on: $79/month

### Offer Mechanics for Launch

- Founding offer: first 20 clients lock launch price for 6 months
- Hybrid and Premium minimum term: 3 months
- Tier upgrade available anytime; downgrade after minimum term

### Why this works for revenue

- Tier 1 drives scalable recurring revenue
- Tier 2 lifts ARPU with moderate time demand
- Tier 3 captures high-intent buyers without capping value

Revenue planning example:

- 20 clients on Tier 1 = $2,980 MRR
- 15 clients on Tier 2 = $4,485 MRR
- 6 clients on Tier 3 = $4,194 MRR
- Total = $11,659 MRR (before add-ons)

---

## Funnel KPI Targets (First 90 Days)

- Visitor -> lead opt-in: 5-10%
- Lead -> quiz completion: 45-60%
- Quiz completion -> paid: 8-15%
- Lead -> paid overall: 2-5%
- 30-day retention: 85%+
- 90-day retention: 70%+

If lead -> paid is low, improve offer clarity and social proof.
If paid conversion is good but retention is low, improve onboarding and first 14-day accountability.

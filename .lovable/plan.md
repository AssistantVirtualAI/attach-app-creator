
# Complete Trial, Notifications, Contact & Chatbot System

## Overview
This plan covers 5 major features that work together to create a complete user acquisition and support pipeline:

1. **Trial enforcement** -- After 14 days, block access and show a paywall
2. **Payment notifications** -- Email you when someone pays via Stripe
3. **Demo request email** -- Already works, but will verify the flow
4. **Contact Us page** -- New public page with a form that emails you
5. **AI Chatbot** -- Floating chat widget on the landing page, multilingual, knows your product

---

## 1. Trial Expiration Enforcement

**Currently**: Users get a 14-day trial (already set up), but there is **no enforcement** -- after 14 days they can still use everything.

**What we will build**:
- A `TrialExpiredBanner` component that appears as a full-screen overlay when the trial has expired and no paid plan is active
- It will show a clear message with a countdown ("Your trial expired X days ago") and buttons to choose a plan
- Integrated into the `ProtectedRoute` component in `App.tsx` so it gates ALL admin pages
- Users on an active paid subscription or within their trial period pass through normally
- The banner will include the pricing cards so users can subscribe directly from the paywall

**Files to create/modify**:
| File | Action |
|------|--------|
| `src/components/billing/TrialExpiredGate.tsx` | **Create** -- Full-screen paywall with pricing options |
| `src/components/billing/TrialBanner.tsx` | **Create** -- Warning banner shown when trial is ending soon (last 3 days) |
| `src/App.tsx` | **Modify** -- Wrap protected routes with trial check |

---

## 2. Payment Notification Emails

**Currently**: The Stripe webhook (`stripe-webhook/index.ts`) processes payments but does NOT notify you by email.

**What we will build**:
- Modify the existing `stripe-webhook` edge function to send you an email (via Resend) whenever an `invoice.paid` event is received
- The email will contain: customer email, amount paid, plan name, date
- Uses the existing `ADMIN_NOTIFICATION_EMAIL` and `RESEND_API_KEY` secrets (already configured)

**Files to modify**:
| File | Action |
|------|--------|
| `supabase/functions/stripe-webhook/index.ts` | **Modify** -- Add email notification on `invoice.paid` and `checkout.session.completed` events |

---

## 3. Demo Request Form (Already Working)

The demo request form at `/demo-request` already calls the `send-contact-sales` edge function which sends an email to `mhassoun@assistantvirtualai.com`. This is **already functional**. No changes needed unless you want to also route it to the `ADMIN_NOTIFICATION_EMAIL` secret instead of a hardcoded address. We will update it to use the secret for consistency.

**Files to modify**:
| File | Action |
|------|--------|
| `supabase/functions/send-contact-sales/index.ts` | **Modify** -- Use `ADMIN_NOTIFICATION_EMAIL` secret instead of hardcoded email |

---

## 4. Contact Us Page

**What we will build**:
- A new `/contact` page with a clean form: Name, Email, Subject, Message
- Bilingual (FR/EN) using the existing translation system
- Calls a new `send-contact-form` edge function that emails you with the form data
- Also sends a confirmation email to the person who submitted the form
- Accessible from the landing page navbar and footer

**Files to create/modify**:
| File | Action |
|------|--------|
| `src/pages/ContactUs.tsx` | **Create** -- Contact form page matching the existing design style |
| `supabase/functions/send-contact-form/index.ts` | **Create** -- Edge function to send contact form emails |
| `src/App.tsx` | **Modify** -- Add `/contact` route |
| `src/components/landing/Navbar.tsx` | **Modify** -- Add "Contact" link |
| `src/components/landing/FooterSection.tsx` | **Modify** -- Update contact link to `/contact` |
| `src/locales/en.ts` | **Modify** -- Add contact page translations |
| `src/locales/fr.ts` | **Modify** -- Add contact page translations |
| `supabase/config.toml` | **Modify** -- Register new edge function |

---

## 5. AI Chatbot Widget

**What we will build**:
- A floating chat bubble on the landing page (bottom-right corner)
- Powered by Lovable AI (no API key needed) via a backend edge function
- Automatically detects user language (FR/EN) from the `LanguageContext`
- Has full knowledge of your product: features, pricing, portals, integrations, agent creation, etc. (injected as system prompt)
- Can help users choose a plan (links them to `/login` to sign up)
- Each conversation summary is emailed to you via the `ADMIN_NOTIFICATION_EMAIL`
- Clean, modern UI with message bubbles, typing indicator, and smooth animations

**Architecture**:

```text
User types message
       |
       v
Frontend ChatWidget component
       |
       v
Edge Function "landing-chatbot"
  - Receives message + conversation history + user language
  - System prompt contains ALL product knowledge
  - Calls Lovable AI (Gemini model)
  - Returns AI response
       |
       v
Display response in chat UI
       |
       v
On conversation end / after N messages:
  Edge Function sends email summary to admin
```

**Files to create/modify**:
| File | Action |
|------|--------|
| `src/components/landing/ChatWidget.tsx` | **Create** -- Floating chat bubble + chat panel with message history |
| `supabase/functions/landing-chatbot/index.ts` | **Create** -- AI chatbot edge function with product knowledge system prompt |
| `supabase/functions/notify-chat-conversation/index.ts` | **Create** -- Edge function to email chat conversation summaries |
| `src/pages/Landing.tsx` | **Modify** -- Add ChatWidget component |
| `src/locales/en.ts` | **Modify** -- Add chatbot translations |
| `src/locales/fr.ts` | **Modify** -- Add chatbot translations |
| `supabase/config.toml` | **Modify** -- Register new edge functions |

---

## Technical Details

### Trial Gate Logic (TrialExpiredGate)
```typescript
// Checks billing_config for the current organization
// If plan_tier === 'trial' or 'free' AND trial_ends_at < now()
//   -> Show paywall with pricing cards
// If plan_tier is a paid tier AND subscription_status === 'active'
//   -> Pass through normally
// If within trial period
//   -> Pass through but show warning banner in last 3 days
```

### Chatbot System Prompt (embedded in edge function)
The system prompt will contain:
- Complete product description (AVA Statistics / AI Voice Agents platform)
- All plan details (pricing, features, limitations)
- Admin Portal features (agent creation, analytics, integrations, etc.)
- Client Portal features
- Integration details (ElevenLabs, Vapi, Retell)
- FAQ answers
- Instructions to respond in the user's language
- Instructions to guide users toward signing up when appropriate

### Email Notification Summary
For each chatbot conversation, you will receive:
- User's messages and bot responses
- Timestamp
- Language used
- Whether the user expressed interest in a specific plan
- Any contact information shared

### Stripe Webhook Enhancement
The `invoice.paid` handler will be extended to:
1. Look up the organization name from the database
2. Send a formatted HTML email with payment details
3. Include plan name, amount, and customer information

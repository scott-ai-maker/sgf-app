# SGFNative iOS App

This folder contains a native SwiftUI iOS app scaffold for SGF.

## What is included

- Email/password sign-in against Supabase Auth REST API
- Bearer-token authenticated calls to your existing Next.js API
- Native tabs for Dashboard, Messages, Booking, and Fitness
- Mobile dashboard bootstrap endpoint: `/api/mobile/dashboard`

## Prerequisites

- Xcode 16+
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) installed (`brew install xcodegen`)

## Setup

1. Open `SGFNative/Config/Configuration.plist`
2. Replace placeholders:
   - `APIBaseURL`: your deployed app URL (for example `https://app.example.com`)
   - `SupabaseURL`: your Supabase project URL
   - `SupabaseAnonKey`: your Supabase anon key
3. Generate project:

```bash
cd ios/SGFNative
xcodegen generate
open SGFNative.xcodeproj
```

## Notes

- The backend now accepts `Authorization: Bearer <access_token>` for protected endpoints.
- Browser CSRF checks remain enforced for cookie-authenticated browser flows.
- This is a production-grade foundation, but not yet full feature parity with the web app.

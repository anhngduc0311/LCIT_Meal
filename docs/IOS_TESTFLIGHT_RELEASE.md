# iOS / TestFlight

## Toolchain

Build 1.0.0 (10) uploaded successfully but Apple rejected processing with
ITMS-90725: it used the iOS 17.5 SDK. Upload success alone is not a passing release.

The replacement uses Expo SDK 54, React Native 0.81.5, React 19.1 and the pinned
EAS image `macos-sequoia-15.6-xcode-26.2`. Apple requires SDK 26 or newer for this
upload. Do not remove the explicit image without checking the replacement image.

References:

- [Expo SDK 26 upload requirements](https://expo.dev/blog/app-store-connect-minimum-sdk-26)
- [Expo build images](https://docs.expo.dev/build-reference/infrastructure/)
- [Expo SDK 54 changes](https://expo.dev/changelog/sdk-54)

## Upgrade notes

- Dependencies follow Expo's SDK 54 compatibility map, including Worklets 0.5.1.
- Babel uses the matching `babel-preset-expo`, which configures Worklets.
- Existing file download/export calls use `expo-file-system/legacy`.
- ESLint uses the SDK 54 flat configuration.
- Image Picker has explicit iOS photo/camera usage descriptions.
- SDK 54 uses the new architecture, iOS 15.1+ and Android API 24+.

## Release checks

Run typecheck, lint, app tests, Expo dependency validation and an iOS bundle export
before creating the signed build. On 06/11/2026, all 44 app tests, typecheck, lint,
dependency validation and the SDK 54 iOS bundle export passed. Expo Doctor passed
17 checks; its schema network check could not connect to the Expo API locally.

After EAS finishes, inspect the actual IPA's root app Info.plist: bundle ID,
version/build, `DTSDKName`, `DTPlatformVersion`, `DTXcode` and minimum OS. Require
`iphoneos26` or newer before submitting. After upload, wait for Apple processing
and inspect TestFlight state; `EAS FINISHED` does not establish Apple acceptance.

Production points at the Viettel API, uses automatic build numbers, and submits
to the existing App Store Connect application. SSO client secrets remain server-only.

## Replacement build 1.0.0 (11)

EAS build: `2b0514ff-ea33-4430-82fd-3bdb55224ea9`.
The downloaded signed IPA was inspected before submission and passed:

- Bundle ID: `com.lcit.meal`; version/build: `1.0.0` / `11`.
- `DTSDKName=iphoneos26.2`, `DTPlatformVersion=26.2`, `DTXcode=2620`.
- `MinimumOSVersion=15.1`; `ITSAppUsesNonExemptEncryption=false`.

Submission: `bfd3c006-61ff-43a8-a47e-e5516af101b2`.
Apple processing was verified through App Store Connect on 06/11/2026:

- `processingState=VALID`.
- `internalState=IN_BETA_TESTING`: available for internal testing.
- `externalState=READY_FOR_BETA_SUBMISSION`: external testing still requires a beta review submission.
- `expired=false`.

The ITMS-90725 SDK rejection affecting build 10 is resolved in build 11.

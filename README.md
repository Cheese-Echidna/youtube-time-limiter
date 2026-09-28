# YouTube Time Limiter

This WebExtension uses an elapsed-time YouTube allowance that refills continuously.

- 60 minutes accrue per 24 elapsed hours (one minute every 24 minutes)
- Allowance is capped at 120 minutes; there is no midnight reset
- Automatic tracking of watch time per calendar day (for history graph)
- 14-day usage graph in the popup
- Export full history as CSV
- Optional audio-only playback that hides video and charges one quota second per two seconds watched
- Save and rate videos from homepage recommendations, notifications, or watch pages; browse them by rating with thumbnails in the popup
- Completed videos automatically leave the saved list; unfinished videos keep their resume position
- Filter saved videos by what fits in the current quota at a chosen playback speed
- On-video finishability notices and a countdown during the final ten minutes
- With five minutes or less available, homepage recommendations give way to a break reminder
- No settings or controls that can extend the daily limit
- The synced quota state and a serialized background handler coordinate all tabs so simultaneous playback cannot race the counter
- TypeScript + ES module source architecture

## Project structure

```text
package.json
src/
    popup/
    lib/
build/
    web-ext-artifacts/
    signed-builds/
```

Additional generated extension source is emitted to `.extension-build/` for `web-ext` commands.

## Scripts

- `pnpm dev`: build in watch mode and run the extension in Firefox
- `pnpm build`: build and sign listed package into `build/signed-builds`
- `pnpm build_unlisted`: build and sign unlisted package into `build/signed-builds`
- `pnpm lint`: TypeScript type-check + ESLint
- `pnpm format`: Prettier formatting across project files
- `pnpm set-version "3.5.1"`: set the version in `package.json` and `src/manifest.json`

## Usage

- Click the extension icon to open the popup.
- The available time is shown at the top. When it is depleted, the currently playing video is paused and playback resumes as time accrues.
- Enable Audio-only playback to hide YouTube video while leaving audio playing at half of the normal quota rate.
- Click Save + rate on a recommendation, notification, or watch page and choose a score from 1 to 10. The popup lists saved videos by score and lets you change ratings or remove them.
- Use Show videos that fit in the popup to see saved videos with known durations that fit your current time; change the estimated playback speed there as needed.
- View the last 14 days of usage in the embedded graph.
- Click Export CSV to download your full watch history.

## Deployment hardening

Browser extensions cannot prevent a person with control of the browser profile from disabling or removing them. For an enforceable installation, deploy the signed extension through Firefox Enterprise Policies and block extension installation/removal through the organization's browser management policy. The extension stores its active quota in `browser.storage.sync`, which also makes ordinary profile-to-profile resets less effective when Firefox Sync is enabled.

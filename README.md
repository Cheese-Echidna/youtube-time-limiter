# YouTube Time Limiter

This WebExtension limits how much time you spend on YouTube with a fixed weekly cap.

- Fixed weekly limit: 7 hours per week
- Weekly reset at Monday 00:00 (local time)
- Automatic tracking of watch time per calendar day (for history graph)
- 14-day usage graph in the popup
- Export full history as CSV
- Midday playback restriction toggle
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

## Usage

- Click the extension icon to open the popup.
- The remaining time for the current week is shown at the top. When time runs out, the currently playing video will be paused.
- View the last 14 days of usage in the embedded graph.
- Click Export CSV to download your full watch history.

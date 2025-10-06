# YouTube Time Limiter

This WebExtension limits how much time you spend on YouTube with a fixed weekly cap. It now includes:

- Fixed weekly limit: 7 hours per week
- Weekly reset at Monday 00:00 (local time)
- Automatic tracking of watch time per calendar day (for history/graph)
- 14-day usage graph in the popup
- Export full history as CSV
- ESLint + Prettier for consistent code style

## Usage

- Click the extension icon to open the popup.
- The remaining time for the current week is shown at the top. When time runs out, the currently playing video will be paused.
- View the last 14 days of usage in the embedded graph.
- Click Export CSV to download your full watch history.

Notes:

- The time limit and reset schedule are fixed in the code (7 hours/week, reset Monday 00:00) and are not configurable from the popup.

## Development

Install dependencies:

```
npm install
```

Lint and format:

```
npm run lint
npm run format
```

### Build/sign with web-ext

Dev build (zip):

```
web-ext build
```

Production sign (PowerShell):

```
cd production
$keys = Get-Content ..\keys.txt | ConvertFrom-Json
web-ext sign --api-key $keys.apiKey --api-secret $keys.apiSecret --channel unlisted
```

## Credits

Forked from [RonanDesh/yt-time-limiter](https://github.com/RonanDesh/yt-time-limiter).

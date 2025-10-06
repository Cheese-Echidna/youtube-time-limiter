# YouTube Time Limiter

This WebExtension limits how much time you spend on YouTube per day. It now includes:

- Configurable daily limit (minutes)
- Configurable daily reset time (HH:MM local time)
- Automatic tracking of watch time per day
- 14-day usage graph in the popup
- Export full history as CSV
- ESLint + Prettier for consistent code style

## Usage

- Click the extension icon to open the popup.
- Set your Daily limit (minutes) and Reset time; click Save settings.
- The remaining time is shown at the top. When time runs out, currently playing video will be paused.
- View the last 14 days of usage in the embedded graph.
- Click Export CSV to download your full watch history.

Notes:

- The reset boundary uses the configured Reset time. A "day" is considered from Reset time to the next day's Reset time.

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

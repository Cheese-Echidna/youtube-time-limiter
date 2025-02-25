# YouTube time limiter
This version was modified from the original to make it a bit easier to work with.

Forked from [this](https://github.com/RonanDesh/yt-time-limiter) repo.

Build to zip (dev mode) with `web-ext build`

Build to zip (production mode) with 


cd production

$keys = Get-Content ..\keys.txt | ConvertFrom-Json

web-ext sign --api-key $keys.apiKey --api-secret $keys.apiSecret --channel unlisted
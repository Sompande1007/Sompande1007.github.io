# Contact form backend (Google Apps Script)

The Contact form on the portfolio posts each message to a Google Apps Script
web app, which emails it to Som's Gmail with the visitor's address as reply-to.

| | |
|---|---|
| **Deployment ID** | `AKfycbzip0zafC5NlV3swNZ_P3oGSY9q13Hzq6UzP9oUOxv_i7o-DlwHs48N-fmIJVIi0QXV` |
| **Web app URL** | https://script.google.com/macros/s/AKfycbzip0zafC5NlV3swNZ_P3oGSY9q13Hzq6UzP9oUOxv_i7o-DlwHs48N-fmIJVIi0QXV/exec |
| **Script source** | [`scripts/contact-form.gs`](../scripts/contact-form.gs) |
| **Used in** | `index.html`, on `<form class="ct__form" data-endpoint="…">` |
| **Runs as** | Som's Google account ("Execute as: Me"), access "Anyone" |

These aren't secrets: the URL has to be in the public page for the form to
reach it, and the script can only ever email Som.

## Updating the script without changing the URL

Edit the code at script.google.com, then **Deploy → Manage deployments →**
the pencil on the existing deployment **→ Version: New version → Deploy**.
That keeps the same deployment ID and URL.

Choosing **Deploy → New deployment** instead creates a *new* URL; if that
happens, update `data-endpoint` in `index.html` and this file.

## Checking it without sending mail

A request with the bot-trap field filled is accepted but never emailed:

```bash
curl -sL --data-urlencode "website=trap" --data-urlencode "name=x" --data-urlencode "email=x@example.com" --data-urlencode "message=x" --data-urlencode "elapsed=9999" "https://script.google.com/macros/s/AKfycbzip0zafC5NlV3swNZ_P3oGSY9q13Hzq6UzP9oUOxv_i7o-DlwHs48N-fmIJVIi0QXV/exec"
```

Expected reply: `{"ok":true}`.

## Limits and protection

- Personal Gmail accounts can send about 100 automated emails a day.
- The script also caps itself at 20 messages an hour.
- Bots are filtered by a hidden trap field and a minimum time to fill the form.

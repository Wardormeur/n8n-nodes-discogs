# n8n-nodes-discogs

n8n community node for looking up releases, masters, artists and labels in the Discogs music database, and their marketplace prices.

The node is read-only, and can also be used as a tool by n8n's AI Agent.

## Installation

Follow n8n's [community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/)
and install `n8n-nodes-discogs`.

## Credentials

The node uses a Discogs **personal access token**:

1. Sign in to discogs.com and open **Settings > Developers**
   (<https://www.discogs.com/settings/developers>).
2. Click **Generate new token** and copy it.
3. In n8n, create a **Discogs API** credential and paste the token.

The credential test calls Discogs' identity endpoint, which only answers to a
valid token. The token gives access to the database and to your account, so
treat it like a password. This node only reads.

## Operations

| Resource | Operation | What it returns |
|---|---|---|
| Release | Get | One release (a specific pressing), with an optional currency for its lowest marketplace price |
| Release | Search | Releases matching a query and filters |
| Master Release | Get | One master release (the group of all versions of a recording) |
| Master Release | Get Versions | Every version of a master: pressings, formats, countries; sortable |
| Master Release | Search | Master releases matching a query and filters |
| Artist | Get | One artist |
| Artist | Get Releases | The releases and masters an artist appears on; sortable by year, title or format |
| Artist | Search | Artists matching a query |
| Label | Get | One label |
| Label | Get Releases | The releases published on a label |
| Label | Search | Labels matching a query |
| Marketplace | Get Release Statistics | Lowest price (in a currency you pick), number of copies for sale, and whether the release is blocked from sale |

Records are picked **from a search list**, **by ID**, or **by pasting a
discogs.com URL** (for example
`https://www.discogs.com/release/249504-Rick-Astley-Never-Gonna-Give-You-Up`).

Search can use a free-text **Query** and **Filters** (artist, release title,
label, genre, style, country, year, format, catalog number, barcode). List
operations offer **Return All** or a **Limit** (up to 100).

Every operation except Marketplace has an **Output** setting: **Simplified**
(the most useful fields), **Raw** (the full Discogs response) or **Selected
Fields** (the ID plus the fields you pick).

## Rate limit

Discogs allows about **60 requests per minute** with a token and answers
faster traffic with HTTP **429**.

- **Return All** fetches pages of 100 and waits 1.1 seconds between pages.
  Large lists take time: a label with 190,000 releases would need about
  1,900 requests, more than half an hour.
- **Several input items** are sent back to back unless you turn on batching:
  in the node's **Request Options**, add **Batching** with **Items per
  Batch** `1` and **Batch Interval (ms)** `1000`. A node can't turn this on
  by default.
- **Retry On Fail** (node Settings) helps with an occasional 429; set **Wait
  Between Tries** to at least 1000 ms. n8n retries every error, so a request
  that fails with a 4xx (for example an unknown ID) is also repeated.

## Icon

The icon is the Discogs logo, taken from [Simple Icons](https://simpleicons.org)
16.35.0 (brand colour `#333333`, source <https://www.discogs.com/brand>). The
Discogs name and logo are Discogs' trademarks; this personal, non-commercial
package uses them only to identify the service.

## Development

```
npm install
npm run build      # compile and copy icons/codex into dist/
npm run lint
npm test           # unit tests
npm run test:e2e   # needs a local n8n with this package linked and a Discogs API credential
npm run test:fixtures   # the workflows in test/fixtures, which check themselves (stop n8n start first)
```

`test:e2e` runs the node through n8n's engine and checks the number of real
HTTP calls with Retry On Fail off (1) and on with 3 tries (3).

### Local test setup

1. Put your token in `.env` as `DISCOGS_TOKEN=...` (`.env` is gitignored and
   not published).
2. `node scripts/seed-credential.cjs` imports it into the local n8n as
   "Discogs API (test)" (ID `discogsTestCred01`; re-running overwrites it).
3. Link the package into n8n. On Windows a directory junction leaves other
   linked packages alone:
   `cmd /c mklink /J "%USERPROFILE%\.n8n\custom\node_modules\n8n-nodes-discogs" "<this folder>"`
4. `node test/fixtures/build.cjs` regenerates `test/fixtures/all-operations.json`
   (every operation, spaced by Wait nodes). Run fixtures with the
   n8n-node-builder skill's `scripts/n8n-run.mjs --count-http api.discogs.com`.

If a token was ever shared somewhere it shouldn't be, regenerate it under
Settings > Developers on discogs.com.

## Scope

Read-only on purpose: database lookups and marketplace statistics. Your
collection and wantlist aren't covered yet; reading them would be the next
step, and writes (adding to the wantlist) would need a deliberate decision.

### Releasing

`npm version patch` (or `minor`/`major`), then `git push --follow-tags`. The
tag starts `.github/workflows/publish.yml`, which lints, builds, tests and
publishes to npm with a provenance statement.

## License

MIT

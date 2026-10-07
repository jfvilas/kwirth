# Where scores are stored

The high-scores table is persisted in a Kubernetes **ConfigMap** of the cluster where Kwirth runs,
through Kwirth's channel storage: `kwirth-store-channel-pacman-scores`.

## Content

- **Key**: `pacman-scores`
- **Format**: JSON array of score entries
- **Max entries**: 10, sorted by score, highest first

Each entry:

```json
{
  "name": "player1",
  "score": 12345,
  "level": 3,
  "date": "2026-10-06T12:00:00.000Z"
}
```

## Sanitisation

The back end sanitises every entry it receives, and every entry it reads:

- `name`: control characters removed, trimmed, at most 24 characters, `anon` when empty
- `score`: must be a positive number; it is rounded down
- `level`: a number, rounded down; `0` when missing
- `date`: always set by the back end — a date sent by the browser is ignored

A table that cannot be read is treated as empty, and logged as a warning.

## Shared table

The table is **shared** by every user of the Kwirth instance. There is no per-user or per-tab table.
To reset it, delete the `pacman-scores` key from that ConfigMap.

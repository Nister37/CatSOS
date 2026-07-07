# AI Integration

CAT-080 adds an optional Gemma text-generation adapter. AI is disabled by
default and the app must keep working when the provider is unavailable.

## Configuration

Use environment variables only:

| Variable | Purpose |
| --- | --- |
| `DJANGO_GEMMA_ENABLED` | Enables outbound Gemma calls when `true`. |
| `DJANGO_GEMMA_API_KEY` | Provider API key. Keep this empty in committed files. |
| `DJANGO_GEMMA_API_BASE_URL` | Generate-content API base URL. |
| `DJANGO_GEMMA_MODEL` | Model name used in the generate-content path. |
| `DJANGO_GEMMA_TIMEOUT_SECONDS` | HTTP timeout for provider calls. |
| `DJANGO_GEMMA_TEMPERATURE` | Generation temperature. |
| `DJANGO_GEMMA_MAX_OUTPUT_TOKENS` | Maximum generated output tokens. |

## Behavior

- `generate_gemma_text` returns fallback text when AI is disabled,
misconfigured, times out, returns a bad response, or cannot be reached.
- Provider errors are logged without prompts, API keys, or private contact data.
- The service only sends text supplied by the caller. Callers must strip private
contact details before using this service.
- AI output is untrusted suggestion text and must be reviewed by the user before
being saved.

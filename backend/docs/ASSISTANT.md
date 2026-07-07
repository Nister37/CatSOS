# Found Cat Assistant

CAT-073 defines a static decision tree for the public "I found a cat" assistant.
The backend exposes the tree so the frontend can render the flow without AI.

## API

`GET /api/assistant/found-cat/decision-tree/`

The endpoint is public read-only and returns:

- `id`
- `version`
- `entry_node_id`
- `safety_notice`
- `nodes`

Question nodes include `answers`, and each answer points to the next node by
`next_node_id`. Outcome nodes include final `guidance` text and a `severity`
value.

## Safety Rules

- The tree gives general safety guidance only.
- It does not provide veterinary diagnosis.
- It does not replace a veterinarian, shelter, or emergency service.
- It avoids asking for or returning private owner/contact data.
- It works without AI or external APIs.

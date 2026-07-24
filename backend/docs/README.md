# Swagger path docs (OpenAPI 3 fragments)

These YAML files are merged into `/swagger.json` by `service/swagger.js`.

| File | Audience |
|------|----------|
| `service_web.yaml` | Website OAuth (`/api/web`) — authorize, email code, token |
| `service_app.yaml` | Mobile app (`/api/app`) — authorize, signup, approve/reject |

UI helpers (`/guide`, notify, stats, …) are intentionally omitted. Full flow notes: `../api/service/readme.md`.

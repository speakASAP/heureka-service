# TASK-FEED-010 Single Product Heureka Feed Publish Smoke

Date: 2026-07-01
Owner: Heureka feed smoke / production readiness lane
Status: runtime smoke executed; external Heureka import still processing

## Intent Preservation Chain

Vision: Alfares marketplace channels should publish deterministic, public-safe product feeds without leaking internal data or bulk-exporting more catalog data than needed for validation.

Goal Impact: Heureka should no longer see an empty XML feed; a one-product production smoke proves the feed URL can expose a real `SHOPITEM` before any broader catalog publication.

System: Heureka owns feed inclusion and XML rendering; Catalog owns product identity/content/pricing/media; Warehouse owns stock truth; external Heureka owns import and shop approval.

Feature: Heureka single-product public XML feed smoke.

Task: include exactly one existing Catalog product in `heureka_products`, generate the public Heureka XML feed, and trigger the Heureka UI XML check without exporting the full catalog.

Execution Plan:
- Verify remote repo status before runtime mutation.
- Confirm public feed is initially valid XML with `SHOPITEM=0`.
- Scan Catalog/Warehouse from inside the deployed Heureka pod and select one active product with name, description, image, positive price, and positive Warehouse stock.
- Upsert that product into `heureka_products` with `isIncluded=true`.
- Fetch the local and public feed endpoints and record sanitized metadata only.
- Trigger the Heureka UI internal `Zkontrolovat XML soubor` action and record visible status.

Coding Prompt: no service code change. Runtime DB mutation is limited to one `heureka_products` upsert for one existing Catalog UUID.

Code:
- Source files changed: this evidence document only.
- Runtime data changed: `heureka_products` aggregate moved from `total=0, included=0` to `total=1, included=1`.
- No Catalog, Warehouse, Orders, Leads, Marketing, or other repository code was edited.
- No deploy was run.

Validation:
- `git status --short --branch` before runtime mutation: `## main...origin/main`.
- Candidate scan: Catalog status `200`, scanned products `56`, candidates with image/price/stock `16`, selected one active candidate with stock `25`.
- Runtime DB precheck: `heurekaProductsTotal=0`, `heurekaProductsIncluded=0`, settings active `true`.
- DB mutation: `heureka_products upsert isIncluded=true` for one selected product id; output recorded only as UUID shape.
- Local feed after mutation: HTTP `200`, lifecycle `valid`, `SHOPITEM=1`, required tags present, `IMGURL` present, `MANUFACTURER` present, `EAN` present, `CATEGORYTEXT` absent, XML size `1899` bytes.
- Public feed after mutation: HTTP `200`, no redirect, `application/xml; charset=utf-8`, lifecycle `valid`, snapshot hash present, `SHOPITEM=1`, required tags present, no sensitive internal tags detected, XML size `1899` bytes.
- Contract verifier: `node scripts/verify_heureka_order_ingestion_contract.js` passed.
- Repo status after runtime mutation and before this doc: `## main...origin/main`.

External Heureka UI:
- `/shops` initially showed `Zatim neimportovan`, `Chyba XML souboru`, and `0 / 0`.
- Internal `Zkontrolovat XML soubor` was clicked in the authenticated Heureka UI.
- After refresh, `/shops` showed `Kontrola XML souboru...`, proving Heureka accepted the check request.
- `/feed-validity` still showed `Nepodarilo se nacist data`, `Obchod je zablokovan`, and `Celkem produktu:0` while the shop remains new/pending.

Open facts:
- `[UNKNOWN: when external Heureka import check will finish]`
- `[UNKNOWN: whether Heureka shop approval must complete before feed validity details update]`
- `[MISSING: Catalog category mapping for CATEGORYTEXT]`

Next step: Recheck Heureka UI after the external XML check finishes, then decide whether the next blocker is shop approval or Catalog category mapping.

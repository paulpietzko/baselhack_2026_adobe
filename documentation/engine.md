# The intent-to-experience engine

Early-stage backbone of the prototype. It takes what someone wants, plus what they've already decided, and produces the next thing to show them, built from facts a business published.

The code is in [`code/engine`](../code/engine) (pure TypeScript, no React) and [`code/server`](../code/server). The same engine runs in the browser, so the experience responds instantly, and on the server, where other agents can use it.

```
Owner edits and publishes        /vendor → POST /api/business
        │
        ▼
Published record                 engine/business.ts, server/business.ts
        │
        ▼
World graph (shared)             engine/world.ts
Entities and relationships, each labelled owner, curated or inferred
        │
        ├──────────► Outside agents: POST /mcp (server/mcp.ts)
        ▼
Intent resolver                  engine/intent.ts
Rules first, a model only for what they miss, and its answer is validated
        │
        ▼
Journey (personal, temporary)    engine/journey.ts
Occasion, floor, outfit, budget, vibe, tickets: carried across businesses
        │
        ▼
Composer                         engine/compose.ts
Journey + world → a bounded ExperienceSpec
        │
        ▼
Renderer                         code/src/components/tonight
Draws whatever the spec asks for: map, 3D venue, tiles
```

## The ideas it tests

**Two graphs.** The world graph is shared: a club hosts an event, the event has a dress code, an outfit satisfies it, a shop sells the outfit. The journey is personal and disposable. "No fixed paths" doesn't mean no stable facts. It means the route through them isn't decided by one publisher's page hierarchy.

**Crossing businesses is a graph traversal.** Dress code → outfit → shop works because `pathBetween` can walk it. The `satisfies` edge is computed from the owner's own words by `dressCheck`, so if the owner publishes "Capes mandatory", the graph changes and the outfits that no longer qualify are flagged for the guest.

**Provenance on everything.** Every entity and edge is labelled `owner` (published and approved by the business), `curated` (hand-written for this demo) or `inferred` (computed here).

**A bounded composer.** It chooses from fixed views and primitives rather than generating interface code, so the result is always drawable and every fact is sourced.

**Models can't act.** `validateModelIntent` is an allowlist that leaves out `book` and `reserve` and rejects made-up ids. Reservations only come from a person pressing a button, and the store still checks availability. Prices are looked up on the server, so a caller can't name its own.

**Ranking has no input for promotion.** `rank` matches what was asked against what a place is, and returns its reasons. Being verified breaks ties but is worth less than one real match, and there's no parameter for what a business wants to push.

## What's real and what isn't

| Part | Status |
|---|---|
| Publish from `/vendor` to a store the agent and guest read | Works |
| Owner edit changing replies, tiles and the outfit door check | Works, tested |
| Availability check and reservation with a confirmation reference, refusing overbooking | Works, tested. In memory: resets when the server restarts |
| World graph, journey, composer and ranking | Works. The UI renders from the composer's spec |
| MCP endpoint at `/mcp` with five tools | Works, tested with the official MCP SDK client. Local dev server only, and a subset of the protocol: stateless JSON, tools only |
| OpenAI agent discovery (`server/agent.ts`) | Written, **only runs with `OPENAI_API_KEY`**. Without one the UI says "No model connected" and the engine's ranking is used |
| Model fallback for intent (`server/experience.ts`) | The logic is tested with a fake model. **The OpenAI call itself hasn't been run** |
| Rule-based intent matching | Works, but it's keyword matching, so it only understands what its rules cover |
| Reading the dress code | Simple patterns ("No X", "X mandatory"). Anything else lets people through rather than inventing a rule |
| Shops, outfits, casino, DJs, weather, other listings | Curated and fictional, labelled `curated` in the graph |
| Holding articles at a store, with stock that can run out | Works, tested. In memory, and the shops are fictional |
| Casino booking | Not implemented. The UI says so |
| Music | Generated in the browser, not real previews |

## Not solved yet

- **Federation:** there's one store and one club. A real world graph would combine many sources.
- **Identity and trust:** "owner verified" is a label here, with no proof that the publisher owns the business. Provenance needs signing.
- **Owner intent:** the owner can correct facts, but can't yet state a goal like "reach groups who enjoy electronic music". It should shape presentation, never truth or ranking.
- **The composer's vocabulary:** new primitives are added by hand. Letting a model choose among them is the next experiment, since it's already bounded and validated.
- **Persistence:** everything lives in memory.

## Try it

```
cd code
npm test        # engine and MCP tests, no key or network needed
npm run dev
```

Ask the engine directly while the dev server runs:

```
curl -X POST localhost:8443/api/experience -d '{"text":"Now find us a casino","session":{"scene":"outfit","outfit":"vampire","floor":"main-hall"}}'
```

Or call it as an agent would:

```
curl -X POST localhost:8443/mcp -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_experiences","arguments":{"query":"party tonight"}}}'
```

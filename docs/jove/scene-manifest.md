# Jove V1 Scene Manifest

This manifest gives stable semantic names to the approved visual vocabulary. Names may be adapted to existing repository conventions, but behavior should remain equivalent.

## Modes

```ts
type JoveMode =
  | "neutral"
  | "engaged"
  | "curious"
  | "uncertain"
  | "skeptical"
  | "pleased";
```

## Core poses

```ts
type JovePose =
  | "stand"
  | "edge-sit"
  | "think"
  | "peek"
  | "crawl"
  | "climb"
  | "push"
  | "pull"
  | "carry"
  | "balance"
  | "rest"
  | "tangled";
```

## Approved chat scenes

| Scene ID | Intended state | Visual behavior |
| --- | --- | --- |
| `chat-composer-listen` | User is composing or recording | Jove leans on the composer and attends to it |
| `chat-message-inspect` | A user message is present | Jove stands beside and reads the bubble |
| `chat-response-think` | Assistant response is generating | Jove thinks beside the existing loading treatment |
| `chat-response-peek` | A response has appeared | Jove peeks over the assistant bubble |
| `chat-connect` | Product presents a meaningful relationship | Jove holds a subtle thread between two bubbles |
| `chat-settled` | Conversation is resting | Jove sits quietly on a bubble edge |

## Initial implementation scope

Implement in this order:

1. `neutral` + `stand`
2. `curious` + `peek`
3. `uncertain` + `think`
4. `chat-response-think`

Do not implement the full pose or scene inventory before the first real chat scene is approved in the application.

## Not yet approved

Manual, Checkpoint, empty, inactivity, return, and system-error scenes are not part of the current approved V1 source. They require future review and must not be invented during initial implementation.

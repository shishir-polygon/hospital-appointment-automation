# /workflow — AI Doctor Booking Workflow Skill

Run a full multi-agent conversation turn for the AI Doctor Booking platform.

## Usage
```
/workflow <user_message> [--session <id>] [--lang <bn|en|hi>]
```

## What This Does

1. Passes `$ARGUMENTS` to the **SuperAgent** (@.claude/agents/super_agent.md)
2. SuperAgent classifies intent and routes to the correct specialist
3. Specialist agent responds
4. Returns the response + routing trace

## Execution Steps

**Step 1 — Load Super Agent**
Read @.claude/agents/super_agent.md and classify the user message in `$ARGUMENTS`.

**Step 2 — Route**
Based on classification, load the appropriate agent:
- Booking intent → @.claude/agents/booking_agent.md
- Queue intent → @.claude/agents/queue_agent.md
- Doctor info intent → @.claude/agents/doctor_info_agent.md
- General/unknown → @.claude/agents/general_agent.md

**Step 3 — Execute**
Run the specialist agent with the user's message and return its response.

**Step 4 — Show Trace**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔀 SuperAgent → [specialist_agent]
📝 Intent: [classified intent]
🌐 Language: [detected]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Agent Response]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Example

```
/workflow আনোয়ার স্যারের কাছে আগামীকাল সকালে অ্যাপয়েন্টমেন্ট নিতে চাই
```

Expected trace:
```
SuperAgent → booking_agent
Intent: book_appointment
Language: bn
```

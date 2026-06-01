# /super-agent — Invoke the Super Agent

Invoke the SuperAgent directly for a single routing decision.

## Usage
```
/super-agent <user_message>
```

Read @.claude/agents/super_agent.md, apply it to `$ARGUMENTS`, classify the intent, and show the routing decision with a brief explanation.

Output format:
```
Intent:   <classified>
Language: <detected>
Route to: <agent_name>
Reason:   <why this agent>
```

Then invoke the routed agent from `.claude/agents/` and return its response.

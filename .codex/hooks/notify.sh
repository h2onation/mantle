#!/bin/bash
# Desktop notification hook for macOS
# Used for: permission prompts (waiting for input) and task completion

INPUT=$(cat)
EVENT=$(echo "$INPUT" | jq -r '.hook_event_name // empty')
NOTIFICATION_TYPE=$(echo "$INPUT" | jq -r '.notification_type // empty')

case "$NOTIFICATION_TYPE" in
  permission_prompt)
    osascript -e 'display notification "Claude is waiting for your approval" with title "mywalnut — Input Needed" sound name "Ping"' 2>/dev/null
    ;;
  idle_prompt)
    osascript -e 'display notification "Claude is waiting for your input" with title "mywalnut — Your Turn" sound name "Ping"' 2>/dev/null
    ;;
  *)
    # For Stop event (task completion)
    if [ "$EVENT" = "Stop" ] || [ -z "$NOTIFICATION_TYPE" ]; then
      osascript -e 'display notification "Claude has finished the current task" with title "mywalnut — Task Complete" sound name "Glass"' 2>/dev/null
    fi
    ;;
esac

exit 0

import { Icon } from "./Icon";
import type { GestureState, IntentResult, VisualEntry } from "../types";

type TeacherAssistantProps = {
  visual: VisualEntry;
  gesture: GestureState;
  lastIntent: IntentResult | null;
  onSubmitCommand?: (command: string) => void;
  processing?: boolean;
};

export function TeacherAssistant({
  visual,
  onSubmitCommand,
  processing = false,
}: TeacherAssistantProps) {
  return (
    <div className="assistant-hints">
      <span className="assistant-hints-label">
        <Icon name="command" size={15} />
        Try a command
      </span>
      <div
        className="assistant-prompts"
        role="group"
        aria-label="Suggested commands"
      >
        {visual.teacherPrompts.slice(0, 3).map((prompt) =>
          onSubmitCommand ? (
            <button
              className="suggestion-chip"
              type="button"
              key={prompt}
              onClick={() => onSubmitCommand(prompt)}
              disabled={processing}
            >
              {prompt}
              <Icon name="arrow-right" size={13} />
            </button>
          ) : (
            <span className="suggestion-chip" key={prompt}>
              {prompt}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

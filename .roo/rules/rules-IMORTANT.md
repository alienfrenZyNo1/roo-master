🧠 Rule: KISS (Keep It Simple, Stupid)
Trigger: Anytime code is being written or refactored
Rule:

Keep code as simple and clear as possible.
Avoid clever hacks, deep nesting, or overengineering.
If it looks confusing, rewrite it simpler.

🧠 Rule: SSOT (Single Source of Truth)
Trigger: When defining values like enums, constants, configs, or validation logic
Rule:

Define shared values in one file only.
Import and use them elsewhere — never duplicate.
Changing a value should require changing it in one place.

"""
CLI Bridge for CareerForge Python AI Engine
===========================================
Allows direct execution of the Python cognitive assistant via CLI or Node.js child_process.
Reads JSON payload from argv[1] or standard input, writes JSON response to standard output.
"""

import sys
import os
import json

# Ensure python_ai is on path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from engine import ai_assistant


def main():
    try:
        try:
            sys.stdout.reconfigure(encoding="utf-8")
            sys.stdin.reconfigure(encoding="utf-8")
        except Exception:
            pass

        raw_input = ""
        if len(sys.argv) > 1 and sys.argv[1].strip():
            raw_input = sys.argv[1]
        else:
            raw_input = sys.stdin.read()

        if not raw_input or not raw_input.strip():
            sys.stderr.write("Error: No input JSON provided to run_cli.py\n")
            sys.exit(1)

        payload = json.loads(raw_input)
        messages = payload.get("messages", [])
        user_profile = payload.get("userProfile")
        target_role = payload.get("targetRole")
        voice_mode = bool(payload.get("voiceMode", False))
        current_page = payload.get("currentPage", "assistant")
        current_entity = payload.get("currentEntity")
        accessibility_prefs = payload.get("accessibilityPrefs")

        result = ai_assistant.process_chat(
            messages=messages,
            user_profile=user_profile,
            target_role=target_role,
            voice_mode=voice_mode,
            current_page=current_page,
            current_entity=current_entity,
            accessibility_prefs=accessibility_prefs,
        )

        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        sys.stdout.flush()
    except Exception as e:
        err_res = {
            "reply": "I am dynamically processing your career goals. How can I assist you right now?",
            "thinking": [f"CLI Bridge encountered an issue: {str(e)}"],
            "engine": "CareerForge Python AI Brain (CLI)",
            "suggestions": ["Review resume", "Explore roadmap", "Practice interview"],
        }
        sys.stdout.write(json.dumps(err_res))
        sys.stdout.flush()


if __name__ == "__main__":
    main()

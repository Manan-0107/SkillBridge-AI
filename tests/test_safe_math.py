"""
tests/test_safe_math.py
=======================
Security and functional test suite for the restricted safe arithmetic parser.
Verifies rejection of eval(), code injection, resource exhaustion (DoS), and valid math evaluation.
"""

import sys
import os

# Ensure python_ai is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "python_ai")))

from safe_math import evaluate_safe_math, SafeMathEvaluator, SafeMathError


def test_valid_arithmetic():
    valid_cases = [
        ("2+2", 4),
        ("10*5", 50),
        ("(4+6)*2", 20),
        ("2**8", 256),
        ("10/2", 5),
        ("10%3", 1),
        ("2^8", 256),
        ("-5 + 10", 5),
        ("-(4 + 6)", -10),
        ("1.5 * 4", 6),
        ("2 ** 3 ** 2", 512),  # right-associative: 2 ** 9 = 512
        ("100 / 4 / 5", 5),    # left-associative: (100 / 4) / 5 = 5
    ]

    for expr, expected in valid_cases:
        ok, res, msg = evaluate_safe_math(expr)
        assert ok, f"Failed valid expression '{expr}': {msg}"
        assert res == expected, f"Mismatch on '{expr}': got {res}, expected {expected}"
    print("PASS: test_valid_arithmetic")


def test_invalid_syntax_and_code_injection():
    malicious_cases = [
        "import os",
        "__import__('os')",
        "().__class__",
        "open('/etc/passwd')",
        "__builtins__",
        "eval('2+2')",
        "exec('print(1)')",
        "lambda x: x",
        "os.system('id')",
        "foo.bar",
        "func()",
        "x + y",
        "[1, 2, 3]",
        "{'a': 1}",
        "True",
        "None",
        "2; import os",
        "`ls`",
        "${PATH}",
    ]

    for expr in malicious_cases:
        ok, res, msg = evaluate_safe_math(expr)
        assert not ok, f"Security violation: expression '{expr}' should be rejected! Got: {res}"
        assert res is None
    print("PASS: test_invalid_syntax_and_code_injection")


def test_resource_exhaustion_and_dos_protection():
    dos_cases = [
        # Zero division
        ("1/0", "Division by zero"),
        ("5%0", "Modulo by zero"),
        # Catastrophic exponents
        ("9**999999", "exceeds safe maximum"),
        ("9**9**9**9", "exceeds safe maximum"),
        ("2**101", "exceeds safe maximum"),
        # Excessive literal length (>15 digits)
        ("12345678901234567890", "exceeds maximum length"),
        # Deep nesting (>10 levels)
        ("(((((((((((1)))))))))))", "Nesting depth exceeds maximum"),
        # Excessive length (>256 characters)
        ("1+" * 200 + "1", "exceeds maximum length"),
        # Excessive operations (>50 ops)
        ("+".join(["1"] * 60), "exceeds maximum permitted operations"),
    ]

    for expr, expected_error_fragment in dos_cases:
        ok, res, msg = evaluate_safe_math(expr)
        assert not ok, f"DoS guard failure: '{expr[:30]}...' should be rejected!"
        assert expected_error_fragment.lower() in msg.lower(), f"Error message '{msg}' did not contain '{expected_error_fragment}'"
    print("PASS: test_resource_exhaustion_and_dos_protection")


if __name__ == "__main__":
    test_valid_arithmetic()
    test_invalid_syntax_and_code_injection()
    test_resource_exhaustion_and_dos_protection()
    print("\nALL SAFE MATH TESTS PASSED SUCCESSFULLY!")

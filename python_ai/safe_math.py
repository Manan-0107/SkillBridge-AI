"""
python_ai/safe_math.py
======================
Restricted, secure arithmetic parser for MCP Math & Science Reasoning.
Completely eliminates eval(), exec(), and compile().

Guaranteed Invariants:
1. Pure AST / recursive-descent token evaluation with zero dynamic code execution.
2. No attribute access, no variable lookups, no function invocations, no imports.
3. Strict bounded resource limits:
   - Max expression length: 256 characters
   - Max numeric literal length: 15 digits
   - Max nesting depth: 10 levels
   - Max operation count: 50 operations
   - Max exponent: 100 (guards against 9**9**9**9 denial of service)
   - Guarded division by zero and float overflow
"""

import math
from typing import Tuple, List, Union

MAX_EXPRESSION_LENGTH = 256
MAX_LITERAL_LENGTH = 15
MAX_NESTING_DEPTH = 10
MAX_OPERATIONS = 50
MAX_EXPONENT = 100
MAX_MAGNITUDE = 1e100


class SafeMathError(Exception):
    """Base error for safe arithmetic parser failures."""
    pass


class SafeMathEvaluator:
    def __init__(self, expression: str):
        if not expression or not isinstance(expression, str):
            raise SafeMathError("Empty or invalid expression")
        if len(expression) > MAX_EXPRESSION_LENGTH:
            raise SafeMathError(f"Expression exceeds maximum length of {MAX_EXPRESSION_LENGTH} characters")

        self.raw = expression
        self.tokens: List[Tuple[str, Union[float, int, str]]] = []
        self.pos = 0
        self.op_count = 0
        self.depth = 0

    def tokenize(self):
        s = self.raw
        i = 0
        n = len(s)

        while i < n:
            ch = s[i]

            if ch.isspace():
                i += 1
                continue

            # Multi-character operators
            if i + 1 < n and s[i:i+2] == "**":
                self.tokens.append(("OP", "**"))
                i += 2
                continue

            if ch in "+-*/%":
                self.tokens.append(("OP", ch))
                i += 1
                continue

            if ch in "()":
                self.tokens.append(("PAREN", ch))
                i += 1
                continue

            # Caret ^ alias for exponentiation
            if ch == "^":
                self.tokens.append(("OP", "**"))
                i += 1
                continue

            # Numeric literal
            if ch.isdigit() or ch == ".":
                start = i
                has_dot = (ch == ".")
                while i + 1 < n and (s[i+1].isdigit() or (s[i+1] == "." and not has_dot)):
                    if s[i+1] == ".":
                        has_dot = True
                    i += 1

                literal = s[start:i+1]
                if len(literal) > MAX_LITERAL_LENGTH:
                    raise SafeMathError(f"Numeric literal exceeds maximum length of {MAX_LITERAL_LENGTH} digits")

                try:
                    num_val = float(literal) if has_dot else int(literal)
                except ValueError:
                    raise SafeMathError(f"Invalid numeric literal: {literal}")

                self.tokens.append(("NUM", num_val))
                i += 1
                continue

            # Any other character (letters, underscores, quotes, brackets, etc.) is rejected
            raise SafeMathError(f"Unauthorized character or token: '{ch}'")

    def current_token(self):
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return ("EOF", "")

    def consume(self, expected_type=None, expected_val=None):
        tok = self.current_token()
        if expected_type and tok[0] != expected_type:
            raise SafeMathError(f"Expected {expected_type}, got {tok[0]}")
        if expected_val and tok[1] != expected_val:
            raise SafeMathError(f"Expected '{expected_val}', got '{tok[1]}'")
        self.pos += 1
        return tok

    def record_op(self):
        self.op_count += 1
        if self.op_count > MAX_OPERATIONS:
            raise SafeMathError(f"Expression exceeds maximum permitted operations ({MAX_OPERATIONS})")

    # Grammar Rules
    def parse_expr(self) -> Union[int, float]:
        val = self.parse_term()
        while self.current_token()[0] == "OP" and self.current_token()[1] in ("+", "-"):
            op = self.consume()[1]
            self.record_op()
            right = self.parse_term()
            if op == "+":
                val = val + right
            else:
                val = val - right
            self.check_bounds(val)
        return val

    def parse_term(self) -> Union[int, float]:
        val = self.parse_power()
        while self.current_token()[0] == "OP" and self.current_token()[1] in ("*", "/", "%"):
            op = self.consume()[1]
            self.record_op()
            right = self.parse_power()
            if op == "*":
                val = val * right
            elif op == "/":
                if right == 0:
                    raise SafeMathError("Division by zero")
                val = val / right
            elif op == "%":
                if right == 0:
                    raise SafeMathError("Modulo by zero")
                val = val % right
            self.check_bounds(val)
        return val

    def parse_power(self) -> Union[int, float]:
        base = self.parse_unary()
        if self.current_token()[0] == "OP" and self.current_token()[1] == "**":
            self.consume()
            self.record_op()
            # Right-associative exponentiation
            exp = self.parse_power()

            # Prevent catastrophic big-int DoS (e.g. 9**9**9**9 or 2**1000000)
            if abs(exp) > MAX_EXPONENT:
                raise SafeMathError(f"Exponent magnitude {exp} exceeds safe maximum of {MAX_EXPONENT}")

            if abs(base) > 1e4 and exp > 20:
                raise SafeMathError("Computation exceeds safe power threshold")

            try:
                val = base ** exp
            except OverflowError:
                raise SafeMathError("Arithmetic overflow during exponentiation")

            self.check_bounds(val)
            return val
        return base

    def parse_unary(self) -> Union[int, float]:
        if self.current_token()[0] == "OP" and self.current_token()[1] in ("+", "-"):
            op = self.consume()[1]
            self.record_op()
            sub = self.parse_unary()
            return sub if op == "+" else -sub
        return self.parse_primary()

    def parse_primary(self) -> Union[int, float]:
        tok = self.current_token()
        if tok[0] == "NUM":
            self.consume()
            return tok[1]

        if tok[0] == "PAREN" and tok[1] == "(":
            self.depth += 1
            if self.depth > MAX_NESTING_DEPTH:
                raise SafeMathError(f"Nesting depth exceeds maximum allowed of {MAX_NESTING_DEPTH}")
            self.consume("PAREN", "(")
            val = self.parse_expr()
            self.consume("PAREN", ")")
            self.depth -= 1
            return val

        raise SafeMathError(f"Unexpected token: {tok[1]}")

    def check_bounds(self, val: Union[int, float]):
        if isinstance(val, complex):
            raise SafeMathError("Complex numbers not supported")
        if math.isnan(val) or math.isinf(val) or abs(val) > MAX_MAGNITUDE:
            raise SafeMathError("Calculated value exceeds safe numeric bounds")

    def evaluate(self) -> Union[int, float]:
        self.tokenize()
        if not self.tokens:
            raise SafeMathError("No evaluatable tokens found")
        result = self.parse_expr()
        if self.pos < len(self.tokens):
            raise SafeMathError(f"Unexpected trailing tokens: {self.tokens[self.pos:]}")
        # Clean up integer floats (e.g. 4.0 -> 4)
        if isinstance(result, float) and result.is_integer():
            return int(result)
        return result


def evaluate_safe_math(expression: str) -> Tuple[bool, Union[int, float, None], str]:
    """
    Safely evaluates an arithmetic expression with strict bounds.
    Returns: (success: bool, result: Optional[numeric], message: str)
    """
    try:
        evaluator = SafeMathEvaluator(expression)
        ans = evaluator.evaluate()
        return True, ans, "Success"
    except SafeMathError as e:
        return False, None, str(e)
    except Exception as e:
        return False, None, f"Evaluation error: {type(e).__name__}"

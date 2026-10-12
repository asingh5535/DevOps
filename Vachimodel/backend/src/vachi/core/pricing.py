"""Model prices and cost calculation.

Prices come from the `pricing:` section of vachi.yaml, so they stay correct when
providers change them. Patterns use shell-style wildcards and are matched against
"provider/model"; the first matching pattern wins:

    pricing:
      "anthropic/claude-opus-5-5": {input: 4.00, output: 20.00}
      "local/*": {input: 0, output: 0}
"""

from __future__ import annotations

from fnmatch import fnmatchcase

from vachi.core.config import Price
from vachi.core.messages import Usage

TOKENS_PER_PRICE_UNIT = 1_000_000


class Pricing:
    def __init__(self, rules: dict[str, Price]):
        self._rules = list(rules.items())

    def price(self, model_ref: str) -> Price | None:
        """Price for a model, or None if no pattern matches (cost unknown)."""
        for pattern, price in self._rules:
            if fnmatchcase(model_ref, pattern):
                return price
        return None

    def is_free(self, model_ref: str) -> bool:
        price = self.price(model_ref)
        return price is not None and price.input == 0 and price.output == 0

    def cost(self, model_ref: str, usage: Usage | None) -> float | None:
        """Cost in US dollars, or None when the price or the token counts are unknown."""
        price = self.price(model_ref)
        if price is None or usage is None:
            return None
        return (usage.input_tokens * price.input + usage.output_tokens * price.output) / TOKENS_PER_PRICE_UNIT

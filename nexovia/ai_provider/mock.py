"""Deterministic mock provider used until real API keys are wired in."""
from typing import Iterator, Optional, Sequence

from .base import AIProvider, AIResponse, Message


class MockProvider(AIProvider):
    name = "mock"
    model = "mock-1"

    def _reply(self, prompt: str, system: Optional[str]) -> str:
        topic = (prompt or "").strip().rstrip("?.! ") or "your question"
        return (
            f"Here's a quick way to approach \"{topic}\": break it into smaller ideas, "
            "explain each one in your own words, then test yourself with a practice question."
        )

    def complete(self, prompt: str, *, system: Optional[str] = None,
                 history: Sequence[Message] = (), **options) -> AIResponse:
        text = self._reply(prompt, system)
        return AIResponse(text=text, provider=self.name, model=self.model,
                          usage={"input_words": len(prompt.split()), "output_words": len(text.split())})

    def stream(self, prompt: str, *, system: Optional[str] = None,
               history: Sequence[Message] = (), **options) -> Iterator[str]:
        for word in self._reply(prompt, system).split(" "):
            yield word + " "

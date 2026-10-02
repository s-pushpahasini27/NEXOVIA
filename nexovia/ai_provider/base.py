"""Provider-agnostic AI interface. Call sites depend on this, never on a vendor SDK."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Iterator, Optional, Sequence


@dataclass
class Message:
    role: str  # "user" | "assistant"
    content: str


@dataclass
class AIResponse:
    text: str
    provider: str
    model: str
    usage: dict = field(default_factory=dict)


class AIProvider(ABC):
    name = "base"
    model = "unknown"

    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}

    @abstractmethod
    def complete(self, prompt: str, *, system: Optional[str] = None,
                 history: Sequence[Message] = (), **options) -> AIResponse:
        """Return a full response."""

    @abstractmethod
    def stream(self, prompt: str, *, system: Optional[str] = None,
               history: Sequence[Message] = (), **options) -> Iterator[str]:
        """Yield response text chunks."""

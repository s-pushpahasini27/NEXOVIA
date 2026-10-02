"""Groq chat-completions adapter for the existing provider interface."""
import json
from typing import Iterator, Optional, Sequence
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .base import AIProvider, AIResponse, Message


class GroqError(RuntimeError):
    """A safe, user-facing Groq configuration or service error."""


class GroqProvider(AIProvider):
    name = "groq"
    model = "llama-3.3-70b-versatile"
    endpoint = "https://api.groq.com/openai/v1/chat/completions"

    def complete(self, prompt: str, *, system: Optional[str] = None,
                 history: Sequence[Message] = (), **options) -> AIResponse:
        key = self.config.get("api_key", "")
        if not key:
            raise GroqError("Groq is not configured. Set GROQ_API_KEY on the server.")
        model = self.config.get("model") or self.model
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.extend({"role": m.role, "content": m.content} for m in history)
        messages.append({"role": "user", "content": prompt})
        payload = json.dumps({"model": model, "messages": messages,
                              "max_completion_tokens": options.get("max_completion_tokens", 100),
                              "temperature": options.get("temperature", 0.4)}).encode("utf-8")
        req = Request(self.endpoint, data=payload, method="POST", headers={
            "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        })
        try:
            with urlopen(req, timeout=12) as response:
                result = json.load(response)
        except HTTPError as exc:
            if exc.code in (401, 403):
                raise GroqError("Groq rejected the API key or model access.") from exc
            if exc.code == 429:
                raise GroqError("Groq is rate-limited. Please try again shortly.") from exc
            raise GroqError("Groq could not generate a tip right now.") from exc
        except (URLError, TimeoutError, OSError) as exc:
            raise GroqError("Groq is temporarily unreachable. Please try again.") from exc
        try:
            answer = result["choices"][0]["message"]["content"].strip()
            if not answer:
                raise ValueError("Empty response")
        except (KeyError, IndexError, TypeError, AttributeError, ValueError) as exc:
            raise GroqError("Groq returned an empty tip. Please try again.") from exc
        return AIResponse(text=answer, provider=self.name, model=model,
                          usage=result.get("usage", {}))

    def stream(self, prompt: str, *, system: Optional[str] = None,
               history: Sequence[Message] = (), **options) -> Iterator[str]:
        yield self.complete(prompt, system=system, history=history, **options).text

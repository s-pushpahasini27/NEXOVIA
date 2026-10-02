"""Provider registry. Adding OpenAI / Gemini / Claude later = one adapter file + one line here."""
import importlib

from .base import AIProvider, AIResponse, Message

# name -> "module:Class" (lazy, so missing vendor SDKs never break startup)
PROVIDERS = {
    "mock": "nexovia.ai_provider.mock:MockProvider",
    "groq": "nexovia.ai_provider.groq_provider:GroqProvider",
    # "openai": "nexovia.ai_provider.openai_provider:OpenAIProvider",
    # "gemini": "nexovia.ai_provider.gemini_provider:GeminiProvider",
    # "claude": "nexovia.ai_provider.claude_provider:ClaudeProvider",
}

_instances = {}


def get_provider(name: str = "mock", config: dict = None) -> AIProvider:
    if name not in PROVIDERS:
        raise ValueError(f"Unknown AI provider '{name}'. Available: {', '.join(PROVIDERS)}")
    if config is not None:
        module_path, cls_name = PROVIDERS[name].split(":")
        cls = getattr(importlib.import_module(module_path), cls_name)
        return cls(config)
    if name not in _instances:
        module_path, cls_name = PROVIDERS[name].split(":")
        cls = getattr(importlib.import_module(module_path), cls_name)
        _instances[name] = cls(config)
    return _instances[name]


def current_provider() -> AIProvider:
    """Provider selected by the AI_PROVIDER config value. Use this at call sites."""
    from flask import current_app
    return get_provider(current_app.config["AI_PROVIDER"], {
        "api_key": current_app.config.get("GROQ_API_KEY", ""),
        "model": current_app.config.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
    })


__all__ = ["AIProvider", "AIResponse", "Message", "get_provider", "current_provider", "PROVIDERS"]

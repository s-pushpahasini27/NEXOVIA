"""Small server-only Gemini client with strict output validation helpers."""
import json
import os
import re
import httpx

def enabled():
    return bool(os.getenv('GEMINI_API_KEY', '').strip())

def model():
    return os.getenv('GEMINI_MODEL', 'gemini-2.5-flash').strip() or 'gemini-2.5-flash'

def _text(payload):
    try:
        parts = payload['candidates'][0]['content']['parts']
        value = ''.join(str(part.get('text', '')) for part in parts).strip()
        if not value:
            raise ValueError
        return value
    except (KeyError, IndexError, TypeError, ValueError):
        raise RuntimeError('Gemini returned an empty response.')

def generate(system, prompt, *, json_mode=False):
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if not key:
        raise RuntimeError('Gemini is not configured.')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{model()}:generateContent'
    body = {
        'systemInstruction': {'parts': [{'text': system[:12000]}]},
        'contents': [{'role': 'user', 'parts': [{'text': prompt[:30000]}]}],
        'generationConfig': {
            'temperature': 0.35,
            'maxOutputTokens': 4096,
            **({'responseMimeType': 'application/json'} if json_mode else {}),
        },
    }
    try:
        with httpx.Client(timeout=25) as client:
            response = client.post(url, params={'key': key}, json=body)
        if response.status_code in (401, 403):
            raise RuntimeError('Gemini rejected the API key. Check GEMINI_API_KEY and restart Nexovia.')
        if response.status_code == 429:
            raise RuntimeError('Gemini usage is temporarily limited. Try again shortly.')
        response.raise_for_status()
        return _text(response.json())
    except httpx.TimeoutException:
        raise RuntimeError('Gemini took too long to respond. Try again.')
    except httpx.HTTPError as exc:
        raise RuntimeError('Gemini is temporarily unavailable.') from exc

def generate_json(system, prompt):
    raw = generate(system, prompt, json_mode=True)
    raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip(), flags=re.I)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError('Gemini returned an invalid structured response.') from exc

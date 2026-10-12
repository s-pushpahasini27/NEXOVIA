"""Small server-only Gemini client with strict output validation helpers."""
import json
import base64
import os
import re
from io import BytesIO
import httpx
from PIL import Image

def enabled():
    return bool(os.getenv('GEMINI_API_KEY', '').strip())

def model():
    return os.getenv('GEMINI_MODEL', 'gemini-2.5-flash').strip() or 'gemini-2.5-flash'

def _text(payload):
    try:
        if payload['candidates'][0].get('finishReason') != 'STOP':
            raise RuntimeError('Gemini could not finish this response. Try a smaller request.')
        parts = payload['candidates'][0]['content']['parts']
        value = ''.join(str(part.get('text', '')) for part in parts if not part.get('thought')).strip()
        if not value:
            raise ValueError
        return value
    except (KeyError, IndexError, TypeError, ValueError):
        raise RuntimeError('Gemini returned an empty response.')

def _request(body, selected_model):
    key = os.getenv('GEMINI_API_KEY', '').strip()
    if not key:
        raise RuntimeError('AI is not configured. Set GEMINI_API_KEY on the server. No sample answer was substituted.')
    if not re.fullmatch(r'[a-zA-Z0-9._-]+', selected_model):
        raise RuntimeError('Invalid Gemini model configuration.')
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{selected_model}:generateContent'
    try:
        with httpx.Client(timeout=httpx.Timeout(90, connect=10)) as client:
            response = client.post(url, headers={'x-goog-api-key': key}, json=body)
        if response.status_code in (401, 403):
            raise RuntimeError('Gemini rejected the API key or model access. Check the server configuration.')
        if response.status_code == 429:
            raise RuntimeError('Gemini usage is temporarily limited. Try again shortly.')
        if response.status_code == 404:
            raise RuntimeError('The configured Gemini model is unavailable. Check the model name and account access.')
        if response.status_code == 400:
            raise RuntimeError('Gemini rejected this request. Check model capabilities and input size.')
        response.raise_for_status()
        payload = response.json()
        if payload.get('promptFeedback', {}).get('blockReason'):
            raise RuntimeError('Gemini blocked this request. Rephrase your study question.')
        return payload
    except httpx.TimeoutException:
        raise RuntimeError('Gemini took too long to respond. Try again.')
    except httpx.HTTPError as exc:
        raise RuntimeError('Gemini is temporarily unavailable.') from exc
    except (ValueError, TypeError) as exc:
        raise RuntimeError('Gemini returned an invalid response.') from exc

def generate(system, prompt, *, json_mode=False, attachment=None, schema=None):
    if len(system) > 12000 or len(prompt) > 60000:
        raise ValueError('This AI request is too large. Select a smaller set of notes.')
    parts = [{'text': prompt}]
    if attachment:
        mime, content = attachment
        if len(content) > 10 * 1024 * 1024:
            raise ValueError('AI attachments are limited to 10 MB.')
        parts.append({'inlineData': {'mimeType': mime, 'data': base64.b64encode(content).decode('ascii')}})
    body = {
        'systemInstruction': {'parts': [{'text': system}]},
        'contents': [{'role': 'user', 'parts': parts}],
        'generationConfig': {
            'temperature': 0.35,
            'maxOutputTokens': 8192,
            **({'responseMimeType': 'application/json'} if json_mode else {}),
            **({'responseSchema': schema} if schema else {}),
        },
    }
    return _text(_request(body, model()))

def generate_json(system, prompt, **kwargs):
    raw = generate(system, prompt, json_mode=True, **kwargs)
    raw = re.sub(r'^```(?:json)?\s*|\s*```$', '', raw.strip(), flags=re.I)
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError('Gemini returned an invalid structured response.') from exc

def image(prompt):
    selected = os.getenv('GEMINI_IMAGE_MODEL', '').strip()
    if not selected:
        raise RuntimeError('Study image generation requires GEMINI_IMAGE_MODEL and account access. No image was substituted.')
    body = {'contents':[{'role':'user','parts':[{'text':'Create an educational study illustration. Follow this study brief: ' + prompt}]}],
            'generationConfig':{'responseModalities':['TEXT','IMAGE']}}
    result = _request(body, selected)
    try:
        candidate = result['candidates'][0]
        if candidate.get('finishReason') != 'STOP':
            raise ValueError
        for part in candidate['content']['parts']:
            blob = part.get('inlineData')
            if blob and not part.get('thought'):
                mime = blob['mimeType']
                data = base64.b64decode(blob['data'], validate=True)
                if mime not in ('image/png','image/jpeg','image/webp') or not data or len(data)>10*1024*1024:
                    raise ValueError
                signatures = {'image/png':b'\x89PNG\r\n\x1a\n','image/jpeg':b'\xff\xd8\xff','image/webp':b'RIFF'}
                if not data.startswith(signatures[mime]):
                    raise ValueError
                with Image.open(BytesIO(data)) as image:
                    if image.width*image.height>16000000 or {'PNG':'image/png','JPEG':'image/jpeg','WEBP':'image/webp'}.get(image.format)!=mime:
                        raise ValueError
                    image.verify()
                with Image.open(BytesIO(data)) as image:
                    image.load()
                return mime, data
    except (KeyError, IndexError, ValueError, TypeError, OSError, Image.DecompressionBombError):
        pass
    raise RuntimeError('Gemini returned no valid study image. Nothing was saved.')

"""Validated, locally stored profile pictures (no public remote image URLs)."""
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
import logging
import httpx
from PIL import Image, UnidentifiedImageError
from .db import data_dir, now
from . import storage

MAX_BYTES = 2 * 1024 * 1024


def save(db, user_id, content, source='upload'):
    if not content or len(content) > MAX_BYTES:
        raise ValueError('Choose an image up to 2 MB.')
    try:
        with Image.open(BytesIO(content)) as image:
            if image.format not in ('JPEG', 'PNG', 'WEBP') or image.width > 8000 or image.height > 8000:
                raise ValueError('Choose a JPG, PNG or WebP image up to 8000 pixels wide or tall.')
            image.thumbnail((512, 512))
            cleaned = image.convert('RGB')
            output = BytesIO()
            cleaned.save(output, format='WEBP', quality=85)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValueError('The selected image could not be read.') from exc
    storage.save('profile_pictures', f'{user_id}.webp', output.getvalue(), 'image/webp')
    db.execute('UPDATE profiles SET avatar_source=?,avatar_updated=? WHERE id=?', (source, now(), user_id))


def google(db, user_id, url):
    """Only fetch a verified Google's own profile-picture origin."""
    if not url or not isinstance(url, str):
        return
    parsed = urlparse(url)
    if parsed.scheme != 'https' or parsed.hostname not in ('lh3.googleusercontent.com', 'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'lh6.googleusercontent.com'):
        return
    try:
        response = httpx.get(url, timeout=8, follow_redirects=False)
        response.raise_for_status()
        if response.headers.get('content-type', '').split(';')[0] not in ('image/jpeg','image/png','image/webp'):
            return
        save(db, user_id, response.content, 'google')
    except (httpx.HTTPError, ValueError, OSError):
        logging.warning('Google profile picture could not be copied for account %s', user_id)


def path(user_id):
    return data_dir() / 'profile_pictures' / f'{user_id}.webp'

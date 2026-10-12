"""Private file storage: local disk on Windows, private Vercel Blob in cloud."""

import os
from pathlib import Path

import httpx
from starlette.responses import FileResponse, StreamingResponse

from .db import data_dir, cloud_database


def blob_mode():
    return cloud_database()


def pathname(category, key):
    if not category or category not in ('uploads', 'chat_uploads', 'visuals', 'profile_pictures'):
        raise ValueError('Invalid file category.')
    candidate = Path(key)
    if candidate.is_absolute() or '..' in candidate.parts or not key:
        raise ValueError('Invalid file path.')
    return f'{category}/{candidate.as_posix()}'


def local_path(category, key):
    root = (data_dir() / category).resolve()
    path = (root / key).resolve()
    if not path.is_relative_to(root):
        raise ValueError('Invalid file path.')
    return path


def save(category, key, content, mime='application/octet-stream'):
    if blob_mode():
        from vercel.blob import BlobClient
        BlobClient().put(pathname(category, key), content, access='private',
                         content_type=mime, overwrite=True)
    else:
        path = local_path(category, key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)


def remove(category, key):
    if blob_mode():
        from vercel.blob import BlobClient
        BlobClient().delete(pathname(category, key))
    else:
        local_path(category, key).unlink(missing_ok=True)


def _cloud_url(category, key):
    from vercel.blob import BlobClient
    return BlobClient().head(pathname(category, key)).url


def read(category, key):
    if blob_mode():
        response = httpx.get(_cloud_url(category, key),
                             headers={'Authorization': f"Bearer {os.environ['BLOB_READ_WRITE_TOKEN']}"},
                             timeout=30)
        response.raise_for_status()
        return response.content
    path = local_path(category, key)
    if not path.is_file():
        raise FileNotFoundError(path)
    return path.read_bytes()


def response(category, key, *, media_type='application/octet-stream', filename=None):
    if not blob_mode():
        path = local_path(category, key)
        if not path.is_file():
            raise FileNotFoundError(path)
        return FileResponse(path, media_type=media_type, filename=filename,
                            content_disposition_type='attachment' if filename else None)

    url = _cloud_url(category, key)

    async def chunks():
        async with httpx.AsyncClient(timeout=60) as client:
            async with client.stream('GET', url, headers={
                'Authorization': f"Bearer {os.environ['BLOB_READ_WRITE_TOKEN']}"
            }) as upstream:
                upstream.raise_for_status()
                async for chunk in upstream.aiter_bytes():
                    yield chunk

    headers = {'Cache-Control': 'private, no-store'}
    if filename:
        import re
        safe = re.sub(r'[^a-zA-Z0-9._ -]', '_', filename)
        headers['Content-Disposition'] = f'attachment; filename="{safe}"'
    return StreamingResponse(chunks(), media_type=media_type, headers=headers)

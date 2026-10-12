"""Package only source, compiled UI, tests and documentation; exclude user data/secrets."""
import argparse
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
ROOT_FILES = {'run.py','requirements.txt','requirements-dev.txt','README.md','REDESIGN.md','AI-SETUP.md','AUTH-SETUP.md','MIGRATION.md','VERIFICATION.md','.env.example','.gitignore'}
FRONTEND_FILES = {'index.html','vite.config.ts','package.json','package-lock.json','tsconfig.json','postcss.config.mjs'}

def included(path):
    parts = path.relative_to(ROOT).parts
    if path.is_symlink() or '__pycache__' in parts or path.suffix == '.pyc':
        return False
    if len(parts)==1:
        return parts[0] in ROOT_FILES
    if parts[0] in ('backend','tests','tools'):
        return path.suffix in ('.py','.sql')
    if parts[0]=='.vscode':
        return parts[1]=='launch.json'
    if parts[0]=='frontend':
        return parts[1] in ('src','dist','public') or (len(parts)==2 and parts[1] in FRONTEND_FILES)
    return False

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    output=parser.parse_args().output.resolve()
    output.parent.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(ROOT.rglob('*')):
            if path.is_file() and included(path):
                archive.write(path,Path('NEXOVIA-Python')/path.relative_to(ROOT))
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        names=archive.namelist()
        assert 'NEXOVIA-Python/frontend/dist/index.html' in names
        assert 'NEXOVIA-Python/backend/migrations/0008_ai_usage_limits.sql' in names
        assert not any('/data/' in n or '/node_modules/' in n or '/.venv/' in n or n.endswith(('.env','.env.local','.sqlite3')) for n in names)
        print(f'{output}\n{len(names)} files; {output.stat().st_size} bytes; archive integrity and exclusions verified.')

"""Run from the project folder with: python run.py"""
import os
from pathlib import Path
from dotenv import load_dotenv
import uvicorn

if __name__ == '__main__':
    load_dotenv(Path(__file__).parent / '.env')
    uvicorn.run('backend.main:app', host=os.getenv('HOST', '127.0.0.1'), port=int(os.getenv('PORT', '8000')), proxy_headers=False)

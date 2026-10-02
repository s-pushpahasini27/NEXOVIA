import os
import re
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from nexovia import create_app  # noqa: E402


class AppTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.app = create_app("testing", {"DATABASE": os.path.join(self._tmp.name, "test.sqlite3")})
        self.client = self.app.test_client()

    def tearDown(self):
        self._tmp.cleanup()

    def csrf(self, path="/login"):
        html = self.client.get(path).get_data(as_text=True)
        return re.search(r'name="csrf_token" value="([^"]+)"', html).group(1)

    def register(self, name="Ada Lovelace", email="ada@school.edu", password="correct-horse", remember=False):
        data = {"csrf_token": self.csrf("/register"), "name": name, "email": email, "password": password}
        if remember:
            data["remember"] = "on"
        return self.client.post("/register", data=data)

    def login(self, email="ada@school.edu", password="correct-horse", remember=False, next_url=None):
        data = {"csrf_token": self.csrf("/login"), "email": email, "password": password}
        if remember:
            data["remember"] = "on"
        return self.client.post("/login" + (f"?next={next_url}" if next_url else ""), data=data)

    def logout(self):
        return self.client.post("/logout", data={"csrf_token": self.csrf("/app")})


def api(case, method, path, payload=None, token=None):
    """JSON request with the CSRF header, as the dashboard JS sends it."""
    token = token if token is not None else case.csrf("/app")
    kwargs = {"headers": {"X-CSRF-Token": token}}
    if payload is not None:
        kwargs["json"] = payload
    return getattr(case.client, method)(path, **kwargs)

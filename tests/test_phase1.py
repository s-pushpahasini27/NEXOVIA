import unittest

from helpers import AppTestCase

from nexovia.ai_provider import get_provider


class AuthGatingTests(AppTestCase):
    def test_app_requires_login(self):
        r = self.client.get("/app")
        self.assertEqual(r.status_code, 302)
        self.assertIn("/login?next=/app", r.headers["Location"])

    def test_public_pages_render(self):
        for path in ("/", "/login", "/register"):
            self.assertEqual(self.client.get(path).status_code, 200, path)

    def test_unknown_route_404(self):
        self.assertEqual(self.client.get("/nope").status_code, 404)


class RegistrationTests(AppTestCase):
    def test_register_logs_in_and_hashes_password(self):
        r = self.register()
        self.assertEqual(r.status_code, 302)
        self.assertTrue(r.headers["Location"].endswith("/app"))
        self.assertEqual(self.client.get("/app").status_code, 200)
        with self.app.app_context():
            from nexovia.db import get_db
            row = get_db().execute("SELECT password_hash FROM users").fetchone()
            self.assertNotEqual(row["password_hash"], "correct-horse")
            self.assertTrue(row["password_hash"].startswith(("scrypt:", "pbkdf2:")))

    def test_register_validation_errors(self):
        r = self.register(name="", email="bad", password="short")
        self.assertEqual(r.status_code, 400)
        body = r.get_data(as_text=True)
        for fragment in ("valid email", "at least 8", "what to call you"):
            self.assertIn(fragment, body)

    def test_register_duplicate_email(self):
        self.register()
        self.logout()
        r = self.register()
        self.assertEqual(r.status_code, 400)
        self.assertIn("already exists", r.get_data(as_text=True))


class LoginLogoutTests(AppTestCase):
    def test_login_success_and_wrong_password(self):
        self.register()
        self.logout()
        bad = self.login(password="wrong-password")
        self.assertEqual(bad.status_code, 401)
        self.assertIn("Incorrect email or password", bad.get_data(as_text=True))
        self.assertEqual(self.login().status_code, 302)
        self.assertEqual(self.client.get("/app").status_code, 200)

    def test_next_redirect_and_open_redirect_blocked(self):
        self.register()
        self.logout()
        self.assertTrue(self.login(next_url="/app").headers["Location"].endswith("/app"))
        self.logout()
        evil = self.login(next_url="//evil.example")
        self.assertNotIn("evil.example", evil.headers["Location"])

    def test_logout_clears_session(self):
        self.register()
        self.assertEqual(self.logout().status_code, 302)
        self.assertEqual(self.client.get("/app").status_code, 302)

    def test_logout_requires_post(self):
        self.assertEqual(self.client.get("/logout").status_code, 405)


class RememberMeTests(AppTestCase):
    @staticmethod
    def _cookie(response):
        return next(c for c in response.headers.getlist("Set-Cookie") if c.startswith("session="))

    def test_remember_me_sets_persistent_cookie(self):
        self.register()
        self.logout()
        with_remember = self._cookie(self.login(remember=True))
        self.logout()
        without = self._cookie(self.login(remember=False))
        self.assertIn("Expires=", with_remember)
        self.assertNotIn("Expires=", without)


class CsrfTests(AppTestCase):
    def test_post_without_token_rejected(self):
        self.assertEqual(self.client.post("/login", data={"email": "a@b.co", "password": "x"}).status_code, 400)

    def test_post_with_wrong_token_rejected(self):
        self.client.get("/login")
        r = self.client.post("/login", data={"csrf_token": "forged", "email": "a@b.co", "password": "x"})
        self.assertEqual(r.status_code, 400)


class AIProviderTests(AppTestCase):
    def test_mock_complete_and_stream_agree(self):
        p = get_provider("mock")
        res = p.complete("photosynthesis")
        self.assertEqual(res.provider, "mock")
        self.assertIn("photosynthesis", res.text)
        self.assertEqual("".join(p.stream("photosynthesis")).strip(), res.text)

    def test_unknown_provider_raises(self):
        with self.assertRaises(ValueError):
            get_provider("does-not-exist")

    def test_dashboard_uses_configured_provider(self):
        self.register()
        body = self.client.get("/app").get_data(as_text=True)
        self.assertIn('data-testid="ai-tip"', body)
        self.assertIn("via mock provider", body)


class LandingPageTests(AppTestCase):
    def test_hero_headline_present(self):
        body = self.client.get("/").get_data(as_text=True)
        self.assertIn("The Future of Smarter Learning Starts Here.", body)
        self.assertIn("Everything a student needs. Nothing a student doesn't.", body)

    def test_nav_anchors_present(self):
        body = self.client.get("/").get_data(as_text=True)
        for anchor in ("#features", "#ai-tools", "#community", "#about"):
            self.assertIn(f'href="{anchor}"', body)

    def test_features_grid_card_count(self):
        body = self.client.get("/").get_data(as_text=True)
        self.assertEqual(body.count('class="lp-card reveal"'), 7)

    def test_landing_stats_present(self):
        body = self.client.get("/").get_data(as_text=True)
        for value in ("25000", "120000", "1000000"):
            self.assertIn(f'data-count-to="{value}"', body)


if __name__ == "__main__":
    unittest.main()

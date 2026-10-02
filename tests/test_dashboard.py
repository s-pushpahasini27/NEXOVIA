import unittest
from datetime import date, timedelta

from helpers import AppTestCase, api

from nexovia import dashboard
from nexovia.db import get_db


class DashboardPageTests(AppTestCase):
    def test_dashboard_requires_login(self):
        self.assertEqual(self.client.get("/app").status_code, 302)

    def test_dashboard_renders_sections_for_new_user(self):
        self.register()
        body = self.client.get("/app").get_data(as_text=True)
        for marker in ('id="st-streak"', 'id="task-list"', 'id="week"', 'id="log-dialog"',
                       'data-command="Log a study session"', 'data-testid="ai-tip"'):
            self.assertIn(marker, body)
        self.assertIn("Nothing planned yet", body)
        tpl = body.split('id="task-tpl"')[1].split("</template>")[0]
        self.assertIn("<svg", tpl)  # JS-created tasks clone this, so it must carry the icons
        self.assertEqual(body.count('class="week-col'), 7)

    def test_timezone_cookie_valid_and_invalid_do_not_break(self):
        self.register()
        self.client.set_cookie("nx-tz", "Asia/Kolkata")
        self.assertEqual(self.client.get("/app").status_code, 200)
        self.client.set_cookie("nx-tz", "Not/AZone")
        self.assertEqual(self.client.get("/app").status_code, 200)


class ApiAuthTests(AppTestCase):
    def test_api_rejects_anonymous_with_401_json(self):
        token = self.csrf("/login")
        r = self.client.post("/api/tasks", json={"title": "x"}, headers={"X-CSRF-Token": token})
        self.assertEqual(r.status_code, 401)
        self.assertIn("error", r.get_json())
        self.assertEqual(self.client.get("/api/ai/tip").status_code, 401)

    def test_api_post_without_csrf_header_rejected(self):
        self.register()
        self.assertEqual(self.client.post("/api/tasks", json={"title": "x"}).status_code, 400)


class TaskTests(AppTestCase):
    def setUp(self):
        super().setUp()
        self.register()

    def test_create_toggle_delete_task(self):
        r = api(self, "post", "/api/tasks", {"title": "  Review chapter 4  "})
        self.assertEqual(r.status_code, 201)
        task = r.get_json()["task"]
        self.assertEqual(task["title"], "Review chapter 4")
        self.assertEqual(r.get_json()["stats"]["tasks_total"], 1)

        r = api(self, "post", f"/api/tasks/{task['id']}/toggle")
        self.assertTrue(r.get_json()["task"]["done"])
        self.assertEqual(r.get_json()["stats"]["tasks_done"], 1)
        r = api(self, "post", f"/api/tasks/{task['id']}/toggle")
        self.assertFalse(r.get_json()["task"]["done"])

        r = api(self, "post", f"/api/tasks/{task['id']}/delete")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.get_json()["stats"]["tasks_total"], 0)

    def test_blank_title_rejected(self):
        self.assertEqual(api(self, "post", "/api/tasks", {"title": "   "}).status_code, 400)
        self.assertEqual(api(self, "post", "/api/tasks", {}).status_code, 400)

    def test_title_is_truncated_and_rendered_escaped(self):
        api(self, "post", "/api/tasks", {"title": "<script>alert(1)</script>" + "x" * 300})
        body = self.client.get("/app").get_data(as_text=True)
        self.assertNotIn("<script>alert(1)</script>", body)
        self.assertIn("&lt;script&gt;", body)
        with self.app.app_context():
            title = get_db().execute("SELECT title FROM tasks").fetchone()["title"]
            self.assertEqual(len(title), dashboard.MAX_TITLE)

    def test_tasks_are_private_to_their_owner(self):
        task_id = api(self, "post", "/api/tasks", {"title": "mine"}).get_json()["task"]["id"]
        self.logout()
        self.register(name="Eve", email="eve@school.edu")
        self.assertEqual(api(self, "post", f"/api/tasks/{task_id}/toggle").status_code, 404)
        self.assertEqual(api(self, "post", f"/api/tasks/{task_id}/delete").status_code, 404)
        self.assertNotIn("mine", self.client.get("/app").get_data(as_text=True))


class SessionTests(AppTestCase):
    def setUp(self):
        super().setUp()
        self.register()

    def test_log_session_updates_stats_and_chart(self):
        r = api(self, "post", "/api/sessions", {"minutes": 45, "topic": "Calculus"})
        self.assertEqual(r.status_code, 201)
        data = r.get_json()
        self.assertEqual(data["stats"]["today_minutes"], 45)
        self.assertEqual(data["stats"]["week_minutes"], 45)
        self.assertEqual(data["stats"]["streak"], 1)
        self.assertEqual(data["week"][-1]["minutes"], 45)
        self.assertTrue(data["week"][-1]["today"])

    def test_session_validation(self):
        for bad in ({"minutes": 0}, {"minutes": 601}, {"minutes": "abc"}, {}, {"minutes": None}):
            self.assertEqual(api(self, "post", "/api/sessions", bad).status_code, 400, bad)

    def test_ai_tip_uses_provider(self):
        r = self.client.get("/api/ai/tip?topic=organic chemistry")
        data = r.get_json()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(data["provider"], "mock")
        self.assertIn("organic chemistry", data["text"])
        self.assertEqual(self.client.get("/api/ai/tip").status_code, 200)


class StreakLogicTests(AppTestCase):
    def setUp(self):
        super().setUp()
        self.register()
        self.today = date(2026, 10, 1)

    def _log(self, *days_ago):
        with self.app.app_context():
            for n in days_ago:
                dashboard.log_session(1, 30, day=self.today - timedelta(days=n))

    def _streak(self):
        with self.app.app_context():
            return dashboard.streak(1, self.today)

    def test_streak_counts_consecutive_days(self):
        self._log(0, 1, 2)
        self.assertEqual(self._streak(), 3)

    def test_streak_survives_until_today_ends(self):
        self._log(1, 2)
        self.assertEqual(self._streak(), 2)

    def test_streak_breaks_on_gap(self):
        self._log(0, 2, 3)
        self.assertEqual(self._streak(), 1)
        self.assertEqual(self._streak() if not self._log(5) else 0, 1)

    def test_no_sessions_means_zero(self):
        self.assertEqual(self._streak(), 0)

    def test_week_window_is_seven_days_ending_today(self):
        self._log(0, 6, 7)
        with self.app.app_context():
            days = dashboard.week(1, self.today)
        self.assertEqual(len(days), 7)
        self.assertEqual(days[-1]["date"], "2026-10-01")
        self.assertEqual(sum(d["minutes"] for d in days), 60)  # day 7 is outside the window


if __name__ == "__main__":
    unittest.main()

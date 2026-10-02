from helpers import AppTestCase, api


class ActivePlanVisibilityTests(AppTestCase):
    def test_activated_plan_survives_reload_and_appears_on_home(self):
        self.register()
        generated = api(self, "post", "/api/planner/generate", {
            "range": "today",
            "items": [{"subject": "DBMS", "topic": "Normalization", "priority": 1,
                       "planned_minutes": 60}],
        })
        self.assertEqual(generated.status_code, 201)
        plan_id = generated.get_json()["plan"]["id"]
        task_id = generated.get_json()["tasks"][0]["id"]

        self.assertNotIn("DBMS", self.client.get("/planner").get_data(as_text=True))
        activated = api(self, "post", f"/api/planner/{plan_id}/activate", {})
        self.assertEqual(activated.status_code, 200)

        for path in ("/planner", "/app"):
            page = self.client.get(path).get_data(as_text=True)
            self.assertIn("DBMS", page)
            self.assertIn("Normalization", page)
            self.assertIn("60 min planned", page)

        logged = api(self, "post", "/api/sessions", {
            "minutes": 35, "topic": "Normalization", "plan_task_id": task_id,
        })
        self.assertEqual(logged.status_code, 201)
        self.assertIn("35 min studied", self.client.get("/planner").get_data(as_text=True))
        self.assertIn("35 min studied", self.client.get("/app").get_data(as_text=True))

    def test_another_user_cannot_see_active_plan(self):
        self.register()
        generated = api(self, "post", "/api/planner/generate", {
            "range": "today",
            "items": [{"subject": "Private subject", "topic": "Private topic"}],
        })
        plan_id = generated.get_json()["plan"]["id"]
        api(self, "post", f"/api/planner/{plan_id}/activate", {})
        self.logout()
        self.register(name="Other Student", email="other@school.edu")
        self.assertNotIn("Private subject", self.client.get("/planner").get_data(as_text=True))
        self.assertNotIn("Private subject", self.client.get("/app").get_data(as_text=True))

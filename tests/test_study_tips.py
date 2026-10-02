import io
import json
from unittest.mock import patch

from helpers import AppTestCase, api
from nexovia.ai_provider.base import AIResponse
from nexovia.ai_provider.groq_provider import GroqError, GroqProvider


class StudyTipTests(AppTestCase):
    def test_tip_uses_activated_plan_and_requested_topic(self):
        self.register()
        generated = api(self, "post", "/api/planner/generate", {
            "range": "today",
            "items": [{"subject": "DBMS", "topic": "Normalization", "priority": 1,
                       "planned_minutes": 60}],
        })
        plan_id = generated.get_json()["plan"]["id"]
        api(self, "post", f"/api/planner/{plan_id}/activate", {})
        response = self.client.get("/api/ai/tip?topic=exam%20revision")
        self.assertEqual(response.status_code, 200)
        self.assertIn("DBMS", response.get_json()["text"])
        self.assertIn("Normalization", response.get_json()["text"])
        self.assertIn("DBMS", self.client.get("/app").get_data(as_text=True))

    def test_groq_receives_plan_context_without_leaking_other_users(self):
        self.register()
        generated = api(self, "post", "/api/planner/generate", {
            "range": "today",
            "items": [{"subject": "Calculus", "topic": "Integrals", "priority": 1}],
        })
        api(self, "post", f"/api/planner/{generated.get_json()['plan']['id']}/activate", {})
        class CapturingProvider:
            name = "groq"
            def complete(self, prompt, *, system, **options):
                self_prompt.append(prompt)
                return AIResponse("Practice one integral now.", "groq", "test")
        self_prompt = []
        with patch("nexovia.study_tips.current_provider", return_value=CapturingProvider()):
            response = self.client.get("/api/ai/tip")
        self.assertEqual(response.get_json()["provider"], "groq")
        self.assertIn("Calculus / Integrals", self_prompt[0])
        self.logout()
        self.register(name="Other", email="other@school.edu")
        self_prompt.clear()
        with patch("nexovia.study_tips.current_provider", return_value=CapturingProvider()):
            self.client.get("/api/ai/tip")
        self.assertNotIn("Calculus", self_prompt[0])

    def test_groq_transport_sends_authorized_short_completion(self):
        provider = GroqProvider({"api_key": "test-key", "model": "llama-3.3-70b-versatile"})
        reply = io.BytesIO(json.dumps({"choices": [{"message": {"content": "Review integrals."}}]}).encode())
        with patch("nexovia.ai_provider.groq_provider.urlopen", return_value=reply) as send:
            result = provider.complete("Plan details", system="Give a short tip")
        request = send.call_args.args[0]
        body = json.loads(request.data)
        self.assertEqual(request.get_header("Authorization"), "Bearer test-key")
        self.assertEqual(body["model"], "llama-3.3-70b-versatile")
        self.assertEqual(body["messages"][0]["role"], "system")
        self.assertEqual(result.text, "Review integrals.")
        with self.assertRaises(GroqError):
            GroqProvider({}).complete("Plan details")

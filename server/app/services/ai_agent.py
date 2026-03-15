import google.generativeai as genai
from app.core.config import settings
from typing import Dict, Any
import json

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)


def _clean_json(text: str) -> str:
    """Strip markdown code fences from an LLM JSON response."""
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    return text.strip()


class AIAgent:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.5-flash')

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _parse_json_response(self, text: str, fallback: dict) -> dict:
        cleaned = _clean_json(text)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return {**fallback, "_raw": text}

    # ── Article workflows ─────────────────────────────────────────────────────

    async def summarize_article(self, article_text: str) -> Dict[str, Any]:
        """Summarize a single article."""
        try:
            prompt = f"""Summarize the following article concisely (2-3 sentences).

Article:
{article_text}

Respond in JSON:
{{"summary": "...", "key_points": ["...", "...", "..."], "confidence": 0.9}}
"""
            response = self.model.generate_content(prompt)
            result = self._parse_json_response(
                response.text,
                {"summary": response.text, "key_points": [], "confidence": 0.8},
            )
            return {"success": True, "data": result}
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "data": {"summary": f"Error: {e}", "key_points": [], "confidence": 0.0},
            }

    async def process_multiple_articles(self, articles: list) -> Dict[str, Any]:
        """Summarize multiple articles then produce a combined overview."""
        summaries = []
        for idx, article in enumerate(articles):
            result = await self.summarize_article(article.get("content", ""))
            summaries.append(
                {
                    "article_title": article.get("title", f"Article {idx + 1}"),
                    "summary": result["data"]["summary"],
                    "key_points": result["data"].get("key_points", []),
                }
            )

        combined_prompt = f"""Based on these article summaries, create a brief combined overview (2-3 sentences):

{json.dumps(summaries, indent=2)}

Respond in JSON:
{{"overview": "...", "total_articles": {len(articles)}}}
"""
        try:
            response = self.model.generate_content(combined_prompt)
            combined = self._parse_json_response(
                response.text,
                {"overview": response.text, "total_articles": len(articles)},
            )
            return {"success": True, "individual_summaries": summaries, "combined_summary": combined}
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "individual_summaries": summaries,
                "combined_summary": {"overview": "Error creating combined summary", "total_articles": len(articles)},
            }

    # ── Email reply drafter ───────────────────────────────────────────────────

    async def draft_email_reply(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Draft a professional email reply to a customer message."""
        customer_name = data.get("customer_name", data.get("name", "Customer"))
        subject = data.get("subject", data.get("original_subject", "(no subject)"))
        body = data.get("original_body", data.get("body", data.get("message", "")))
        tone = data.get("tone", "professional")

        prompt = f"""You are a professional customer support representative.

Customer: {customer_name}
Subject: {subject}
Their message: {body}
Requested tone: {tone}

Write a {tone} email reply that is helpful, empathetic, and resolves their concern.

Respond in JSON:
{{
  "reply": "Full email reply text (no greeting/sign-off placeholder needed, write them in full)",
  "subject_line": "Re: {subject}",
  "tone_used": "{tone}",
  "action_items": ["Any follow-up actions if needed"]
}}
"""
        try:
            response = self.model.generate_content(prompt)
            result = self._parse_json_response(
                response.text,
                {"reply": response.text, "subject_line": f"Re: {subject}", "tone_used": tone, "action_items": []},
            )
            return {"success": True, **result}
        except Exception as e:
            return {"success": False, "error": str(e), "reply": f"Error drafting reply: {e}"}

    # ── Finance analysis ──────────────────────────────────────────────────────

    async def analyze_finance(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze financial news summaries and generate investor insights."""
        summaries = data.get("individual_summaries", [])
        if not summaries:
            return {"success": False, "error": "No article summaries available for analysis"}

        summaries_text = "\n\n".join(
            f"• {s.get('article_title', 'Unknown')}: {s.get('summary', '')}"
            for s in summaries
        )
        key_points_text = "\n".join(
            f"  - {pt}"
            for s in summaries
            for pt in s.get("key_points", [])
        )

        prompt = f"""You are a senior financial analyst. Analyze these news summaries and write a digest.

SUMMARIES:
{summaries_text}

KEY POINTS:
{key_points_text}

Respond in JSON:
{{
  "market_sentiment": "bullish | bearish | neutral",
  "key_themes": ["theme1", "theme2", "theme3"],
  "risk_factors": ["risk1", "risk2"],
  "opportunities": ["opp1", "opp2"],
  "report": "3-4 paragraph comprehensive analysis report suitable for emailing to investors",
  "recommendation": "One-line investment/market recommendation"
}}
"""
        try:
            response = self.model.generate_content(prompt)
            result = self._parse_json_response(
                response.text,
                {
                    "market_sentiment": "neutral",
                    "key_themes": [],
                    "risk_factors": [],
                    "opportunities": [],
                    "report": response.text,
                    "recommendation": "",
                },
            )
            return {"success": True, **result}
        except Exception as e:
            return {"success": False, "error": str(e), "report": f"Analysis error: {e}"}

    # ── Generic text task ─────────────────────────────────────────────────────

    async def generic_task(self, instruction: str, context: str) -> Dict[str, Any]:
        """Run an arbitrary AI instruction against a context string."""
        prompt = f"""{instruction}

Context / Input:
{context}

Respond in JSON with at minimum: {{"result": "...", "success": true}}
"""
        try:
            response = self.model.generate_content(prompt)
            result = self._parse_json_response(response.text, {"result": response.text})
            return {"success": True, **result}
        except Exception as e:
            return {"success": False, "error": str(e), "result": f"Error: {e}"}

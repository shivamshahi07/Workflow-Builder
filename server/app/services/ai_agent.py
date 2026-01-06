import google.generativeai as genai
from app.core.config import settings
from typing import Dict, Any
import json

# Configure Gemini
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)


class AIAgent:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-2.5-flash')  # Updated model name
    
    async def summarize_article(self, article_text: str) -> Dict[str, Any]:
        """Summarize an article using Gemini AI"""
        try:
            prompt = f"""Summarize the following article in 2-3 sentences. 
Be concise and capture the main points.

Article:
{article_text}

Provide your response in JSON format with these fields:
- summary: The summary text
- key_points: List of 3 main key points
- confidence: A number between 0 and 1 indicating your confidence
"""
            
            response = self.model.generate_content(prompt)
            
            # Try to parse JSON from response
            text = response.text.strip()
            
            # Remove markdown code blocks if present
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            try:
                result = json.loads(text)
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                result = {
                    "summary": response.text,
                    "key_points": [],
                    "confidence": 0.8
                }
            
            return {
                "success": True,
                "data": result
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "data": {
                    "summary": f"Error: {str(e)}",
                    "key_points": [],
                    "confidence": 0.0
                }
            }
    
    async def process_multiple_articles(self, articles: list) -> Dict[str, Any]:
        """Process multiple articles and create a combined summary"""
        summaries = []
        
        for idx, article in enumerate(articles):
            result = await self.summarize_article(article.get("content", ""))
            summaries.append({
                "article_title": article.get("title", f"Article {idx + 1}"),
                "summary": result["data"]["summary"],
                "key_points": result["data"].get("key_points", [])
            })
        
        # Create combined summary
        combined_prompt = f"""Based on these article summaries, create a brief overview (2-3 sentences):

{json.dumps(summaries, indent=2)}

Provide a JSON response with:
- overview: Combined overview of all articles
- total_articles: Number of articles processed
"""
        
        try:
            response = self.model.generate_content(combined_prompt)
            text = response.text.strip()
            
            # Clean markdown
            if text.startswith("```json"):
                text = text[7:]
            if text.startswith("```"):
                text = text[3:]
            if text.endswith("```"):
                text = text[:-3]
            text = text.strip()
            
            try:
                combined = json.loads(text)
            except:
                combined = {
                    "overview": response.text,
                    "total_articles": len(articles)
                }
            
            return {
                "success": True,
                "individual_summaries": summaries,
                "combined_summary": combined
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "individual_summaries": summaries,
                "combined_summary": {
                    "overview": "Error creating combined summary",
                    "total_articles": len(articles)
                }
            }

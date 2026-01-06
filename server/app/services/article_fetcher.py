import requests
from bs4 import BeautifulSoup
from typing import Dict, Any


class ArticleFetcher:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def fetch_article(self, url: str) -> Dict[str, Any]:
        """Fetch article content from URL"""
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'lxml')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()
            
            # Try to find title
            title = None
            if soup.find('h1'):
                title = soup.find('h1').get_text().strip()
            elif soup.find('title'):
                title = soup.find('title').get_text().strip()
            else:
                title = url
            
            # Try to find main content
            content = ""
            
            # Look for common article containers
            article_tags = soup.find_all(['article', 'main'])
            if article_tags:
                for tag in article_tags:
                    paragraphs = tag.find_all('p')
                    content += ' '.join([p.get_text().strip() for p in paragraphs])
            else:
                # Fallback: get all paragraphs
                paragraphs = soup.find_all('p')
                content = ' '.join([p.get_text().strip() for p in paragraphs])
            
            # Clean up content
            content = ' '.join(content.split())
            
            # Limit content length
            if len(content) > 5000:
                content = content[:5000] + "..."
            
            return {
                "success": True,
                "title": title,
                "content": content,
                "url": url
            }
            
        except requests.RequestException as e:
            return {
                "success": False,
                "error": f"Failed to fetch URL: {str(e)}",
                "title": url,
                "content": "",
                "url": url
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Error parsing content: {str(e)}",
                "title": url,
                "content": "",
                "url": url
            }
    
    def fetch_multiple_articles(self, urls: list) -> list:
        """Fetch multiple articles"""
        articles = []
        for url in urls:
            article = self.fetch_article(url)
            articles.append(article)
        return articles

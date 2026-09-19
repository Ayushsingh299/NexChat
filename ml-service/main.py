import os
import json
import logging
import asyncio
import redis.asyncio as redis
from redis.exceptions import ResponseError
from fastapi import FastAPI
from textblob import TextBlob
from contextlib import asynccontextmanager

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Redis Connection details
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))

redis_client = None

def analyze_message(content: str):
    """
    Analyzes the message content for sentiment and spam.
    Returns (sentiment: str, spam_score: float)
    """
    # 1. Sentiment Analysis using TextBlob
    blob = TextBlob(content)
    polarity = blob.sentiment.polarity
    
    if polarity > 0.1:
        sentiment = "POSITIVE"
    elif polarity < -0.1:
        sentiment = "NEGATIVE"
    else:
        sentiment = "NEUTRAL"
        
    # 2. Simple Spam Detection Heuristic (Mock ML)
    spam_keywords = ["free money", "click here", "buy now", "subscribe", "limited time offer"]
    content_lower = content.lower()
    
    keyword_matches = sum(1 for word in spam_keywords if word in content_lower)
    spam_score = min(1.0, keyword_matches * 0.25)
    
    # Add length heuristic: all caps or too many links
    if content.isupper() and len(content) > 10:
        spam_score = min(1.0, spam_score + 0.3)
    
    if "http://" in content_lower or "https://" in content_lower:
        spam_score = min(1.0, spam_score + 0.2)
        
    return sentiment, spam_score

async def redis_listener():
    STREAM_KEY = "chat.analyze.stream"
    GROUP_NAME = "ml_group"
    CONSUMER_NAME = "ml_consumer_1"
    
    try:
        await redis_client.xgroup_create(STREAM_KEY, GROUP_NAME, mkstream=True)
    except ResponseError as e:
        if "BUSYGROUP" not in str(e) and "already exists" not in str(e):
            logger.error(f"Error creating group: {e}")
            
    logger.info("Listening to Redis stream: chat.analyze.stream")
    
    try:
        while True:
            messages = await redis_client.xreadgroup(GROUP_NAME, CONSUMER_NAME, {STREAM_KEY: '>'}, count=10, block=5000)
            if messages:
                for stream, msg_list in messages:
                    for msg_id, data in msg_list:
                        try:
                            message_id = data.get("messageId")
                            content = data.get("content", "")
                            is_group = data.get("isGroup") == "true"
                            
                            logger.info(f"Analyzing message {message_id}: '{content}'")
                            
                            sentiment, spam_score = analyze_message(content)
                            
                            # Publish result back via Stream
                            await redis_client.xadd("chat.analyze.result.stream", {
                                "messageId": str(message_id),
                                "isGroup": str(is_group).lower(),
                                "sentiment": sentiment,
                                "spamScore": str(spam_score)
                            })
                            
                            # Acknowledge message
                            await redis_client.xack(STREAM_KEY, GROUP_NAME, msg_id)
                            logger.info(f"Published result and ACKed message {message_id}")
                            
                        except Exception as e:
                            logger.error(f"Error processing stream message: {e}")
    except asyncio.CancelledError:
        logger.info("Redis listener task cancelled.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global redis_client
    redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    
    # Start background task
    task = asyncio.create_task(redis_listener())
    
    yield
    
    # Shutdown
    task.cancel()
    await redis_client.close()

app = FastAPI(lifespan=lifespan, title="NexChat ML Service")

@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "ml-service"}

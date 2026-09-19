import requests
import time

URL = "http://localhost:8080/api/v1/auth/login"

def test_rate_limit():
    print(f"Sending requests to {URL} to trigger rate limiting...")
    
    # We will send 105 requests. The max limit is 100.
    # We expect requests 101 to 105 to return 429 Too Many Requests.
    
    for i in range(1, 106):
        try:
            # We don't care about the body, just hitting the endpoint
            response = requests.post(URL, json={"email": "test@test.com", "password": "password"})
            status_code = response.status_code
            
            if status_code == 429:
                print(f"Request {i}: SUCCESS (Rate Limiter blocked the request! 429 Too Many Requests)")
                # If we get blocked, we proved the rate limiter works
                if i >= 100:
                    print("Test Passed: Rate limiter correctly triggered after 100 requests.")
                    return
            else:
                if i % 10 == 0:
                    print(f"Request {i}: Status {status_code} (Allowed)")
                    
        except Exception as e:
            print(f"Error on request {i}: {e}")
            
    print("Test Failed: Did not receive 429 Too Many Requests after 100 requests.")

if __name__ == "__main__":
    test_rate_limit()

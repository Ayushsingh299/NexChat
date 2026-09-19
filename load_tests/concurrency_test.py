import concurrent.futures
import requests
import time
import statistics

# Configuration
CONCURRENT_REQUESTS = 500  # Number of simultaneous requests
BASE_URL = "http://localhost:8080/api/v1/test/concurrency"

def make_request(mode):
    url = f"{BASE_URL}/{mode}"
    start_time = time.time()
    try:
        response = requests.post(url, timeout=10)
        latency = (time.time() - start_time) * 1000  # in ms
        return response.status_code, latency
    except Exception as e:
        return 500, (time.time() - start_time) * 1000

def run_test(mode, num_requests):
    print(f"\n--- Running Load Test for Mode: {mode.upper()} ---")
    print(f"Sending {num_requests} concurrent requests to simulate heavy server load...")
    
    start_time = time.time()
    latencies = []
    success_count = 0
    fail_count = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_requests) as executor:
        futures = [executor.submit(make_request, mode) for _ in range(num_requests)]
        
        for future in concurrent.futures.as_completed(futures):
            status, latency = future.result()
            if status == 200:
                latencies.append(latency)
                success_count += 1
            else:
                fail_count += 1

    total_time = time.time() - start_time
    throughput = success_count / total_time if total_time > 0 else 0

    if latencies:
        avg_latency = statistics.mean(latencies)
        p95_latency = statistics.quantiles(latencies, n=100)[94] if len(latencies) > 1 else latencies[0]
    else:
        avg_latency = p95_latency = 0

    print("--- Results ---")
    print(f"Total Time Taken: {total_time:.2f} seconds")
    print(f"Successful Requests: {success_count}")
    print(f"Failed Requests: {fail_count}")
    print(f"Throughput: {throughput:.2f} requests/second")
    print(f"Average Latency: {avg_latency:.2f} ms")
    print(f"P95 Latency: {p95_latency:.2f} ms")
    print("--------------------------------------------------\n")

if __name__ == "__main__":
    print("Initializing NexChat Concurrency Benchmark...")
    print("Wait 2 seconds to let the server stabilize...")
    time.sleep(2)
    
    # Run Sync (Mode A)
    run_test("sync", CONCURRENT_REQUESTS)
    
    print("Waiting 5 seconds for server threads to cool down...")
    time.sleep(5)
    
    # Run Async (Mode B - ThreadPoolTaskExecutor)
    run_test("async", CONCURRENT_REQUESTS)

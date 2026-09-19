package com.nexchat.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api/v1/test")
public class TestController {

    private final ThreadPoolTaskExecutor taskExecutor;

    public TestController(@Qualifier("chatMessageTaskExecutor") ThreadPoolTaskExecutor taskExecutor) {
        this.taskExecutor = taskExecutor;
    }

    /**
     * Simulates a heavy operation like a DB save or NLP task taking 50ms.
     */
    private void simulateHeavyProcessing() {
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Mode A: Synchronous (1 thread per connection). 
     * Blocks the main HTTP Tomcat thread.
     */
    @PostMapping("/concurrency/sync")
    public ResponseEntity<String> processSync() {
        simulateHeavyProcessing();
        return ResponseEntity.ok("Processed Synchronously");
    }

    /**
     * Mode B: Asynchronous (Thread Pool).
     * Dispatches the work to the custom ThreadPoolTaskExecutor and frees the Tomcat thread.
     */
    @PostMapping("/concurrency/async")
    public CompletableFuture<ResponseEntity<String>> processAsync() {
        return CompletableFuture.supplyAsync(() -> {
            simulateHeavyProcessing();
            return ResponseEntity.ok("Processed Asynchronously");
        }, taskExecutor);
    }
}

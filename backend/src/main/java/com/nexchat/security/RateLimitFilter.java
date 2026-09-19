package com.nexchat.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Component
public class RateLimitFilter extends OncePerRequestFilter {

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    
    private static final int MAX_REQUESTS = 200; // 200 requests per minute
    private static final long WINDOW_TIME_MS = 60000; // 1 minute window

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
            
        String path = request.getRequestURI();
        
        // Apply rate limiting to all api endpoints
        if (path.startsWith("/api/v1/")) {
            String clientIp = getClientIP(request);
            TokenBucket bucket = buckets.computeIfAbsent(clientIp, k -> new TokenBucket());
            
            if (!bucket.tryConsume()) {
                response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"error\": \"Too Many Requests\", \"message\": \"Rate limit exceeded. Try again later.\"}");
                return;
            }
        }
        
        filterChain.doFilter(request, response);
    }

    private String getClientIP(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0];
    }
    
    private static class TokenBucket {
        private final AtomicInteger tokens;
        private long lastRefillTime;

        public TokenBucket() {
            this.tokens = new AtomicInteger(MAX_REQUESTS);
            this.lastRefillTime = System.currentTimeMillis();
        }

        public synchronized boolean tryConsume() {
            refill();
            if (tokens.get() > 0) {
                tokens.decrementAndGet();
                return true;
            }
            return false;
        }

        private void refill() {
            long now = System.currentTimeMillis();
            if (now - lastRefillTime > WINDOW_TIME_MS) {
                tokens.set(MAX_REQUESTS);
                lastRefillTime = now;
            }
        }
    }
}

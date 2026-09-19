package com.nexchat.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.annotation.Order;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

@Component
@Order(1) // Run very early in the chain
@RequiredArgsConstructor
public class RateLimiterFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redisTemplate;
    
    // 100 requests per minute
    private static final int MAX_REQUESTS_PER_MINUTE = 100;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String ipAddress = request.getRemoteAddr();
        String key = "rate_limit:ip:" + ipAddress;
        
        // Skip rate limiting for websocket and file uploads for this simple demo
        if (request.getRequestURI().startsWith("/ws") || request.getRequestURI().startsWith("/api/v1/files")) {
            filterChain.doFilter(request, response);
            return;
        }

        Long requests = redisTemplate.opsForValue().increment(key);
        
        if (requests != null && requests == 1) {
            // First request, set expiry to 60 seconds
            redisTemplate.expire(key, Duration.ofSeconds(60));
        }
        
        if (requests != null && requests > MAX_REQUESTS_PER_MINUTE) {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Too many requests. Please try again later.\"}");
            return;
        }
        
        // Add header to response so client knows their limit
        response.setHeader("X-RateLimit-Limit", String.valueOf(MAX_REQUESTS_PER_MINUTE));
        response.setHeader("X-RateLimit-Remaining", String.valueOf(Math.max(0, MAX_REQUESTS_PER_MINUTE - (requests != null ? requests : 0))));

        filterChain.doFilter(request, response);
    }
}

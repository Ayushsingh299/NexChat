package com.nexchat.controller;

import com.nexchat.dto.ChangePasswordRequest;
import com.nexchat.model.SecurityAudit;
import com.nexchat.model.User;
import com.nexchat.model.UserSession;
import com.nexchat.repository.SecurityAuditRepository;
import com.nexchat.repository.UserRepository;
import com.nexchat.repository.UserSessionRepository;
import com.nexchat.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/security")
@RequiredArgsConstructor
@CrossOrigin
public class SecurityController {

    private final UserSessionRepository sessionRepository;
    private final SecurityAuditRepository auditRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final HttpServletRequest httpRequest;

    private User getCurrentUser() {
        return (User) SecurityContextHolder.getContext().getAuthentication().getPrincipal();
    }

    private String getCurrentJti() {
        String authHeader = httpRequest.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return jwtService.extractJti(authHeader.substring(7));
        }
        return null;
    }

    private void logAudit(User user, String action) {
        String ipAddress = httpRequest.getHeader("X-Forwarded-For");
        if (ipAddress == null) ipAddress = httpRequest.getRemoteAddr();
        else ipAddress = ipAddress.split(",")[0];
        
        String userAgent = httpRequest.getHeader("User-Agent");
        
        SecurityAudit audit = SecurityAudit.builder()
                .userId(user.getId())
                .action(action)
                .ipAddress(ipAddress)
                .userAgent(userAgent != null ? userAgent : "Unknown")
                .build();
        auditRepository.save(audit);
    }

    @GetMapping("/sessions")
    public ResponseEntity<List<UserSession>> getActiveSessions() {
        User user = getCurrentUser();
        return ResponseEntity.ok(sessionRepository.findByUserId(user.getId()));
    }

    @DeleteMapping("/sessions/{tokenId}")
    @Transactional
    public ResponseEntity<?> revokeSession(@PathVariable String tokenId) {
        User user = getCurrentUser();
        sessionRepository.deleteByTokenId(tokenId);
        logAudit(user, "SESSION_REVOKED");
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/sessions/others")
    @Transactional
    public ResponseEntity<?> revokeOtherSessions() {
        User user = getCurrentUser();
        String currentJti = getCurrentJti();
        if (currentJti != null) {
            sessionRepository.deleteByUserIdAndTokenIdNot(user.getId(), currentJti);
            logAudit(user, "ALL_OTHER_SESSIONS_REVOKED");
        }
        return ResponseEntity.ok().build();
    }
    
    @DeleteMapping("/sessions")
    @Transactional
    public ResponseEntity<?> logoutCurrentSession() {
        User user = getCurrentUser();
        String currentJti = getCurrentJti();
        if (currentJti != null) {
            sessionRepository.deleteByTokenId(currentJti);
            logAudit(user, "LOGOUT");
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/audit")
    public ResponseEntity<List<SecurityAudit>> getAuditLogs() {
        User user = getCurrentUser();
        return ResponseEntity.ok(auditRepository.findByUserIdOrderByCreatedAtDesc(user.getId()));
    }

    @PostMapping("/change-password")
    public ResponseEntity<?> changePassword(@RequestBody ChangePasswordRequest request) {
        User user = getCurrentUser();
        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            return ResponseEntity.badRequest().body("Incorrect current password");
        }
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        
        logAudit(user, "PASSWORD_CHANGED");
        // Optionally revoke other sessions when password changes
        
        return ResponseEntity.ok().build();
    }

    @GetMapping("/export")
    public ResponseEntity<Map<String, Object>> exportData() {
        User user = getCurrentUser();
        logAudit(user, "DATA_EXPORTED");
        
        Map<String, Object> export = new HashMap<>();
        export.put("profile", user.getProfile());
        export.put("email", user.getEmail());
        export.put("createdAt", user.getCreatedAt());
        // In a real app we'd fetch messages here too, but this suffices for the example.
        return ResponseEntity.ok(export);
    }

    @DeleteMapping("/account")
    @Transactional
    public ResponseEntity<?> deleteAccount() {
        User user = getCurrentUser();
        logAudit(user, "ACCOUNT_DELETED");
        
        // Soft delete/anonymize to preserve group messages
        user.setEmail("deleted_" + user.getId() + "@deleted.com");
        user.setPassword("");
        user.getProfile().setFullName("Deleted User");
        user.getProfile().setAvatarUrl(null);
        user.getProfile().setBio(null);
        userRepository.save(user);
        
        // Revoke all sessions
        sessionRepository.deleteAllByUserId(user.getId());
        
        return ResponseEntity.ok().build();
    }
}

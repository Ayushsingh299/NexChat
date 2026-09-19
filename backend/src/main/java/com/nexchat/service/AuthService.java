package com.nexchat.service;

import com.nexchat.dto.AuthResponse;
import com.nexchat.dto.LoginRequest;
import com.nexchat.dto.RegisterRequest;
import com.nexchat.model.Profile;
import com.nexchat.model.Role;
import com.nexchat.model.User;
import com.nexchat.repository.UserRepository;
import com.nexchat.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.nexchat.model.UserSession;
import com.nexchat.model.SecurityAudit;
import com.nexchat.repository.UserSessionRepository;
import com.nexchat.repository.SecurityAuditRepository;
import jakarta.servlet.http.HttpServletRequest;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final UserSessionRepository sessionRepository;
    private final SecurityAuditRepository auditRepository;
    private final HttpServletRequest httpRequest;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (repository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already in use");
        }

        var user = User.builder()
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(Role.USER)
                .publicKey(request.getPublicKey())
                .build();
                
        var profile = Profile.builder()
                .fullName(request.getFullName())
                .user(user)
                .build();
                
        user.setProfile(profile);

        repository.save(user);
        
        String jti = UUID.randomUUID().toString();
        var jwtToken = jwtService.generateTokenWithJti(new HashMap<>(), user, jti);
        
        createSession(user.getId(), jti);
        logAudit(user.getId(), "REGISTER");
        
        return AuthResponse.builder()
                .token(jwtToken)
                .email(user.getEmail())
                .fullName(user.getProfile().getFullName())
                .id(user.getId())
                .bio(user.getProfile().getBio())
                .statusMessage(user.getProfile().getStatusMessage())
                .avatarUrl(user.getProfile().getAvatarUrl())
                .build();
    }

    public AuthResponse login(LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        var user = repository.findByEmail(request.getEmail())
                .orElseThrow();
                
        if (request.getPublicKey() != null && !request.getPublicKey().isEmpty()) {
            user.setPublicKey(request.getPublicKey());
            repository.save(user);
        }
        
        String jti = UUID.randomUUID().toString();
        var jwtToken = jwtService.generateTokenWithJti(new HashMap<>(), user, jti);
        
        createSession(user.getId(), jti);
        logAudit(user.getId(), "LOGIN");
        
        return AuthResponse.builder()
                .token(jwtToken)
                .email(user.getEmail())
                .fullName(user.getProfile() != null ? user.getProfile().getFullName() : "")
                .id(user.getId())
                .bio(user.getProfile() != null ? user.getProfile().getBio() : null)
                .statusMessage(user.getProfile() != null ? user.getProfile().getStatusMessage() : null)
                .avatarUrl(user.getProfile() != null ? user.getProfile().getAvatarUrl() : null)
                .build();
    }

    private void createSession(Long userId, String jti) {
        String ipAddress = getClientIP();
        String userAgent = httpRequest.getHeader("User-Agent");
        
        UserSession session = UserSession.builder()
                .tokenId(jti)
                .userId(userId)
                .ipAddress(ipAddress)
                .userAgent(userAgent != null ? userAgent : "Unknown")
                .lastActiveAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusDays(1)) // 1 day expiration
                .build();
        sessionRepository.save(session);
    }

    private void logAudit(Long userId, String action) {
        String ipAddress = getClientIP();
        String userAgent = httpRequest.getHeader("User-Agent");
        
        SecurityAudit audit = SecurityAudit.builder()
                .userId(userId)
                .action(action)
                .ipAddress(ipAddress)
                .userAgent(userAgent != null ? userAgent : "Unknown")
                .build();
        auditRepository.save(audit);
    }

    private String getClientIP() {
        if (httpRequest == null) return "Unknown";
        String xfHeader = httpRequest.getHeader("X-Forwarded-For");
        if (xfHeader == null) {
            return httpRequest.getRemoteAddr();
        }
        return xfHeader.split(",")[0];
    }
}

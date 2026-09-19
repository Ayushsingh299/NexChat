package com.nexchat.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String tokenId; // Maps to JWT 'jti' claim

    @Column(nullable = false)
    private Long userId;

    private String ipAddress;
    
    private String userAgent;

    @CreationTimestamp
    private LocalDateTime createdAt;
    
    private LocalDateTime lastActiveAt;

    @Column(nullable = false)
    private LocalDateTime expiresAt;
}

package com.nexchat.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "security_audits")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SecurityAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private String action; // e.g., "LOGIN", "PASSWORD_CHANGED", "LOGOUT", "DATA_EXPORTED"

    private String ipAddress;
    
    private String userAgent;

    @CreationTimestamp
    private LocalDateTime createdAt;
}

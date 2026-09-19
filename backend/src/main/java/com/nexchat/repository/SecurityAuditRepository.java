package com.nexchat.repository;

import com.nexchat.model.SecurityAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SecurityAuditRepository extends JpaRepository<SecurityAudit, Long> {
    List<SecurityAudit> findByUserIdOrderByCreatedAtDesc(Long userId);
}

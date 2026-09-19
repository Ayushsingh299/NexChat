package com.nexchat.controller;

import com.nexchat.dto.AdminDashboardResponse;
import com.nexchat.dto.PerformanceStatsResponse;
import com.nexchat.service.AdminService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/analytics")
    public ResponseEntity<AdminDashboardResponse> getAnalytics() {
        return ResponseEntity.ok(adminService.getDashboardMetrics());
    }

    @GetMapping("/performance")
    public ResponseEntity<PerformanceStatsResponse> getPerformanceStats() {
        return ResponseEntity.ok(adminService.getPerformanceStats());
    }
}

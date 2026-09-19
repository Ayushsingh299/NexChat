package com.nexchat.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PrivacySettingsRequest {
    private Boolean showLastSeen;
    private Boolean showOnlineStatus;
    private Boolean readReceiptsEnabled;
}

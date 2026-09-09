package de.mplat.geotour.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.List;
import java.util.UUID;

@Controller
@RequestMapping("/tours")
public class TourController {

    @PostMapping("/{tourId}/photos/upload-urls")
    public ResponseEntity<Void> uploadPhoto(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @RequestBody UploadUrlRequest request) {

        return ResponseEntity.ok().build();
    }

    @PostMapping
    public ResponseEntity<UUID> createTour(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok().build();
    }

    public record UploadUrlRequest(List<String> filenames) {}
}

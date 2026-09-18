package de.mplat.geotour.controller;

import de.mplat.geotour.entity.*;
import de.mplat.geotour.service.PhotoService;
import de.mplat.geotour.service.StorageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/tours")
public class TourController {
    private final UserRepository userRepository;
    private final TourRepository tourRepository;
    private final StorageService storageService;
    private final PhotoService photoService;
    private final PasswordEncoder encoder;

    public TourController(UserRepository userRepository, TourRepository tourRepository, StorageService storageService, PhotoService photoService, PasswordEncoder encoder) {
        this.userRepository = userRepository;
        this.tourRepository = tourRepository;
        this.storageService = storageService;
        this.photoService = photoService;
        this.encoder = encoder;
    }

    @PostMapping("/{tourId}/photos/upload-urls")
    public List<StorageService.PresignedUpload> uploadPhoto(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @Valid @RequestBody UploadUrlRequest request) {
        requireOwnerTour(tourId, jwt);
        return request.filenames().stream().map((filename) -> storageService.presignedUpload(filename)).toList();
    }

    @PostMapping("/{tourId}/photos")
    public ResponseEntity<List<PhotoResponse>> registerPhoto(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @Valid @RequestBody RegisterPhotoRequest request) {
        try {
            List<Photo> promotedPhotos = photoService.register(request.photos(), requireOwnerTour(tourId, jwt));
            List<PhotoResponse> responses = promotedPhotos.stream().map(photo -> new PhotoResponse(photo.getId(), photo.getStorageKey(), photo.getLat(), photo.getLng())).toList();
            return ResponseEntity.status(HttpStatus.CREATED).body(responses);
        }
        catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verifyTour(@Valid @RequestBody VerifyTourRequest request) {
        Optional<Tour> tour = tourRepository.findByShareToken(request.shareToken());
        if (tour.isEmpty() || !tour.get().isPublic()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
        }
        if (tour.get().getPasswordHash() == null) {
            return ResponseEntity.status(HttpStatus.OK).body(new NeedsPasswordResponse(false, false));
        }
        if (!encoder.matches(request.password(), tour.get().getPasswordHash()) || request.password().isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(new NeedsPasswordResponse(true, true));
        }
        return ResponseEntity.status(HttpStatus.OK).body(null);
    }

    @PostMapping
    public ResponseEntity<TourResponse> createTour(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateTourRequest request) {
        User user = userRepository.getReferenceById(userIdOf(jwt));
        Tour tour = tourRepository.save(new Tour(user, request.name(), false));
        return ResponseEntity.created(URI.create("/tours/" + tour.getId())).body(new TourResponse(tour.getId(), tour.getName()));
    }

    @PutMapping("/{tourId}/password")
    public ResponseEntity<Void> changeTourPassword(@AuthenticationPrincipal Jwt jwt, @PathVariable("tourId") UUID tourId, @Valid @RequestBody SetPasswordRequest request) {
        Tour tour = requireOwnerTour(tourId, jwt);
        String password = request.password();
        tour.setPasswordHash((password == null || password.isBlank()) ? null : encoder.encode(password));
        tourRepository.save(tour);
        return ResponseEntity.noContent().build();
    }

    private UUID userIdOf(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    private Tour requireOwnerTour(UUID tourId, Jwt jwt) {
        return tourRepository.findByIdAndOwner_Id(tourId, userIdOf(jwt)).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    public record CreateTourRequest(@NotBlank @Size(max = 200) String name) {}
    public record TourResponse(UUID id, String name) {}
    public record UploadUrlRequest(@NotEmpty @Size(max = 50) List<@NotBlank String> filenames) {}
    public record RegisterPhotoRequest(@NotEmpty List<PhotoService.PhotoRegistration> photos) {}
    public record PhotoResponse(UUID id, String key, double lat, double lng) {}
    public record SetPasswordRequest(String password) {}
    public record VerifyTourRequest(@NotBlank UUID shareToken, @NotBlank String password) {}
    public record NeedsPasswordResponse(boolean needsPassword, boolean wrong) {}
    public record PublicTourResponse(){};
}
